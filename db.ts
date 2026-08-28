import 'dotenv/config';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { DatabaseSync } from 'node:sqlite';
import { Product, ClickEvent, ConversionEvent } from './src/types';

// SQLite-backed persistence layer. Replaces the previous flat JSON files:
// a single on-disk database gives us transactional writes and proper
// write-locking, so concurrent click tracking can no longer lose a write.
// We keep an explicit, importable schema so the migration path from the old
// JSON files stays runnable and testable.

const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(process.cwd(), 'data'));
const DB_FILE = path.join(DATA_DIR, 'raccoon-hub.sqlite');

// Legacy flat-file paths, kept for the one-time startup migration below.
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const CLICKS_FILE = path.join(DATA_DIR, 'clicks.json');
const CONVERSIONS_FILE = path.join(DATA_DIR, 'conversions.json');

function createDatabase(file: string): DatabaseSync {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA journal_mode = WAL;');
  db.exec('PRAGMA foreign_keys = ON;');
  return db;
}

const db = createDatabase(DB_FILE);

db.exec(`
  CREATE TABLE IF NOT EXISTS products (
    id            TEXT PRIMARY KEY,
    title         TEXT NOT NULL,
    description   TEXT NOT NULL DEFAULT '',
    category      TEXT NOT NULL DEFAULT 'Viral Finds',
    rating        REAL NOT NULL DEFAULT 5,
    reviewCount   INTEGER NOT NULL DEFAULT 1,
    imageUrl      TEXT NOT NULL DEFAULT '',
    platform      TEXT NOT NULL DEFAULT 'Amazon',
    affiliateUrl  TEXT NOT NULL DEFAULT '',
    affiliateTag  TEXT,
    customSubId   TEXT,
    badge         TEXT,
    featured      INTEGER NOT NULL DEFAULT 0,
    createdAt     TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS clicks (
    id            TEXT PRIMARY KEY,
    productId     TEXT NOT NULL,
    productTitle  TEXT NOT NULL,
    platform      TEXT NOT NULL DEFAULT 'Amazon',
    category      TEXT NOT NULL DEFAULT 'Viral Finds',
    timestamp     TEXT NOT NULL,
    referrer      TEXT NOT NULL DEFAULT 'direct',
    device        TEXT NOT NULL DEFAULT 'Desktop',
    utmSource     TEXT,
    utmMedium     TEXT,
    utmCampaign   TEXT,
    destinationUrl TEXT NOT NULL DEFAULT '',
    visitorHash   TEXT
  );

  CREATE TABLE IF NOT EXISTS conversions (
    id            TEXT PRIMARY KEY,
    clickId       TEXT,
    productId     TEXT NOT NULL,
    productTitle  TEXT NOT NULL,
    timestamp     TEXT NOT NULL,
    platform      TEXT NOT NULL DEFAULT 'Amazon'
  );

  -- Multi-user auth: each user has a hashed password and a role.
  CREATE TABLE IF NOT EXISTS users (
    id            TEXT PRIMARY KEY,
    username      TEXT NOT NULL UNIQUE,
    passwordHash  TEXT NOT NULL,
    salt          TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'owner',
    createdAt     TEXT NOT NULL
  );
`);

// Keeping indexes cheap and useful for the analytics queries.
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_clicks_timestamp      ON clicks(timestamp);
  CREATE INDEX IF NOT EXISTS idx_clicks_productId      ON clicks(productId);
  CREATE INDEX IF NOT EXISTS idx_conversions_productId ON conversions(productId);
  CREATE INDEX IF NOT EXISTS idx_users_username        ON users(username);
