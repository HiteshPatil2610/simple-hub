import 'dotenv/config';
import express from 'express';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import helmet from 'helmet';
import { createServer as createViteServer } from 'vite';
import { Product, ClickEvent, ConversionEvent, AnalyticsSummary } from './src/types';

const app = express();
const configuredPort = Number.parseInt(process.env.PORT || '3000', 10);
const PORT = Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : 3000;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Trust the first proxy hop (Cloud Run / Render / Railway / nginx, etc.) so
// req.ip reflects the real client IP instead of the proxy's IP. Needed for
// rate limiting and visitor-hash uniqueness to work correctly behind a proxy.
app.set('trust proxy', 1);

// 12mb is enough for a compressed product photo as base64; the old 50mb
// limit applied to EVERY route (not just uploads) and was an easy memory-
// exhaustion DoS vector.
app.use(express.json({ limit: '12mb' }));
app.use(express.urlencoded({ extended: true, limit: '12mb' }));

// ================= OWNER AUTH =================
// The Owner Control Hub (add/edit/delete products, image upload, analytics
// reset) previously had NO server-side protection at all -- anyone who
// discovered the API routes (not just the #admin URL) could modify the
// storefront or wipe analytics. Set OWNER_KEY in the environment before
// starting the server; protected routes fail closed when it is missing.
const OWNER_KEY = process.env.OWNER_KEY?.trim() || '';

if (IS_PRODUCTION && !OWNER_KEY) {
  throw new Error('OWNER_KEY must be set before starting in production.');
}

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'https:'],
      connectSrc: ["'self'", 'ws:'],
      fontSrc: ["'self'", 'data:'],
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

function requireOwnerAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!OWNER_KEY) {
    return sendError(res, 503, 'Owner authentication is not configured.');
  }
  const providedKey = req.headers['x-owner-key'];
  if (providedKey && providedKey === OWNER_KEY) {
    return next();
  }
  return sendError(res, 401, 'Unauthorized. Provide a valid x-owner-key header.');
}

// ================= LIGHTWEIGHT RATE LIMITING =================
// A minimal in-memory sliding-window limiter. Not a substitute for a real
// rate limiter (e.g. behind multiple server instances the counts reset per
// instance), but it stops trivial single-process click-fraud / upload-spam
// scripts without adding a new dependency.
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

const redirectLimiter = createRateLimiter(60_000, 60); // 60 redirects/min/IP
const uploadLimiter = createRateLimiter(60_000, 20); // 20 uploads/min/IP
const trackLimiter = createRateLimiter(60_000, 120); // 120 beacon calls/min/IP
const ownerVerifyLimiter = createRateLimiter(60_000, 5); // 5 owner-key attempts/min/IP

