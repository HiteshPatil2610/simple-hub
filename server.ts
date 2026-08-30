import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import helmet from 'helmet';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { createServer as createViteServer } from 'vite';
import { Product, ClickEvent, ConversionEvent, AnalyticsSummary } from './src/types';
import { store, initDb } from './db';

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
// JWT AUTH (replaces single shared OWNER_KEY)
// =============================================================================
// JWT_SECRET is used to sign and verify JSON Web Tokens. Must be set in
// production. Defaults to a random per-process secret in development (which
// means tokens are invalidated on restart — acceptable for local dev).
const JWT_SECRET = process.env.JWT_SECRET?.trim() || (IS_PRODUCTION
  ? (() => { throw new Error('JWT_SECRET must be set in production.'); })()
  : crypto.randomBytes(32).toString('hex')
);

// Token lifetime: 8 hours by default. Override via JWT_EXPIRY env var.
const JWT_EXPIRY = process.env.JWT_EXPIRY || '8h';

// Admin accounts start out defined via one env var — no external auth
// service involved. Format:
//   ADMIN_ACCOUNTS=alice@example.com:somepassword,bob@example.com:anotherpassword
// On boot, each listed account is created ONLY IF it doesn't exist yet.
// Existing accounts are left untouched — once created, a person's password
// lives in the database and is managed via "change password" / "forgot
// password" below, not by this env var. To reset someone back to their
// env-var password, delete their row from the users table and redeploy.
async function seedAdminAccountsFromEnv() {
  const raw = process.env.ADMIN_ACCOUNTS?.trim();
  if (!raw) {
    if (IS_PRODUCTION && (await store.countUsers()) === 0) {
      throw new Error(
        'No users exist and ADMIN_ACCOUNTS is not set. Set ADMIN_ACCOUNTS ' +
        'as "email:password,email:password" to create the initial admin accounts.'
      );
    }
    return;
  }

  const entries = raw.split(',').map(e => e.trim()).filter(Boolean);
  let createdCount = 0;
  for (const entry of entries) {
    const separatorIndex = entry.indexOf(':');
    if (separatorIndex === -1) {
      console.warn(`[AUTH] Skipping malformed ADMIN_ACCOUNTS entry (expected email:password): "${entry}"`);
      continue;
    }
    const email = entry.slice(0, separatorIndex).trim().toLowerCase();
    const password = entry.slice(separatorIndex + 1).trim();
    if (!email || !password) {
      console.warn(`[AUTH] Skipping malformed ADMIN_ACCOUNTS entry (empty email or password): "${entry}"`);
      continue;
    }
    const created = await store.createUserIfMissing(email, password, 'owner');
    if (created) createdCount++;
  }
  if (createdCount > 0) {
    console.info(`[AUTH] Created ${createdCount} new admin account(s) from ADMIN_ACCOUNTS.`);
  }
}

// =============================================================================
// EMAIL (forgot-password OTPs only — Gmail SMTP with an App Password, no
// third-party email service). GMAIL_USER / GMAIL_APP_PASSWORD are required
// only if someone actually uses "forgot password" — the rest of the app
// works fine without them.
// =============================================================================
const GMAIL_USER = process.env.GMAIL_USER?.trim();
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD?.trim();
const mailer = (GMAIL_USER && GMAIL_APP_PASSWORD)
  ? nodemailer.createTransport({
      service: 'gmail',
      auth: { user: GMAIL_USER, pass: GMAIL_APP_PASSWORD },
    })
  : null;

if (!mailer) {
  console.warn('[AUTH] GMAIL_USER/GMAIL_APP_PASSWORD not set — "forgot password" emails will not send.');
}

async function sendOTPEmail(toEmail: string, otp: string) {
  if (!mailer) throw new Error('Email is not configured on this server.');
  await mailer.sendMail({
    from: `Raccoon Hub <${GMAIL_USER}>`,
    to: toEmail,
    subject: `Your password reset code: ${otp}`,
    text: `Your password reset code is ${otp}. It expires in 15 minutes. If you didn't request this, you can ignore this email.`,
    html: `<p>Your password reset code is:</p><p style="font-size:28px;font-weight:bold;letter-spacing:4px;">${otp}</p><p>It expires in 15 minutes. If you didn't request this, you can ignore this email.</p>`,
  });
}

function signToken(userId: string, role: string): string {
  return jwt.sign({ sub: userId, role }, JWT_SECRET, { expiresIn: JWT_EXPIRY as any });
}

function requireAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return sendError(res, 401, 'Authorization header with Bearer token required.');
  }
  try {
    const payload = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
    res.locals.userId = payload.sub;
    res.locals.userRole = payload.role;
    next();
  } catch {
    return sendError(res, 401, 'Invalid or expired token. Please log in again.');
  }
}

// Keep OWNER_KEY support as a legacy fallback so existing integrations
// continue to work. Prefer JWT for new sessions.
const LEGACY_OWNER_KEY = process.env.OWNER_KEY?.trim() || '';

// =============================================================================
// SECURITY MIDDLEWARE
// =============================================================================
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
      connectSrc: ["'self'", 'ws:'],
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
const loginLimiter     = createRateLimiter(60_000, 5);    // 5 login attempts/min/IP
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

