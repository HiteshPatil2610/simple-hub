import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import helmet from 'helmet';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { createServer as createViteServer } from 'vite';
import { Product, ClickEvent, ConversionEvent, AnalyticsSummary } from './src/types';
import { store, initDb, pool } from './db';

// Wraps an async Express handler so a rejected promise is forwarded to the
// global error handler instead of crashing the request (Express 4 does not
// do this automatically for async handlers).
function asyncHandler(
  fn: (req: express.Request, res: express.Response, next: express.NextFunction) => Promise<unknown>
) {
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

const app = express();
const configuredPort = Number.parseInt(process.env.PORT || '3000', 10);
const PORT = Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Trust the first proxy hop (Cloud Run / Render / Railway / nginx, etc.) so
// req.ip reflects the real client IP instead of the proxy's IP.
app.set('trust proxy', 1);

app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));

// =============================================================================
// NEON AUTH (Managed Better Auth) — replaces the previous custom JWT/password
// system. Sign-in itself (email+password, Google OAuth) is handled entirely
// by Neon's hosted auth service; the frontend talks to it directly via the
// @neondatabase/auth client SDK. This server's only job is:
//   1. Verify the JWT the frontend sends us, against Neon Auth's public JWKS.
//   2. Look up that verified user in the neon_auth.user table (synced live
//      into this same Postgres database) to get their email.
//   3. Check that email against an admin allow-list — Neon Auth signup is
//      open by default, so this allow-list is what actually restricts who
//      gets into the Owner Hub.
// =============================================================================
const NEON_AUTH_JWKS_URL = process.env.NEON_AUTH_JWKS_URL?.trim();
if (!NEON_AUTH_JWKS_URL) {
  throw new Error(
    'NEON_AUTH_JWKS_URL is not set. Copy it from the Neon console (Auth tab) or the ' +
    'Neon Auth config — it looks like https://<endpoint>.neonauth.<region>.aws.neon.tech/<db>/auth/.well-known/jwks.json'
  );
}
const JWKS = createRemoteJWKSet(new URL(NEON_AUTH_JWKS_URL));

// Comma-separated list of emails allowed to access the Owner Hub, e.g.
// "a@example.com,b@example.com". Case-insensitive.
const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean)
);
if (ADMIN_EMAILS.size === 0 && IS_PRODUCTION) {
  console.warn('[AUTH] ADMIN_EMAILS is empty — no one will be able to access the Owner Hub.');
}

// Verifies the bearer JWT issued by Neon Auth, resolves it to a real user row
// via neon_auth.user, and checks that user's email against the allow-list.
async function requireAdmin(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return sendError(res, 401, 'Authorization header with Bearer token required.');
  }

  let userId: string | undefined;
  try {
    const { payload } = await jwtVerify(token, JWKS);
    userId = typeof payload.sub === 'string' ? payload.sub : undefined;
  } catch {
    return sendError(res, 401, 'Invalid or expired token. Please log in again.');
  }
  if (!userId) {
    return sendError(res, 401, 'Token did not contain a valid subject.');
  }

  const { rows } = await pool.query(
    'SELECT id, email, name FROM neon_auth."user" WHERE id = $1',
    [userId]
  );
  const user = rows[0];
  if (!user) {
    return sendError(res, 401, 'User not found.');
  }

  const email = String(user.email).toLowerCase();
  if (!ADMIN_EMAILS.has(email)) {
    return sendError(res, 403, 'This account is not approved for admin access.');
  }

  res.locals.user = { id: user.id, email: user.email, name: user.name };
  next();
}

// =============================================================================
// SECURITY MIDDLEWARE
// =============================================================================
// The Content-Security-Policy needs to explicitly allow the browser to talk
// to Neon Auth (Managed Better Auth) directly for sign-in/session calls —
// derived from NEON_AUTH_JWKS_URL so it stays correct without a separate var.
const NEON_AUTH_ORIGIN = new URL(NEON_AUTH_JWKS_URL).origin;

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      scriptSrc: IS_PRODUCTION ? ["'self'"] : ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'ws:', NEON_AUTH_ORIGIN],
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
    },
  },
  frameguard: { action: 'deny' },
  hsts: { maxAge: 31_536_000, includeSubDomains: true },
  noSniff: true,
}));

app.use((req, res, next) => {
  const correlationId = crypto.randomUUID();
  res.locals.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  next();
});