const DATA_DIR = path.join(process.cwd(), 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const UPLOADS_DIR = path.join(process.cwd(), 'public', 'uploads');
if (!fs.existsSync(UPLOADS_DIR)) {
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}
app.use('/uploads', express.static(UPLOADS_DIR));

const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const CLICKS_FILE = path.join(DATA_DIR, 'clicks.json');
const CONVERSIONS_FILE = path.join(DATA_DIR, 'conversions.json');

// Initial seed products inspired by sillycorns.shop
const INITIAL_PRODUCTS: Product[] = [
  {
    id: 'prod-1',
    title: 'Floating Cloud Magnetic Levitating Lamp with RGB Glow',
    description: 'A mesmerizing desk centerpiece that floats in mid-air using magnetic levitation. Features warm glow and soothing color shifts with gentle tap controls.',
    category: 'Desk & Tech',
    price: 49.99,
    originalPrice: 79.99,
    rating: 4.9,
    reviewCount: 3840,
    imageUrl: 'https://images.unsplash.com/photo-1517991104123-1d56a6e81ed9?w=800&auto=format&fit=crop&q=80',
    platform: 'Amazon',
    affiliateUrl: 'https://www.amazon.com/dp/B08XYZ1234',
    affiliateTag: 'sillycorns-20',
    badge: 'TikTok Viral 🔥',
    featured: true,
    commissionRate: 8,
    createdAt: new Date(Date.now() - 30 * 86400000).toISOString(),
  },
  {
    id: 'prod-2',
    title: 'Capybara Soft Silicone Touch Tap Night Light',
    description: 'Squishable, soothing, and ultra-chill capybara LED light with 2 brightness levels and automatic 20-minute sleep timer. The internet’s favorite animal for your bedside.',
    category: 'Cute & Whimsical',
    price: 19.99,
    originalPrice: 28.50,
    rating: 4.9,
    reviewCount: 5120,
    imageUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?w=800&auto=format&fit=crop&q=80',
    platform: 'TikTok Shop',
    affiliateUrl: 'https://www.tiktok.com/view/product/capybara-lamp',
    affiliateTag: 'tiktok-creator-finds',
    badge: 'Best Seller 🏆',
    featured: true,
    commissionRate: 12,
    createdAt: new Date(Date.now() - 25 * 86400000).toISOString(),
  },
  {
    id: 'prod-3',
    title: 'Astronaut Galaxy Star Nebula Projector with Remote',
    description: 'Transforms your room into an infinite starry cosmos with 8 nebula color modes, adjustable 360° magnetic astronaut head, and timer control.',
    category: 'Quirky Home Decor',
    price: 29.95,
    originalPrice: 45.00,
    rating: 4.8,
    reviewCount: 8940,
    imageUrl: 'https://images.unsplash.com/photo-1506703719100-a0f3a48c0f86?w=800&auto=format&fit=crop&q=80',
    platform: 'Amazon',
    affiliateUrl: 'https://www.amazon.com/dp/B09ASTR001',
    affiliateTag: 'sillycorns-20',
    badge: '50k+ Sold ✨',
    featured: true,
    commissionRate: 6,
    createdAt: new Date(Date.now() - 22 * 86400000).toISOString(),
  },
  {
    id: 'prod-4',
    title: 'Giant Clicky Mechanical Key Switch Fidget Keychain',
    description: 'Satisfying jumbo blue clicky tactile switch with dynamic RGB backlight. Instant stress relief for keyboard geeks and fidgeters during long work meetings.',
    category: 'Desk Toys & Fidgets',
    price: 12.99,
    originalPrice: 16.99,
    rating: 4.7,
    reviewCount: 1420,
    imageUrl: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800&auto=format&fit=crop&q=80',
    platform: 'AliExpress',
    affiliateUrl: 'https://www.aliexpress.com/item/10050098234.html',
    affiliateTag: 'silly_ali_partner',
    badge: 'Under $15 💡',
    featured: false,
    commissionRate: 10,
    createdAt: new Date(Date.now() - 18 * 86400000).toISOString(),
  },
  {
    id: 'prod-5',
    title: 'Self-Stirring Automatic Magnetic Stainless Mug',
    description: 'Never hunt for a spoon again. Spins at 7000 RPM with a magnetic capsule pill to effortlessly mix protein shakes, matcha, hot cocoa, and bulletproof coffee.',
    category: 'Cool Tech Gadgets',
    price: 22.50,
    originalPrice: 32.00,
    rating: 4.6,
    reviewCount: 2890,
    imageUrl: 'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=800&auto=format&fit=crop&q=80',
    platform: 'Amazon',
    affiliateUrl: 'https://www.amazon.com/dp/B07SELFSTIR',
    affiliateTag: 'sillycorns-20',
    badge: 'Viral TikTok 🔥',
    featured: true,
    commissionRate: 7,
    createdAt: new Date(Date.now() - 15 * 86400000).toISOString(),
  },
  {
    id: 'prod-6',
    title: 'Spaghetti Monster Quirky Kitchen Colander & Strainer',
    description: 'The iconic culinary monster with googly eye handles. Heat-resistant BPA-free food strainer that brings pure joy and smiles to everyday pasta nights.',
    category: 'Quirky Home Decor',
    price: 16.99,
    originalPrice: 24.99,
    rating: 4.9,
    reviewCount: 4230,
    imageUrl: 'https://images.unsplash.com/photo-1551183053-bf91a1d81141?w=800&auto=format&fit=crop&q=80',
    platform: 'Etsy',
    affiliateUrl: 'https://www.etsy.com/listing/spaghetti-monster-colander',
    affiliateTag: 'etsy_curator_id',
    badge: 'Staff Pick 🌟',
    featured: false,
    commissionRate: 5,
    createdAt: new Date(Date.now() - 12 * 86400000).toISOString(),
  },
  {
    id: 'prod-7',
    title: 'Pocket Mini Thermal Inkless Photo & Sticker Printer',
    description: 'Zero ink required! Connects via Bluetooth to print instant cute stickers, to-do checklists, study notes, labels, and vintage black-and-white photos on the go.',
    category: 'Cool Tech Gadgets',
    price: 34.99,
    originalPrice: 49.99,
    rating: 4.8,
    reviewCount: 6190,
    imageUrl: 'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=800&auto=format&fit=crop&q=80',
    platform: 'TikTok Shop',
    affiliateUrl: 'https://www.tiktok.com/view/product/thermal-printer',
    affiliateTag: 'tiktok-creator-finds',
    badge: 'Trending Now 🚀',
    featured: true,
    commissionRate: 14,
    createdAt: new Date(Date.now() - 10 * 86400000).toISOString(),
  },
  {
    id: 'prod-8',
    title: 'Tiny Hands Finger Puppets (Pack of 10 for Pets & Pranks)',
    description: 'The undisputed king of meme videos. Miniature hands that slip onto your fingers for hilarious pet videos, high-fives, and TikTok comedy sketches.',
    category: 'Gifts & Novelties',
    price: 9.99,
    originalPrice: 14.99,
    rating: 4.9,
    reviewCount: 12400,
    imageUrl: 'https://images.unsplash.com/photo-1563245372-f21724e3856d?w=800&auto=format&fit=crop&q=80',
    platform: 'Amazon',
    affiliateUrl: 'https://www.amazon.com/dp/B07TINYHANDS',
    affiliateTag: 'sillycorns-20',
    badge: 'Meme Legend 😂',
    featured: false,
    commissionRate: 5,
    createdAt: new Date(Date.now() - 8 * 86400000).toISOString(),
  },
  {
    id: 'prod-9',
    title: 'Retro 80s Cassette Tape Wireless Bluetooth Speaker',
    description: 'Nostalgic transparent tape cassette casing packed with surprisingly punchy bass, 8-hour battery, and magnetic cassette box display case.',
    category: 'Cool Tech Gadgets',
    price: 27.99,
    originalPrice: 38.00,
    rating: 4.7,
    reviewCount: 1980,
    imageUrl: 'https://images.unsplash.com/photo-1545454675-3531b543be5d?w=800&auto=format&fit=crop&q=80',
    platform: 'Amazon',
    affiliateUrl: 'https://www.amazon.com/dp/B08RETROSPEAKER',
    affiliateTag: 'sillycorns-20',
    badge: 'Aesthetic 📻',
    featured: false,
    commissionRate: 8,
    createdAt: new Date(Date.now() - 5 * 86400000).toISOString(),
  },
  {
    id: 'prod-10',
    title: 'Kawaii Toasted Bread Plushie Crossbody Bag',
    description: 'Adorably grumpy smiling toast with dangling butter pad and adjustable strap. Carries phone, keys, lip gloss, and guaranteed compliments wherever you walk.',
    category: 'Cute & Whimsical',
    price: 18.50,
    originalPrice: 25.00,
    rating: 4.9,
    reviewCount: 3100,
    imageUrl: 'https://images.unsplash.com/photo-1584917865442-de89df76afd3?w=800&auto=format&fit=crop&q=80',
    platform: 'TikTok Shop',
    affiliateUrl: 'https://www.tiktok.com/view/product/toast-plush-bag',
    affiliateTag: 'tiktok-creator-finds',
    badge: 'Cute Alert 🍞',
    featured: false,
    commissionRate: 12,
    createdAt: new Date(Date.now() - 4 * 86400000).toISOString(),
  },
  {
    id: 'prod-11',
    title: 'Mini Desktop Wooden Bowling Alley Alley Game Set',
    description: 'Solid wood miniature bowling lane with adjustable metal launcher ramp and 10 weighted pins. Perfect micro-break diversion for desks and office tournaments.',
    category: 'Desk Toys & Fidgets',
    price: 15.99,
    originalPrice: 22.99,
    rating: 4.6,
    reviewCount: 1650,
    imageUrl: 'https://images.unsplash.com/photo-1544717305-2782549b5136?w=800&auto=format&fit=crop&q=80',
    platform: 'Amazon',
    affiliateUrl: 'https://www.amazon.com/dp/B07MINIBOWL',
    affiliateTag: 'sillycorns-20',
    badge: 'Desk Fun 🎳',
    featured: false,
    commissionRate: 6,
    createdAt: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'prod-12',
    title: 'Screaming Rubber Chicken Stress Reliever Keyring',
    description: 'The timeless classic squawker in portable keychain form. Produces an unmistakably loud, hilarious shriek that diffuses tension immediately.',
    category: 'Gifts & Novelties',
    price: 7.99,
    originalPrice: 11.99,
    rating: 4.8,
    reviewCount: 7800,
    imageUrl: 'https://images.unsplash.com/photo-1566576912321-d58ddd7a6088?w=800&auto=format&fit=crop&q=80',
    platform: 'AliExpress',
    affiliateUrl: 'https://www.aliexpress.com/item/1005001239847.html',
    affiliateTag: 'silly_ali_partner',
    badge: 'Under $10 🐔',
    featured: false,
    commissionRate: 10,
    createdAt: new Date(Date.now() - 1 * 86400000).toISOString(),
  },
];

// In-memory data store with file persistence
let products: Product[] = [];
let clicks: ClickEvent[] = [];
let conversions: ConversionEvent[] = [];

function loadData() {
  try {
    if (fs.existsSync(PRODUCTS_FILE)) {
      products = JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf-8'));
    } else {
      products = [...INITIAL_PRODUCTS];
      fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
    }
  } catch (err) {
    console.error('Error loading products, using defaults');
    products = [...INITIAL_PRODUCTS];
  }

  try {
    if (fs.existsSync(CLICKS_FILE)) {
      clicks = JSON.parse(fs.readFileSync(CLICKS_FILE, 'utf-8'));
    } else {
      clicks = generateSeedClicks();
      fs.writeFileSync(CLICKS_FILE, JSON.stringify(clicks, null, 2));
    }
  } catch (err) {
    console.error('Error loading clicks');
    clicks = generateSeedClicks();
  }

  try {
    if (fs.existsSync(CONVERSIONS_FILE)) {
      conversions = JSON.parse(fs.readFileSync(CONVERSIONS_FILE, 'utf-8'));
    } else {
      conversions = generateSeedConversions(clicks);
      fs.writeFileSync(CONVERSIONS_FILE, JSON.stringify(conversions, null, 2));
    }
  } catch (err) {
    console.error('Error loading conversions');
    conversions = [];
  }
}

function saveData() {
  try {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(products, null, 2));
    fs.writeFileSync(CLICKS_FILE, JSON.stringify(clicks, null, 2));
    fs.writeFileSync(CONVERSIONS_FILE, JSON.stringify(conversions, null, 2));
  } catch (err) {
    console.error('Error saving data');
  }
}