`);

// ============================================================================
// Prepared statements
// ============================================================================

const insertProductStmt = db.prepare(`
  INSERT INTO products (id, title, description, category, rating, reviewCount,
    imageUrl, platform, affiliateUrl, affiliateTag, customSubId, badge, featured, createdAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const updateProductStmt = db.prepare(`
  UPDATE products SET
    title = ?, description = ?, category = ?, rating = ?, reviewCount = ?,
    imageUrl = ?, platform = ?, affiliateUrl = ?, affiliateTag = ?,
    customSubId = ?, badge = ?, featured = ?
  WHERE id = ?
`);

const deleteProductStmt = db.prepare('DELETE FROM products WHERE id = ?');
const getProductStmt = db.prepare('SELECT * FROM products WHERE id = ?');
const allProductsStmt = db.prepare('SELECT * FROM products ORDER BY createdAt DESC');

const insertClickStmt = db.prepare(`
  INSERT INTO clicks (id, productId, productTitle, platform, category, timestamp,
    referrer, device, utmSource, utmMedium, utmCampaign, destinationUrl, visitorHash)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertConversionStmt = db.prepare(`
  INSERT INTO conversions (id, clickId, productId, productTitle, timestamp, platform)
  VALUES (?, ?, ?, ?, ?, ?)
`);

// ============================================================================
// Row mappers (SQLite -> domain types)
// ============================================================================

function mapProduct(row: Record<string, unknown>): Product {
  return {
    id: row.id as string,
    title: row.title as string,
    description: row.description as string,
    category: row.category as string,
    rating: row.rating as number,
    reviewCount: row.reviewCount as number,
    imageUrl: row.imageUrl as string,
    platform: row.platform as Product['platform'],
    affiliateUrl: row.affiliateUrl as string,
    affiliateTag: (row.affiliateTag as string) ?? undefined,
    customSubId: (row.customSubId as string) ?? undefined,
    badge: (row.badge as string) ?? undefined,
    featured: row.featured === 1,
    createdAt: row.createdAt as string,
  };
}

function mapClick(row: Record<string, unknown>): ClickEvent {
  return {
    id: row.id as string,
    productId: row.productId as string,
    productTitle: row.productTitle as string,
    platform: row.platform as string,
    category: row.category as string,
    timestamp: row.timestamp as string,
    referrer: row.referrer as string,
    device: row.device as ClickEvent['device'],
    utmSource: (row.utmSource as string) ?? undefined,
    utmMedium: (row.utmMedium as string) ?? undefined,
    utmCampaign: (row.utmCampaign as string) ?? undefined,
    destinationUrl: row.destinationUrl as string,
    visitorHash: (row.visitorHash as string) ?? undefined,
  };
}

function mapConversion(row: Record<string, unknown>): ConversionEvent {
  return {
    id: row.id as string,
    clickId: (row.clickId as string) ?? undefined,
    productId: row.productId as string,
    productTitle: row.productTitle as string,
    timestamp: row.timestamp as string,
    platform: row.platform as string,
  };
}

// ============================================================================
// One-time migration from the legacy flat JSON files.
//
// On the first boot against a fresh database (no products/clicks/conversions
// stored yet), we import whatever existed in the old data/products.json,
// data/clicks.json and data/conversions.json so no historical data is lost.
// The migration is idempotent: it runs once when the DB is empty and never
// re-runs afterwards.
// ============================================================================

function readJsonArray(filePath: string): unknown[] {
  try {
    if (!fs.existsSync(filePath)) return [];
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function migrateFromJsonIfNeeded(): { migrated: boolean; counts: { products: number; clicks: number; conversions: number } } {
  const productCount = (db.prepare('SELECT COUNT(*) AS c FROM products').get() as { c: number }).c;
  const clickCount = (db.prepare('SELECT COUNT(*) AS c FROM clicks').get() as { c: number }).c;
  const conversionCount = (db.prepare('SELECT COUNT(*) AS c FROM conversions').get() as { c: number }).c;

  // Only migrate when the database is completely empty (fresh install).
  if (productCount > 0 || clickCount > 0 || conversionCount > 0) {
    return { migrated: false, counts: { products: productCount, clicks: clickCount, conversions: conversionCount } };
  }

  const legacyProducts = readJsonArray(PRODUCTS_FILE) as Partial<Product>[];
  const legacyClicks = readJsonArray(CLICKS_FILE) as Partial<ClickEvent>[];
  const legacyConversions = readJsonArray(CONVERSIONS_FILE) as Partial<ConversionEvent>[];

  // node:sqlite has no .transaction() helper; wrap the import in an explicit
  // transaction so a failure mid-import rolls back instead of leaving a
  // partially populated database.
  const runMigration = () => {
    db.exec('BEGIN');
    try {
      for (const p of legacyProducts) {
        insertProductStmt.run(
          p.id ?? `prod-${Math.random()}`,
          p.title ?? '',
          p.description ?? '',
          p.category ?? 'Viral Finds',
          p.rating ?? 5,
          p.reviewCount ?? 1,
          p.imageUrl ?? '',
          p.platform ?? 'Amazon',
          p.affiliateUrl ?? '',
          p.affiliateTag ?? null,
          p.customSubId ?? null,
          p.badge ?? null,
          p.featured ? 1 : 0,
          p.createdAt ?? new Date().toISOString(),
        );
      }
      for (const c of legacyClicks) {
        insertClickStmt.run(
          c.id ?? `click-${Math.random()}`,
          c.productId ?? '',
          c.productTitle ?? '',
          c.platform ?? 'Amazon',
          c.category ?? 'Viral Finds',
          c.timestamp ?? new Date().toISOString(),
          c.referrer ?? 'direct',
          c.device ?? 'Desktop',
          c.utmSource ?? null,
          c.utmMedium ?? null,
          c.utmCampaign ?? null,
          c.destinationUrl ?? '',
          c.visitorHash ?? null,
        );
      }
      for (const cv of legacyConversions) {
        insertConversionStmt.run(
          cv.id ?? `conv-${Math.random()}`,
          cv.clickId ?? null,
          cv.productId ?? '',
          cv.productTitle ?? '',
          cv.timestamp ?? new Date().toISOString(),
          cv.platform ?? 'Amazon',
        );
      }
      db.exec('COMMIT');
    } catch (err) {
      db.exec('ROLLBACK');
      throw err;
    }
  };

  const migrated = legacyProducts.length > 0 || legacyClicks.length > 0 || legacyConversions.length > 0;
  if (migrated) {
    runMigration();
  }

  return {
    migrated,
    counts: {
      products: legacyProducts.length,
      clicks: legacyClicks.length,
      conversions: legacyConversions.length,
    },
  };
}

function syncProductsJson(): void {
  try {
    const products = (allProductsStmt.all() as Record<string, unknown>[]).map(mapProduct);
    const jsonContent = JSON.stringify(products, null, 2);
    fs.writeFileSync(PRODUCTS_FILE, jsonContent, 'utf-8');

    // Also sync to root project data directory if DATA_DIR is a custom path
    const rootProductsFile = path.join(process.cwd(), 'data', 'products.json');
    if (PRODUCTS_FILE !== rootProductsFile) {
      const dir = path.dirname(rootProductsFile);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(rootProductsFile, jsonContent, 'utf-8');
    }
  } catch (err) {
    console.error('[DB] Failed to sync products.json:', err);
  }
}

// ============================================================================
// Public data-access API (used by server.ts)
// ============================================================================

export const store = {
  // ---- products ----
  listProducts(): Product[] {
    return (allProductsStmt.all() as Record<string, unknown>[]).map(mapProduct);
  },

  getProduct(id: string): Product | undefined {
    const row = getProductStmt.get(id) as Record<string, unknown> | undefined;
    return row ? mapProduct(row) : undefined;
  },

  createProduct(p: Product): Product {
    insertProductStmt.run(
      p.id, p.title, p.description, p.category, p.rating, p.reviewCount,
      p.imageUrl, p.platform, p.affiliateUrl, p.affiliateTag ?? null,
      p.customSubId ?? null, p.badge ?? null, p.featured ? 1 : 0, p.createdAt,
    );
    syncProductsJson();
    return p;
  },

  updateProduct(p: Product): Product {
    updateProductStmt.run(
      p.title, p.description, p.category, p.rating, p.reviewCount,
      p.imageUrl, p.platform, p.affiliateUrl, p.affiliateTag ?? null,
      p.customSubId ?? null, p.badge ?? null, p.featured ? 1 : 0, p.id,
    );
    syncProductsJson();
    return p;
  },

  deleteProduct(id: string): boolean {
    const ok = deleteProductStmt.run(id).changes > 0;
    if (ok) {
      syncProductsJson();
    }
    return ok;
  },

  // ---- clicks ----
  listClicks(): ClickEvent[] {
    return (db.prepare('SELECT * FROM clicks ORDER BY timestamp DESC').all() as Record<string, unknown>[]).map(mapClick);
  },

  recentClicks(limit: number): ClickEvent[] {
    return (db.prepare('SELECT * FROM clicks ORDER BY timestamp DESC LIMIT ?').all(limit) as Record<string, unknown>[]).map(mapClick);
  },

  createClick(c: ClickEvent): ClickEvent {
    insertClickStmt.run(
      c.id, c.productId, c.productTitle, c.platform, c.category, c.timestamp,
      c.referrer, c.device, c.utmSource ?? null, c.utmMedium ?? null,
      c.utmCampaign ?? null, c.destinationUrl, c.visitorHash ?? null,
    );
    return c;
  },

  deleteAllClicks(): void {
    db.exec('DELETE FROM clicks;');
  },

  // ---- conversions ----
  listConversions(): ConversionEvent[] {
    return (db.prepare('SELECT * FROM conversions ORDER BY timestamp DESC').all() as Record<string, unknown>[]).map(mapConversion);
  },

  createConversion(c: ConversionEvent): ConversionEvent {
    insertConversionStmt.run(
      c.id, c.clickId ?? null, c.productId, c.productTitle, c.timestamp, c.platform,
    );
    return c;
  },

  deleteAllConversions(): void {
    db.exec('DELETE FROM conversions;');
  },

  // ---- data retention ----
  // Purge click records older than `days` days to prevent unbounded DB growth.
  deleteClicksOlderThan(days: number): number {
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
    return Number(db.prepare('DELETE FROM clicks WHERE timestamp < ?').run(cutoff).changes);
  },

  // ---- analytics helpers ----
  countTotalClicks(): number {
    return (db.prepare('SELECT COUNT(*) AS c FROM clicks').get() as { c: number }).c;
  },

  countDistinctVisitors(): number {
    return (db.prepare('SELECT COUNT(DISTINCT visitorHash) AS c FROM clicks WHERE visitorHash IS NOT NULL').get() as { c: number }).c;
  },

  countTotalConversions(): number {
    return (db.prepare('SELECT COUNT(*) AS c FROM conversions').get() as { c: number }).c;
  },

  // ---- user management (multi-user auth) ----
  getUserByUsername(username: string): { id: string; username: string; passwordHash: string; salt: string; role: string } | undefined {
    return db.prepare('SELECT * FROM users WHERE username = ?').get(username) as any;
  },

  getUserById(id: string): { id: string; username: string; role: string } | undefined {
    const row = db.prepare('SELECT id, username, role FROM users WHERE id = ?').get(id) as any;
    return row;
  },

  listUsers(): { id: string; username: string; role: string; createdAt: string }[] {
    return db.prepare('SELECT id, username, role, createdAt FROM users ORDER BY createdAt ASC').all() as any[];
  },

  countUsers(): number {
    return (db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number }).c;
  },

  // Hash a plaintext password using scrypt (synchronous for simplicity with node:sqlite).
  hashPassword(password: string): { hash: string; salt: string } {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.scryptSync(password, salt, 64).toString('hex');
    return { hash, salt };
  },

  verifyPassword(password: string, hash: string, salt: string): boolean {
    try {
      const derived = crypto.scryptSync(password, salt, 64).toString('hex');
      return crypto.timingSafeEqual(Buffer.from(derived, 'hex'), Buffer.from(hash, 'hex'));
    } catch {
      return false;
    }
  },

  createUser(username: string, password: string, role = 'owner'): { id: string; username: string; role: string } {
    const id = `user-${Date.now()}`;
    const { hash, salt } = store.hashPassword(password);
    db.prepare(
      'INSERT INTO users (id, username, passwordHash, salt, role, createdAt) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(id, username, hash, salt, role, new Date().toISOString());
    return { id, username, role };
  },
};

// Close the handle cleanly on process exit (helps flush WAL).
process.on('exit', () => {
  try {
    db.close();
  } catch {
    // ignore close errors during shutdown
  }
});