function sendError(res: express.Response, status: number, error: string) {
  return res.status(status).json({ error, correlationId: res.locals.correlationId });
}

// =============================================================================
// LIGHTWEIGHT RATE LIMITING
// =============================================================================
function createRateLimiter(windowMs: number, max: number) {
  const hits = new Map<string, number[]>();
  return (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const key = req.ip || 'unknown';
    const now = Date.now();
    const timestamps = (hits.get(key) || []).filter(t => now - t < windowMs);
    if (timestamps.length >= max) {
      return sendError(res, 429, 'Too many requests, please slow down.');
    }
    timestamps.push(now);
    hits.set(key, timestamps);
    next();
  };
}

const redirectLimiter  = createRateLimiter(60_000, 60);   // 60 redirects/min/IP
const uploadLimiter    = createRateLimiter(60_000, 20);   // 20 uploads/min/IP
const trackLimiter     = createRateLimiter(60_000, 120);  // 120 beacon calls/min/IP
const webhookLimiter   = createRateLimiter(60_000, 30);   // 30 webhook calls/min/IP

// =============================================================================
// PERSISTENT STORAGE DIRECTORIES
// =============================================================================
const DATA_DIR    = path.resolve(process.env.DATA_DIR    || path.join(process.cwd(), 'data'));
const UPLOADS_DIR = path.resolve(process.env.UPLOADS_DIR || path.join(process.cwd(), 'public', 'uploads'));