function generateSeedClicks(): ClickEvent[] {
  const referrers = ['tiktok.com', 'instagram.com', 'pinterest.com', 'youtube.com', 'direct', 'google.com'];
  const devices: ('Mobile' | 'Desktop' | 'Tablet')[] = ['Mobile', 'Mobile', 'Mobile', 'Desktop', 'Desktop', 'Tablet'];
  const generated: ClickEvent[] = [];
  const now = Date.now();

  // Generate around 180 realistic clicks across the last 14 days
  for (let i = 0; i < 180; i++) {
    const randomProduct = INITIAL_PRODUCTS[Math.floor(Math.random() * INITIAL_PRODUCTS.length)];
    // bias toward recent days
    const dayOffset = Math.floor(Math.pow(Math.random(), 1.5) * 14);
    const hourOffset = Math.floor(Math.random() * 24);
    const minuteOffset = Math.floor(Math.random() * 60);
    const timestamp = new Date(now - (dayOffset * 86400000 + hourOffset * 3600000 + minuteOffset * 60000)).toISOString();
    const referrer = referrers[Math.floor(Math.random() * referrers.length)];
    const device = devices[Math.floor(Math.random() * devices.length)];

    generated.push({
      id: `click-${i + 1}`,
      productId: randomProduct.id,
      productTitle: randomProduct.title,
      productPrice: randomProduct.price,
      platform: randomProduct.platform,
      category: randomProduct.category,
      timestamp,
      referrer,
      device,
      utmSource: referrer === 'direct' ? undefined : referrer.split('.')[0],
      utmMedium: 'affiliate_link',
      utmCampaign: 'viral_curation',
      destinationUrl: buildAffiliateRedirectUrl(randomProduct, { utm_source: referrer.split('.')[0] }),
    });
  }

  // Sort descending by timestamp
  return generated.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
}