app.post('/api/upload', requireAuth, uploadLimiter, (req, res) => {
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

// POST /api/auth/login — exchange email+password for a JWT. Accounts are
// defined via the ADMIN_ACCOUNTS env var (see seedAdminAccountsFromEnv) —
// there's no self-service sign-up.
app.post('/api/auth/login', loginLimiter, asyncHandler(async (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password || typeof username !== 'string' || typeof password !== 'string') {
    return sendError(res, 400, 'Email and password are required.');
  }

  const user = await store.getUserByUsername(username.trim().toLowerCase());
  if (!user || !store.verifyPassword(password, user.passwordHash, user.salt)) {
    return sendError(res, 401, 'Invalid email or password.');
  }

  const token = signToken(user.id, user.role);
  res.json({ token, username: user.username, role: user.role, expiresIn: JWT_EXPIRY });
}));

// POST /api/auth/change-password — for a logged-in admin to change their own
// password. Requires the current password to prevent someone with a stolen,
// still-valid JWT from locking the real owner out.
app.post('/api/auth/change-password', requireAuth, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (!currentPassword || !newPassword || typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
    return sendError(res, 400, 'currentPassword and newPassword are required.');
  }
  if (newPassword.length < 8) {
    return sendError(res, 400, 'New password must be at least 8 characters.');
  }

  const user = await store.getUserByIdWithHash(res.locals.userId);
  if (!user) return sendError(res, 404, 'User not found.');
  if (!store.verifyPassword(currentPassword, user.passwordHash, user.salt)) {
    return sendError(res, 401, 'Current password is incorrect.');
  }

  await store.updateUserPassword(user.id, newPassword);
  res.json({ success: true, message: 'Password changed.' });
}));

// POST /api/auth/forgot-password — emails a one-time 6-digit code (15 min
// expiry) if the email belongs to an admin account. Always responds success
// either way, so this can't be used to find out which emails have accounts.
app.post('/api/auth/forgot-password', loginLimiter, asyncHandler(async (req, res) => {
  const { email } = req.body || {};
  if (!email || typeof email !== 'string') {
    return sendError(res, 400, 'Email is required.');
  }
  const normalizedEmail = email.trim().toLowerCase();
  const user = await store.getUserByUsername(normalizedEmail);

  if (user) {
    const otp = crypto.randomInt(0, 1_000_000).toString().padStart(6, '0');
    await store.setPasswordResetOTP(normalizedEmail, otp, 15);
    try {
      await sendOTPEmail(normalizedEmail, otp);
    } catch (err) {
      console.error('[AUTH] Failed to send password reset email:', err);
      // Don't reveal the send failure to the client — same generic response.
    }
  }

  res.json({ success: true, message: 'If that email has an account, a reset code has been sent.' });
}));

// POST /api/auth/reset-password — completes a forgot-password flow: email +
// the 6-digit code + a new password. Single-use; locks after 5 wrong guesses
// (request a fresh code to try again).
app.post('/api/auth/reset-password', loginLimiter, asyncHandler(async (req, res) => {
  const { email, otp, newPassword } = req.body || {};
  if (!email || !otp || !newPassword || typeof email !== 'string' || typeof otp !== 'string' || typeof newPassword !== 'string') {
    return sendError(res, 400, 'email, otp, and newPassword are required.');
  }
  if (newPassword.length < 8) {
    return sendError(res, 400, 'New password must be at least 8 characters.');
  }

  const normalizedEmail = email.trim().toLowerCase();
  const result = await store.verifyPasswordResetOTP(normalizedEmail, otp.trim());

  if (result === 'too_many_attempts') {
    return sendError(res, 429, 'Too many incorrect attempts. Request a new code.');
  }
  if (result === 'expired') {
    return sendError(res, 400, 'That code has expired. Request a new one.');
  }
  if (result === 'invalid' || result === 'not_found') {
    return sendError(res, 400, 'Incorrect or expired code.');
  }

  const user = await store.getUserByUsername(normalizedEmail);
  if (!user) return sendError(res, 400, 'Incorrect or expired code.');

  await store.updateUserPassword(user.id, newPassword);
  await store.deletePasswordResetOTP(normalizedEmail);
  res.json({ success: true, message: 'Password reset. You can now log in.' });
}));

// GET /api/auth/me — return the currently authenticated user
app.get('/api/auth/me', requireAuth, asyncHandler(async (req, res) => {
  const user = await store.getUserById(res.locals.userId);
  if (!user) return sendError(res, 404, 'User not found.');
  res.json({ id: user.id, username: user.username, role: user.role });
}));

// Legacy passcode verify — kept for backwards compatibility with old clients.
// New clients should use POST /api/auth/login instead.
app.post('/api/owner/verify', loginLimiter, (req, res) => {
  // Accept either JWT (Authorization header) or legacy x-owner-key header.
  const authHeader = req.headers['authorization'];
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (bearerToken) {
    try {
      jwt.verify(bearerToken, JWT_SECRET);
      return res.json({ success: true });
    } catch {
      return sendError(res, 401, 'Invalid or expired token.');
    }
  }
  const legacyKey = req.headers['x-owner-key'];
  if (LEGACY_OWNER_KEY && legacyKey === LEGACY_OWNER_KEY) {
    return res.json({ success: true, protected: true });
  }
  return sendError(res, 401, 'Unauthorized. Provide a valid Bearer token or x-owner-key header.');
});

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
app.post('/api/products', requireAuth, asyncHandler(async (req, res) => {
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
app.put('/api/products/:id', requireAuth, asyncHandler(async (req, res) => {
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
app.delete('/api/products/:id', requireAuth, asyncHandler(async (req, res) => {
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
app.post('/api/analytics/conversion', requireAuth, asyncHandler(async (req, res) => {
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
app.get('/api/analytics', requireAuth, asyncHandler(async (req, res) => {
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
app.post('/api/analytics/reset', requireAuth, asyncHandler(async (req, res) => {
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

  await seedAdminAccountsFromEnv();

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