try {
  fs.mkdirSync(DATA_DIR,    { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
} catch {
  throw new Error('Persistent storage directories could not be created. Check DATA_DIR and UPLOADS_DIR.');
}
app.use('/uploads', express.static(UPLOADS_DIR));

// =============================================================================
// AFFILIATE LINK BUILDER
// =============================================================================
export function buildAffiliateRedirectUrl(
  product: Product,
  params: { utm_source?: string; utm_medium?: string; utm_campaign?: string; subid?: string } = {}
): string {
  try {
    let rawUrl = (product.affiliateUrl || '').trim();
    if (!rawUrl) return 'https://www.amazon.com';

    // Ensure URL has http:// or https:// so Express res.redirect sends an absolute URL
    if (!/^https?:\/\//i.test(rawUrl)) {
      rawUrl = `https://${rawUrl}`;
    }

    // amzn.to short links already embed the affiliate tag — pass through unchanged.
    if (rawUrl.includes('amzn.to/')) {
      return rawUrl;
    }

    const urlObj = new URL(rawUrl);

    // If the user already has a `tag` param in the URL, keep it intact.
    if (!urlObj.searchParams.has('tag')) {
      const tag = product.affiliateTag || 'raccoonhub-20';
      urlObj.searchParams.set('tag', tag);
    }

    if (params.utm_source)   urlObj.searchParams.set('utm_source',   params.utm_source);
    if (params.utm_medium)   urlObj.searchParams.set('utm_medium',   params.utm_medium);
    if (params.utm_campaign) urlObj.searchParams.set('utm_campaign', params.utm_campaign);
    if (params.subid || product.customSubId) {
      urlObj.searchParams.set('subid', params.subid || product.customSubId || 'raccoonhub');
    }

    return urlObj.toString();
  } catch {
    let fallback = (product.affiliateUrl || 'https://www.amazon.com').trim();
    if (!/^https?:\/\//i.test(fallback)) {
      fallback = `https://${fallback}`;
    }
    return fallback;
  }
}

// =============================================================================
// IMAGE UPLOAD — type allowlist + MAGIC BYTES validation (② + ⑧)
// =============================================================================
// SVG is excluded: inline <script> in SVG = stored XSS.
const ALLOWED_UPLOAD_TYPES: Record<string, string> = {
  jpeg: 'jpg',
  jpg:  'jpg',
  png:  'png',
  gif:  'gif',
  webp: 'webp',
};

const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8 MB decoded

/**
 * Validate the actual file content magic bytes (file signature) against the
 * MIME type declared in the data URL prefix. This prevents a caller from
 * renaming a PHP/HTML/EXE file as image.png and uploading it.
 */
function validateMagicBytes(buffer: Buffer, declaredExt: string): boolean {
  // JPEG: FF D8 FF
  if (declaredExt === 'jpg') {
    return buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF;
  }
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (declaredExt === 'png') {
    return (
      buffer[0] === 0x89 && buffer[1] === 0x50 &&
      buffer[2] === 0x4E && buffer[3] === 0x47 &&
      buffer[4] === 0x0D && buffer[5] === 0x0A &&
      buffer[6] === 0x1A && buffer[7] === 0x0A
    );
  }
  // GIF: 47 49 46 38 (GIF8)
  if (declaredExt === 'gif') {
    return (
      buffer[0] === 0x47 && buffer[1] === 0x49 &&
      buffer[2] === 0x46 && buffer[3] === 0x38
    );
  }
  // WEBP: 52 49 46 46 (RIFF) at 0..3, then 57 45 42 50 (WEBP) at 8..11
  if (declaredExt === 'webp') {
    return (
      buffer[0] === 0x52 && buffer[1] === 0x49 &&
      buffer[2] === 0x46 && buffer[3] === 0x46 &&
      buffer[8] === 0x57 && buffer[9] === 0x45 &&
      buffer[10] === 0x42 && buffer[11] === 0x50
    );
  }
  return false;
}

app.post('/api/upload', requireAdmin, uploadLimiter, (req, res) => {
  try {
    const { dataUrl, filename } = req.body;
    if (!dataUrl || typeof dataUrl !== 'string') {
      return sendError(res, 400, 'No image data provided');
    }

    const match = dataUrl.match(/^data:image\/([a-zA-Z0-9+.-]+);base64,(.+)$/);
    if (!match) {
      return sendError(res, 400, 'Unsupported image format. Please upload a JPG, PNG, GIF, or WEBP file.');
    }

    const rawType = match[1].toLowerCase();
    const ext = ALLOWED_UPLOAD_TYPES[rawType];
    if (!ext) {
      return sendError(res, 400, 'Unsupported image type. Allowed: JPG, PNG, GIF, WEBP.');
    }

    const base64Data = match[2];
    const buffer = Buffer.from(base64Data, 'base64');
    if (buffer.length === 0 || buffer.length > MAX_UPLOAD_BYTES) {
      return sendError(res, 413, `Image too large. Max size is ${MAX_UPLOAD_BYTES / (1024 * 1024)}MB.`);
    }

    // ⑧ Magic-bytes check: ensure actual file content matches declared MIME type.
    if (!validateMagicBytes(buffer, ext)) {
      return sendError(res, 400, 'File content does not match the declared image type. Upload aborted.');
    }

    const cleanName = filename
      ? filename.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 30)
      : 'device-photo';
    const uniqueName = `upload-${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${cleanName}.${ext}`;
    const targetPath = path.join(UPLOADS_DIR, uniqueName);

    fs.writeFileSync(targetPath, buffer);
    const publicUrl = `/uploads/${uniqueName}`;

    res.json({ imageUrl: publicUrl, success: true });
  } catch {
    console.error('Image upload failed');
    sendError(res, 500, 'Failed to process and store image upload');
  }
});

// =============================================================================
// HELPERS
// =============================================================================
function getVisitorHash(req: express.Request): string {
  const ip  = req.ip || req.socket.remoteAddress || 'unknown';
  const ua  = req.headers['user-agent'] || 'unknown';
  const day = new Date().toISOString().split('T')[0];
  return crypto.createHash('sha256').update(`${ip}|${ua}|${day}`).digest('hex').slice(0, 16);
}

function parseDevice(userAgent?: string): 'Mobile' | 'Desktop' | 'Tablet' {
  if (!userAgent) return 'Desktop';
  const ua = userAgent.toLowerCase();
  if (/ipad|tablet|(android(?!.*mobile))/i.test(ua)) return 'Tablet';
  if (/mobile|iphone|ipod|android|blackberry|mini|windows\sce|palm/i.test(ua)) return 'Mobile';
  return 'Desktop';
}

function normalizeReferrer(value: unknown): string {
  if (typeof value !== 'string' || !value.trim()) return 'direct';
  try {
    return new URL(value).hostname || 'direct';
  } catch {
    return value.replace(/[^a-zA-Z0-9.-]/g, '').slice(0, 255) || 'direct';
  }
}

// Validate that a platform value is Amazon (the only supported platform).
function validatePlatform(platform: unknown): 'Amazon' {
  if (platform && platform !== 'Amazon') {
    throw Object.assign(new Error('Only Amazon platform is supported.'), { statusCode: 400 });
  }
  return 'Amazon';
}

// =============================================================================
// ⑦ DATA RETENTION — purge click records older than CLICK_RETENTION_DAYS
// =============================================================================
const CLICK_RETENTION_DAYS = Math.max(1, parseInt(process.env.CLICK_RETENTION_DAYS || '90', 10));

async function runRetentionPurge() {
  const deleted = await store.deleteClicksOlderThan(CLICK_RETENTION_DAYS);
  if (deleted > 0) {
    console.info(`[Retention] Purged ${deleted} click record(s) older than ${CLICK_RETENTION_DAYS} days.`);
  }
}

// =============================================================================
// API ENDPOINTS
// =============================================================================

// Health check
app.get('/api/health', asyncHandler(async (req, res) => {
  const products = await store.listProducts();
  res.json({ status: 'ok', timestamp: new Date().toISOString(), productCount: products.length });
}));

// ---- ④ AUTHENTICATION ----
// Sign-in itself happens client-side against Neon Auth directly. This route
// just confirms a token is valid and the user is on the admin allow-list —
// used by the frontend on load to silently re-validate a stored token, and
// after a fresh sign-in to confirm access before unlocking the Owner Hub.
app.get('/api/auth/me', requireAdmin, asyncHandler(async (req, res) => {
  res.json(res.locals.user);
}));

// GET all products
app.get('/api/products', asyncHandler(async (req, res) => {
  const { category, search, platform, featured } = req.query;
  let filtered = await store.listProducts();

  if (category && category !== 'All') {
    filtered = filtered.filter(p => p.category.toLowerCase() === String(category).toLowerCase());
  }

  if (platform && platform !== 'All') {
    filtered = filtered.filter(p => p.platform.toLowerCase() === String(platform).toLowerCase());
  }

  if (featured === 'true') {
    filtered = filtered.filter(p => p.featured);
  }

  if (search && typeof search === 'string') {
    const q = search.toLowerCase().trim();
    filtered = filtered.filter(
      p =>
        p.title.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.platform.toLowerCase().includes(q)
    );
  }

  res.json(filtered);
}));

// GET single product
app.get('/api/products/:id', asyncHandler(async (req, res) => {
  const product = await store.getProduct(req.params.id);
  if (!product) {
    return sendError(res, 404, 'Product not found');
  }
  res.json(product);
}));

// POST add product — ② Amazon-only platform validation
app.post('/api/products', requireAdmin, asyncHandler(async (req, res) => {
  const {
    title,
    description,
    category,
    rating,
    reviewCount,
    imageUrl,
    platform,
    affiliateUrl,
    affiliateTag,
    customSubId,
    badge,
    featured,
  } = req.body;

  if (!title || !affiliateUrl) {
    return sendError(res, 400, 'Title and affiliate URL are required.');
  }

  let validatedPlatform: 'Amazon';
  try {
    validatedPlatform = validatePlatform(platform);
  } catch (e: any) {
    return sendError(res, 400, e.message);
  }

  const newProduct: Product = {
    id: `prod-${Date.now()}`,
    title: String(title).trim(),
    description: String(description || '').trim(),
    category: String(category || 'Viral Finds').trim(),
    rating: parseFloat(rating) || 5.0,
    reviewCount: parseInt(reviewCount, 10) || 1,
    imageUrl: String(imageUrl || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80').trim(),
    platform: validatedPlatform,
    affiliateUrl: String(affiliateUrl).trim(),
    affiliateTag: affiliateTag ? String(affiliateTag).trim() : 'raccoonhub-20',
    customSubId: customSubId ? String(customSubId).trim() : undefined,
    badge: badge ? String(badge).trim() : undefined,
    featured: Boolean(featured),
    createdAt: new Date().toISOString(),
  };

  await store.createProduct(newProduct);
  res.status(201).json(newProduct);
}));

// Explicit allowlist of updatable product fields.
const UPDATABLE_PRODUCT_FIELDS = [
  'title', 'description', 'category', 'rating',
  'reviewCount', 'imageUrl', 'platform', 'affiliateUrl', 'affiliateTag',
  'customSubId', 'badge', 'featured',
] as const;

// PUT update product — ② Amazon-only platform validation
app.put('/api/products/:id', requireAdmin, asyncHandler(async (req, res) => {
  const existing = await store.getProduct(req.params.id);
  if (!existing) {
    return sendError(res, 404, 'Product not found');
  }

  const body = req.body || {};
  const updated: Product = { ...existing };

  for (const field of UPDATABLE_PRODUCT_FIELDS) {
    if (!(field in body)) continue;
    switch (field) {
      case 'rating': {
        const num = parseFloat(body[field]);
        if (!Number.isNaN(num)) updated.rating = num;
        break;
      }
      case 'reviewCount': {
        const num = parseInt(body[field], 10);
        if (!Number.isNaN(num)) updated.reviewCount = num;
        break;
      }
      case 'featured':
        updated.featured = Boolean(body.featured);
        break;
      case 'platform': {
        // ② Enforce Amazon-only platform
        try {
          updated.platform = validatePlatform(body.platform);
        } catch (e: any) {
          return sendError(res, 400, e.message);
        }
        break;
      }
      default:
        (updated as any)[field] = typeof body[field] === 'string' ? body[field].trim() : body[field];
    }
  }
  updated.id = existing.id; // id is never overridable

  await store.updateProduct(updated);
  res.json(updated);
}));

// DELETE product
app.delete('/api/products/:id', requireAdmin, asyncHandler(async (req, res) => {
  const deleted = await store.deleteProduct(req.params.id);
  if (!deleted) {
    return sendError(res, 404, 'Product not found');
  }
  res.json({ success: true, message: 'Product deleted' });
}));

// REDIRECT ENDPOINT: /api/redirect/:id or /r/:id
app.get(['/api/redirect/:id', '/r/:id'], redirectLimiter, asyncHandler(async (req, res) => {
  const product = await store.getProduct(req.params.id);
  if (!product) {
    return sendError(res, 404, 'Product link not found.');
  }

  const userAgent = req.headers['user-agent'] || '';
  const referrerHeader = req.headers['referer'] || req.query.ref || 'direct';
  const referrer = typeof referrerHeader === 'string' ? referrerHeader : 'direct';

  const utmSource   = (req.query.utm_source   as string) || (referrer.includes('tiktok') ? 'tiktok' : referrer.includes('instagram') ? 'instagram' : 'raccoonhub');
  const utmMedium   = (req.query.utm_medium   as string) || 'affiliate_redirect';
  const utmCampaign = (req.query.utm_campaign as string) || 'curated_finds';
  const subid       = (req.query.subid        as string) || product.customSubId || 'raccoonhub';

  const finalUrl = buildAffiliateRedirectUrl(product, {
    utm_source:   utmSource,
    utm_medium:   utmMedium,
    utm_campaign: utmCampaign,
    subid,
  });

  const clickEvent: ClickEvent = {
    id: `click-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    productId: product.id,
    productTitle: product.title,
    platform: product.platform,
    category: product.category,
    timestamp: new Date().toISOString(),
    referrer: referrer.replace(/^https?:\/\//, '').split('/')[0] || 'direct',
    device: parseDevice(userAgent),
    utmSource,
    utmMedium,
    utmCampaign,
    destinationUrl: finalUrl,
    visitorHash: getVisitorHash(req),
  };

  await store.createClick(clickEvent);

  if (req.query.format === 'json') {
    return res.json({ success: true, clickId: clickEvent.id, destinationUrl: finalUrl });
  }

  res.redirect(302, finalUrl);
}));

// CLIENT TRACKING BEACON
app.post('/api/track/click', trackLimiter, asyncHandler(async (req, res) => {
  const { productId, utmSource, utmMedium, utmCampaign, subid, referrer } = req.body;
  const product = await store.getProduct(productId);

  if (!product) {
    return sendError(res, 404, 'Product not found');
  }

  const userAgent = req.headers['user-agent'] || '';
  const finalUrl = buildAffiliateRedirectUrl(product, {
    utm_source:   utmSource   || 'storefront',
    utm_medium:   utmMedium   || 'affiliate_card',
    utm_campaign: utmCampaign || 'viral_curation',
    subid:        subid || product.customSubId,
  });

  const clickEvent: ClickEvent = {
    id: `click-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    productId: product.id,
    productTitle: product.title,
    platform: product.platform,
    category: product.category,
    timestamp: new Date().toISOString(),
    referrer: normalizeReferrer(referrer),
    device: parseDevice(userAgent),
    utmSource:   utmSource   || 'storefront',
    utmMedium:   utmMedium   || 'affiliate_card',
    utmCampaign: utmCampaign || 'viral_curation',
    destinationUrl: finalUrl,
    visitorHash: getVisitorHash(req),
  };

  await store.createClick(clickEvent);

  res.json({ success: true, clickId: clickEvent.id, destinationUrl: finalUrl });
}));

// MANUAL CONVERSION RECORD (owner-initiated)
app.post('/api/analytics/conversion', requireAdmin, asyncHandler(async (req, res) => {
  const { productId, clickId } = req.body;
  const product = await store.getProduct(productId);

  if (!product) {
    return sendError(res, 404, 'Product not found');
  }

  const convEvent: ConversionEvent = {
    id: `conv-${Date.now()}`,
    clickId: clickId || undefined,
    productId: product.id,
    productTitle: product.title,
    timestamp: new Date().toISOString(),
    platform: product.platform,
  };

  await store.createConversion(convEvent);
  res.status(201).json(convEvent);
}));

// =============================================================================
// ⑥ CONVERSION WEBHOOK — accepts signed payloads from affiliate networks
// =============================================================================
// Verifies X-Webhook-Signature (HMAC-SHA256 of the raw request body using
// WEBHOOK_SECRET). Compatible with Impact, CJ Affiliate, ShareASale, and any
// affiliate network that supports outgoing HMAC-signed webhooks.
//
// Amazon Associates does not provide real-time webhooks natively; record
// conversions manually via POST /api/analytics/conversion instead.
const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET?.trim() || '';

app.post('/api/webhooks/conversion', webhookLimiter, express.raw({ type: 'application/json', limit: '1mb' }), asyncHandler(async (req, res) => {
  if (!WEBHOOK_SECRET) {
    return sendError(res, 503, 'Webhook endpoint is not configured (WEBHOOK_SECRET not set).');
  }

  const signature = req.headers['x-webhook-signature'] as string;
  if (!signature) {
    return sendError(res, 400, 'Missing X-Webhook-Signature header.');
  }

  // Compute HMAC-SHA256 of the raw body using the shared secret.
  const expectedSig = crypto
    .createHmac('sha256', WEBHOOK_SECRET)
    .update(req.body)
    .digest('hex');

  const sigBuffer  = Buffer.from(signature.replace(/^sha256=/, ''), 'hex');
  const expectedBuf = Buffer.from(expectedSig, 'hex');

  if (sigBuffer.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuffer, expectedBuf)) {
    return sendError(res, 401, 'Invalid webhook signature.');
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(req.body.toString('utf-8'));
  } catch {
    return sendError(res, 400, 'Invalid JSON payload.');
  }

  // Map the generic payload to a ConversionEvent. Networks vary in field names;
  // common fields are listed here — extend as needed for your network.
  const productId   = String(payload.productId   || payload.product_id   || '');
  const clickId     = String(payload.clickId     || payload.click_id     || payload.transaction_id || '');
  const productTitle = String(payload.productTitle || payload.product_title || 'Unknown Product');
  const platform    = 'Amazon';

  if (!productId) {
    return sendError(res, 400, 'Webhook payload must include productId.');
  }

  const convEvent: ConversionEvent = {
    id: `conv-webhook-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`,
    clickId: clickId || undefined,
    productId,
    productTitle,
    timestamp: new Date().toISOString(),
    platform,
  };

  await store.createConversion(convEvent);
  console.info(`[Webhook] Recorded conversion for product ${productId}`);
  res.status(201).json({ success: true, conversionId: convEvent.id });
}));

// =============================================================================
// ANALYTICS
// =============================================================================
async function getClicksToday(): Promise<number> {
  const todayStr = new Date().toISOString().split('T')[0];
  const clicks = await store.listClicks();
  return clicks.filter(c => c.timestamp.startsWith(todayStr)).length;
}

// Public analytics — aggregate only, no PII.
app.get('/api/analytics/public', asyncHandler(async (req, res) => {
  res.json({ clicksToday: await getClicksToday() });
}));

// Full analytics — owner-only.
app.get('/api/analytics', requireAdmin, asyncHandler(async (req, res) => {
  const clicks      = await store.listClicks();
  const conversions = await store.listConversions();
  const products    = await store.listProducts();

  const totalClicks      = await store.countTotalClicks();
  const uniqueVisitors   = await store.countDistinctVisitors();
  const totalConversions = await store.countTotalConversions();
  const conversionRate   = totalClicks > 0 ? Number(((totalConversions / totalClicks) * 100).toFixed(1)) : 0;
  const clicksToday      = await getClicksToday();

  // Clicks by day (last 14 days)
  const daysMap = new Map<string, { clicks: number; conversions: number }>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const dateKey = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    daysMap.set(dateKey, { clicks: 0, conversions: 0 });
  }

  clicks.forEach(c => {
    const dateKey = new Date(c.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (daysMap.has(dateKey)) daysMap.get(dateKey)!.clicks += 1;
  });

  conversions.forEach(c => {
    const dateKey = new Date(c.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (daysMap.has(dateKey)) daysMap.get(dateKey)!.conversions += 1;
  });

  const clicksByDay = Array.from(daysMap.entries()).map(([date, data]) => ({
    date,
    clicks: data.clicks,
    conversions: data.conversions,
  }));

  // Top products
  const productClickMap = new Map<string, { clicks: number; conversions: number }>();
  clicks.forEach(c => {
    const e = productClickMap.get(c.productId) || { clicks: 0, conversions: 0 };
    e.clicks += 1;
    productClickMap.set(c.productId, e);
  });
  conversions.forEach(c => {
    const e = productClickMap.get(c.productId) || { clicks: 0, conversions: 0 };
    e.conversions += 1;
    productClickMap.set(c.productId, e);
  });

  const topProducts = products
    .map(p => {
      const stats = productClickMap.get(p.id) || { clicks: 0, conversions: 0 };
      const cr = stats.clicks > 0 ? Number(((stats.conversions / stats.clicks) * 100).toFixed(1)) : 0;
      return {
        productId: p.id,
        productTitle: p.title,
        clicks: stats.clicks,
        conversions: stats.conversions,
        conversionRate: cr,
        platform: p.platform,
        imageUrl: p.imageUrl,
      };
    })
    .sort((a, b) => b.clicks - a.clicks);

  // Breakdowns
  const platformCounts: Record<string, number> = {};
  const categoryCounts: Record<string, number> = {};
  const deviceCounts:   Record<string, number> = {};

  clicks.forEach(c => {
    platformCounts[c.platform] = (platformCounts[c.platform] || 0) + 1;
    categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
    deviceCounts[c.device]     = (deviceCounts[c.device]     || 0) + 1;
  });

  const toPct = (n: number) => totalClicks > 0 ? Number(((n / totalClicks) * 100).toFixed(1)) : 0;

  const summary: AnalyticsSummary = {
    totalClicks,
    uniqueVisitors,
    totalConversions,
    conversionRate,
    clicksToday,
    topProducts,
    clicksByDay,
    platformBreakdown: Object.entries(platformCounts).map(([platform, count]) => ({ platform, clicks: count, percentage: toPct(count) })),
    categoryBreakdown: Object.entries(categoryCounts).map(([category, count]) => ({ category, clicks: count, percentage: toPct(count) })),
    deviceBreakdown:   Object.entries(deviceCounts).map(([device,   count]) => ({ device,   clicks: count, percentage: toPct(count) })),
    recentClicks: (await store.recentClicks(50)).map(({ visitorHash, ...click }) => click),
  };

  res.json(summary);
}));

// RESET ANALYTICS
app.post('/api/analytics/reset', requireAdmin, asyncHandler(async (req, res) => {
  await store.deleteAllClicks();
  await store.deleteAllConversions();
  res.json({ success: true, message: 'Analytics reset to empty live data' });
}));

// =============================================================================
// GLOBAL ERROR HANDLER
// =============================================================================
app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) return next(err);
  const message = err instanceof Error ? err.message : 'Unknown server error';
  console.error(`[${res.locals.correlationId}] Request failed: ${message}`);
  return sendError(res, 500, 'An unexpected server error occurred.');
});

// =============================================================================
// VITE INTEGRATION
// =============================================================================
async function startServer() {
  // =============================================================================
  // BOOT — connect to Postgres, create schema, bootstrap first admin user
  // =============================================================================
  await initDb();
  console.info('[DB] Connected to Postgres and verified schema.');

  // Run the retention purge once at startup and then every 24 hours.
  await runRetentionPurge();
  setInterval(() => {
    runRetentionPurge().catch((err) => console.error('[Retention] Purge failed:', err));
  }, 24 * 60 * 60 * 1000);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.info(`Raccoon Hub server running on http://localhost:${PORT}`);
  });
}

startServer();