function generateSeedConversions(initialClicks: ClickEvent[]): ConversionEvent[] {
  const convs: ConversionEvent[] = [];
  // Sample conversion rate roughly 8-12%
  initialClicks.forEach((click, index) => {
    if (index % 9 === 0) {
      const commRate = 0.08;
      const orderVal = click.productPrice * (Math.random() > 0.6 ? 2 : 1);
      convs.push({
        id: `conv-${convs.length + 1}`,
        clickId: click.id,
        productId: click.productId,
        productTitle: click.productTitle,
        orderValue: Number(orderVal.toFixed(2)),
        commissionEarned: Number((orderVal * commRate).toFixed(2)),
        timestamp: new Date(new Date(click.timestamp).getTime() + 15 * 60000).toISOString(),
        platform: click.platform,
      });
    }
  });
  return convs;
}

// Build URL ensuring direct affiliate links and tracking parameters
export function buildAffiliateRedirectUrl(
  product: Product,
  params: { utm_source?: string; utm_medium?: string; utm_campaign?: string; subid?: string } = {}
): string {
  try {
    const rawUrl = (product.affiliateUrl || '').trim();
    if (!rawUrl) return 'https://www.amazon.com';

    // Direct Amazon short links (amzn.to/xxx) or custom affiliate links should NOT be modified
    if (rawUrl.includes('amzn.to/')) {
      return rawUrl;
    }

    const urlObj = new URL(rawUrl);

    // If user provided an affiliate link that already has tag in query, keep it intact!
    if (urlObj.searchParams.has('tag')) {
      return urlObj.toString();
    }

    // Apply platform specific affiliate tag if configured
    const tag = product.affiliateTag || 'raccoonhub-20';
    urlObj.searchParams.set('tag', tag);

    // Apply UTM tracking
    if (params.utm_source) urlObj.searchParams.set('utm_source', params.utm_source);
    if (params.utm_medium) urlObj.searchParams.set('utm_medium', params.utm_medium);
    if (params.utm_campaign) urlObj.searchParams.set('utm_campaign', params.utm_campaign);
    if (params.subid || product.customSubId) {
      urlObj.searchParams.set('subid', params.subid || product.customSubId || 'raccoonhub');
    }

    return urlObj.toString();
  } catch (err) {
    return product.affiliateUrl || 'https://www.amazon.com';
  }
}

