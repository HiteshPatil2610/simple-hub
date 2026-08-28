import 'dotenv/config';
import path from 'path';
import fs from 'fs';
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
`);

// Keeping indexes cheap and useful for the analytics queries.
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_clicks_timestamp   ON clicks(timestamp);
  CREATE INDEX IF NOT EXISTS idx_clicks_productId   ON clicks(productId);
  CREATE INDEX IF NOT EXISTS idx_conversions_productId ON conversions(productId);
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
    return p;
  },

  updateProduct(p: Product): Product {
    updateProductStmt.run(
      p.title, p.description, p.category, p.rating, p.reviewCount,
      p.imageUrl, p.platform, p.affiliateUrl, p.affiliateTag ?? null,
      p.customSubId ?? null, p.badge ?? null, p.featured ? 1 : 0, p.id,
    );
    return p;
  },

  deleteProduct(id: string): boolean {
    return deleteProductStmt.run(id).changes > 0;
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
};

// Close the handle cleanly on process exit (helps flush WAL).
process.on('exit', () => {
  try {
    db.close();
  } catch {
    // ignore close errors during shutdown
  }
});