// Allowlist of accepted image types. SVG is deliberately excluded: an SVG
// can carry inline <script>, which becomes stored XSS the moment anyone
// (e.g. the owner) opens the uploaded file directly in a browser tab.
const ALLOWED_UPLOAD_TYPES: Record<string, string> = {
  jpeg: 'jpg',
  jpg: 'jpg',
  png: 'png',
  gif: 'gif',
  webp: 'webp',
};
const MAX_UPLOAD_BYTES = 8 * 1024 * 1024; // 8mb decoded

// Upload image from device storage (receives base64 dataUrl, stores in /public/uploads/, returns URL)
app.post('/api/upload', requireOwnerAuth, uploadLimiter, (req, res) => {
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

    const cleanName = filename
      ? filename.replace(/[^a-zA-Z0-9_-]/g, '').substring(0, 30)
      : 'device-photo';
    const uniqueName = `upload-${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${cleanName}.${ext}`;
    const targetPath = path.join(UPLOADS_DIR, uniqueName);

    fs.writeFileSync(targetPath, buffer);
    const publicUrl = `/uploads/${uniqueName}`;

    res.json({ imageUrl: publicUrl, success: true });
  } catch (err: any) {
    console.error('Image upload failed');
    sendError(res, 500, 'Failed to process and store image upload');
  }
});

// Builds a stable-but-anonymous per-day fingerprint from IP + User-Agent so
// we can count unique clickers without storing raw IPs or using cookies.
// Previously "uniqueVisitors" was entirely fabricated as totalClicks * 0.72
// despite the docs promising real session-based uniqueness -- this makes it
// real, at day-level granularity.
function getVisitorHash(req: express.Request): string {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const ua = req.headers['user-agent'] || 'unknown';
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

loadData();

// ================= API ENDPOINTS =================

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), productCount: products.length });
});

// Verify an owner key from the client-side login gate.
app.post('/api/owner/verify', ownerVerifyLimiter, requireOwnerAuth, (req, res) => {
  res.json({ success: true, protected: Boolean(OWNER_KEY) });
});

// GET all products
app.get('/api/products', (req, res) => {
  const { category, search, platform, featured } = req.query;
  let filtered = [...products];

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
});

// GET single product
app.get('/api/products/:id', (req, res) => {
  const product = products.find(p => p.id === req.params.id);
  if (!product) {
    return sendError(res, 404, 'Product not found');
  }
  res.json(product);
});

// POST add product
app.post('/api/products', requireOwnerAuth, (req, res) => {
  const {
    title,
    description,
    category,
    price,
    originalPrice,
    rating,
    reviewCount,
    imageUrl,
    platform,
    affiliateUrl,
    affiliateTag,
    customSubId,
    badge,
    featured,
    commissionRate,
  } = req.body;

  if (!title || !price || !affiliateUrl) {
    return sendError(res, 400, 'Title, price, and affiliate URL are required.');
  }

  const newProduct: Product = {
    id: `prod-${Date.now()}`,
    title: String(title).trim(),
    description: String(description || '').trim(),
    category: String(category || 'Viral Finds').trim(),
    price: parseFloat(price) || 0,
    originalPrice: originalPrice ? parseFloat(originalPrice) : undefined,
    rating: parseFloat(rating) || 5.0,
    reviewCount: parseInt(reviewCount, 10) || 1,
    imageUrl: String(imageUrl || 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=800&auto=format&fit=crop&q=80').trim(),
    platform: platform || 'Amazon',
    affiliateUrl: String(affiliateUrl).trim(),
    affiliateTag: affiliateTag ? String(affiliateTag).trim() : 'raccoonhub-20',
    customSubId: customSubId ? String(customSubId).trim() : undefined,
    badge: badge ? String(badge).trim() : undefined,
    featured: Boolean(featured),
    commissionRate: commissionRate ? parseFloat(commissionRate) : 6,
    createdAt: new Date().toISOString(),
  };

  products.unshift(newProduct);
  saveData();

  res.status(201).json(newProduct);
});

// Fields an owner is allowed to change via PUT. Using an explicit allowlist
// (instead of spreading the whole request body onto the stored record)
// stops a caller from injecting unexpected fields, and keeps the same
// type-coercion / validation the POST route applies.
const UPDATABLE_PRODUCT_FIELDS = [
  'title', 'description', 'category', 'price', 'originalPrice', 'rating',
  'reviewCount', 'imageUrl', 'platform', 'affiliateUrl', 'affiliateTag',
  'customSubId', 'badge', 'featured', 'commissionRate',
] as const;

// PUT update product
app.put('/api/products/:id', requireOwnerAuth, (req, res) => {
  const index = products.findIndex(p => p.id === req.params.id);
  if (index === -1) {
    return sendError(res, 404, 'Product not found');
  }

  const existing = products[index];
  const body = req.body || {};
  const updated: Product = { ...existing };

  for (const field of UPDATABLE_PRODUCT_FIELDS) {
    if (!(field in body)) continue;
    switch (field) {
      case 'price':
      case 'originalPrice':
      case 'rating':
      case 'commissionRate': {
        const num = parseFloat(body[field]);
        if (!Number.isNaN(num)) (updated as any)[field] = num;
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
      default:
        (updated as any)[field] = typeof body[field] === 'string' ? body[field].trim() : body[field];
    }
  }
  updated.id = existing.id; // id is never overridable

  products[index] = updated;
  saveData();

  res.json(updated);
});

// DELETE product
app.delete('/api/products/:id', requireOwnerAuth, (req, res) => {
  const initialLength = products.length;
  products = products.filter(p => p.id !== req.params.id);
  if (products.length === initialLength) {
    return sendError(res, 404, 'Product not found');
  }
  saveData();
  res.json({ success: true, message: 'Product deleted' });
});

// REDIRECT ENDPOINT: /api/redirect/:id or /r/:id
// Seamlessly logs click and redirects user to target affiliate URL
app.get(['/api/redirect/:id', '/r/:id'], redirectLimiter, (req, res) => {
  const product = products.find(p => p.id === req.params.id);
  if (!product) {
    return sendError(res, 404, 'Product link not found.');
  }

  const userAgent = req.headers['user-agent'] || '';
  const referrerHeader = req.headers['referer'] || req.query.ref || 'direct';
  const referrer = typeof referrerHeader === 'string' ? referrerHeader : 'direct';

  const utmSource = (req.query.utm_source as string) || (referrer.includes('tiktok') ? 'tiktok' : referrer.includes('instagram') ? 'instagram' : 'raccoonhub');
  const utmMedium = (req.query.utm_medium as string) || 'affiliate_redirect';
  const utmCampaign = (req.query.utm_campaign as string) || 'curated_finds';
  const subid = (req.query.subid as string) || product.customSubId || 'raccoonhub';

  const finalUrl = buildAffiliateRedirectUrl(product, {
    utm_source: utmSource,
    utm_medium: utmMedium,
    utm_campaign: utmCampaign,
    subid,
  });

  const clickEvent: ClickEvent = {
    id: `click-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    productId: product.id,
    productTitle: product.title,
    productPrice: product.price,
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

  clicks.unshift(clickEvent);
  saveData();

  // If request expects JSON (for client-side open in new tab with stats)
  if (req.query.format === 'json') {
    return res.json({
      success: true,
      clickId: clickEvent.id,
      destinationUrl: finalUrl,
    });
  }

  // HTTP 302 standard redirect directly to affiliate destination
  res.redirect(302, finalUrl);
});

// CLIENT TRACKING BEACON: /api/track/click
app.post('/api/track/click', trackLimiter, (req, res) => {
  const { productId, utmSource, utmMedium, utmCampaign, subid, referrer } = req.body;
  const product = products.find(p => p.id === productId);

  if (!product) {
    return sendError(res, 404, 'Product not found');
  }

  const userAgent = req.headers['user-agent'] || '';
  const finalUrl = buildAffiliateRedirectUrl(product, {
    utm_source: utmSource || 'storefront',
    utm_medium: utmMedium || 'affiliate_card',
    utm_campaign: utmCampaign || 'viral_curation',
    subid: subid || product.customSubId,
  });

  const clickEvent: ClickEvent = {
    id: `click-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    productId: product.id,
    productTitle: product.title,
    productPrice: product.price,
    platform: product.platform,
    category: product.category,
    timestamp: new Date().toISOString(),
    referrer: normalizeReferrer(referrer),
    device: parseDevice(userAgent),
    utmSource: utmSource || 'storefront',
    utmMedium: utmMedium || 'affiliate_card',
    utmCampaign: utmCampaign || 'viral_curation',
    destinationUrl: finalUrl,
    visitorHash: getVisitorHash(req),
  };

  clicks.unshift(clickEvent);
  saveData();

  res.json({
    success: true,
    clickId: clickEvent.id,
    destinationUrl: finalUrl,
  });
});

// RECORD CONVERSION (Simulation / affiliate callback)
app.post('/api/analytics/conversion', requireOwnerAuth, (req, res) => {
  const { productId, orderValue, commissionEarned, clickId } = req.body;
  const product = products.find(p => p.id === productId);

  if (!product) {
    return sendError(res, 404, 'Product not found');
  }

  const val = parseFloat(orderValue) || product.price;
  const commRate = (product.commissionRate || 6) / 100;
  const comm = commissionEarned !== undefined ? parseFloat(commissionEarned) : val * commRate;

  const convEvent: ConversionEvent = {
    id: `conv-${Date.now()}`,
    clickId: clickId || undefined,
    productId: product.id,
    productTitle: product.title,
    orderValue: Number(val.toFixed(2)),
    commissionEarned: Number(comm.toFixed(2)),
    timestamp: new Date().toISOString(),
    platform: product.platform,
  };

  conversions.unshift(convEvent);
  saveData();

  res.status(201).json(convEvent);
});

function getClicksToday(): number {
  const todayStr = new Date().toISOString().split('T')[0];
  return clicks.filter(c => c.timestamp.startsWith(todayStr)).length;
}

// Public analytics are limited to a non-identifying aggregate.
app.get('/api/analytics/public', (req, res) => {
  res.json({ clicksToday: getClicksToday() });
});

// GET ANALYTICS SUMMARY (owner-only because it contains click telemetry)
app.get('/api/analytics', requireOwnerAuth, (req, res) => {
  const totalClicks = clicks.length;
  const hashedClicks = clicks.filter(c => c.visitorHash);
  const uniqueVisitors = hashedClicks.length > 0
    ? new Set(hashedClicks.map(c => c.visitorHash)).size
    : Math.round(totalClicks * 0.72) || totalClicks; // fallback estimate for pre-existing seed data with no visitorHash
  const totalConversions = conversions.length;
  const conversionRate = totalClicks > 0 ? Number(((totalConversions / totalClicks) * 100).toFixed(1)) : 0;

  const estimatedGrossVolume = conversions.reduce((sum, c) => sum + c.orderValue, 0);
  const estimatedCommission = conversions.reduce((sum, c) => sum + c.commissionEarned, 0);

  const clicksToday = getClicksToday();

  // Clicks by day (last 14 days)
  const daysMap = new Map<string, { clicks: number; conversions: number }>();
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const dateKey = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    daysMap.set(dateKey, { clicks: 0, conversions: 0 });
  }

  clicks.forEach(c => {
    const d = new Date(c.timestamp);
    const dateKey = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (daysMap.has(dateKey)) {
      daysMap.get(dateKey)!.clicks += 1;
    }
  });

  conversions.forEach(c => {
    const d = new Date(c.timestamp);
    const dateKey = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    if (daysMap.has(dateKey)) {
      daysMap.get(dateKey)!.conversions += 1;
    }
  });

  const clicksByDay = Array.from(daysMap.entries()).map(([date, data]) => ({
    date,
    clicks: data.clicks,
    conversions: data.conversions,
  }));

  // Top products
  const productClickMap = new Map<string, { clicks: number; conversions: number }>();
  clicks.forEach(c => {
    const existing = productClickMap.get(c.productId) || { clicks: 0, conversions: 0 };
    existing.clicks += 1;
    productClickMap.set(c.productId, existing);
  });

  conversions.forEach(c => {
    const existing = productClickMap.get(c.productId) || { clicks: 0, conversions: 0 };
    existing.conversions += 1;
    productClickMap.set(c.productId, existing);
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
        price: p.price,
      };
    })
    .sort((a, b) => b.clicks - a.clicks);

  // Platform breakdown
  const platformCounts: Record<string, number> = {};
  clicks.forEach(c => {
    platformCounts[c.platform] = (platformCounts[c.platform] || 0) + 1;
  });

  const platformBreakdown = Object.entries(platformCounts).map(([platform, count]) => ({
    platform,
    clicks: count,
    percentage: totalClicks > 0 ? Number(((count / totalClicks) * 100).toFixed(1)) : 0,
  }));

  // Category breakdown
  const categoryCounts: Record<string, number> = {};
  clicks.forEach(c => {
    categoryCounts[c.category] = (categoryCounts[c.category] || 0) + 1;
  });

  const categoryBreakdown = Object.entries(categoryCounts).map(([category, count]) => ({
    category,
    clicks: count,
    percentage: totalClicks > 0 ? Number(((count / totalClicks) * 100).toFixed(1)) : 0,
  }));

  // Device breakdown
  const deviceCounts: Record<string, number> = {};
  clicks.forEach(c => {
    deviceCounts[c.device] = (deviceCounts[c.device] || 0) + 1;
  });

  const deviceBreakdown = Object.entries(deviceCounts).map(([device, count]) => ({
    device,
    clicks: count,
    percentage: totalClicks > 0 ? Number(((count / totalClicks) * 100).toFixed(1)) : 0,
  }));

  const summary: AnalyticsSummary = {
    totalClicks,
    uniqueVisitors,
    totalConversions,
    conversionRate,
    estimatedGrossVolume: Number(estimatedGrossVolume.toFixed(2)),
    estimatedCommission: Number(estimatedCommission.toFixed(2)),
    clicksToday,
    topProducts,
    clicksByDay,
    platformBreakdown,
    categoryBreakdown,
    deviceBreakdown,
    recentClicks: clicks.slice(0, 50).map(({ visitorHash, ...click }) => click),
  };

  res.json(summary);
});

// RESET OR RESEED ANALYTICS
app.post('/api/analytics/reset', requireOwnerAuth, (req, res) => {
  clicks = generateSeedClicks();
  conversions = generateSeedConversions(clicks);
  saveData();
  res.json({ success: true, message: 'Analytics reset to fresh seed data' });
});

app.use((err: unknown, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (res.headersSent) return next(err);
  const message = err instanceof Error ? err.message : 'Unknown server error';
  console.error(`[${res.locals.correlationId}] Request failed: ${message}`);
  return sendError(res, 500, 'An unexpected server error occurred.');
});

// ================= VITE INTEGRATION =================

async function startServer() {
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
    console.info(`SillyFinds affiliate server running on http://localhost:${PORT}`);
  });
}

startServer();
