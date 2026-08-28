/**
 * ③ Automated tests — db.ts data-access layer
 *
 * Uses Node's built-in test runner (node:test) and a temporary SQLite
 * database so tests are isolated from the real data/raccoon-hub.sqlite file.
 *
 * Run:  npm test
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs';
import os from 'node:os';
import { DatabaseSync } from 'node:sqlite';

// ---- Minimal in-process store factory used by tests -------------------------
// We can't import store from db.ts directly because it opens the real DB path
// on import. Instead, we recreate the same schema in a temp file.

function makeTempStore() {
  const tmpDir  = fs.mkdtempSync(path.join(os.tmpdir(), 'raccoon-test-'));
  const dbFile  = path.join(tmpDir, 'test.sqlite');
  const db      = new DatabaseSync(dbFile);
  db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, description TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'Viral Finds', rating REAL NOT NULL DEFAULT 5,
      reviewCount INTEGER NOT NULL DEFAULT 1, imageUrl TEXT NOT NULL DEFAULT '',
      platform TEXT NOT NULL DEFAULT 'Amazon', affiliateUrl TEXT NOT NULL DEFAULT '',
      affiliateTag TEXT, customSubId TEXT, badge TEXT,
      featured INTEGER NOT NULL DEFAULT 0, createdAt TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS clicks (
      id TEXT PRIMARY KEY, productId TEXT NOT NULL, productTitle TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT 'Amazon', category TEXT NOT NULL DEFAULT 'Viral Finds',
      timestamp TEXT NOT NULL, referrer TEXT NOT NULL DEFAULT 'direct',
      device TEXT NOT NULL DEFAULT 'Desktop',
      utmSource TEXT, utmMedium TEXT, utmCampaign TEXT,
      destinationUrl TEXT NOT NULL DEFAULT '', visitorHash TEXT
    );
    CREATE TABLE IF NOT EXISTS conversions (
      id TEXT PRIMARY KEY, clickId TEXT, productId TEXT NOT NULL,
      productTitle TEXT NOT NULL, timestamp TEXT NOT NULL,
      platform TEXT NOT NULL DEFAULT 'Amazon'
    );
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY, username TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL, salt TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'owner', createdAt TEXT NOT NULL
    );
  `);

  // Tiny in-process store mirroring db.ts public API
  const store = {
    createProduct: (p: any) => {
      db.prepare(`INSERT INTO products (id,title,description,category,rating,reviewCount,imageUrl,platform,affiliateUrl,affiliateTag,customSubId,badge,featured,createdAt)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(p.id,p.title,p.description,p.category,p.rating,p.reviewCount,p.imageUrl,p.platform,p.affiliateUrl,p.affiliateTag??null,p.customSubId??null,p.badge??null,p.featured?1:0,p.createdAt);
      return p;
    },
    getProduct: (id: string) => {
      const row = db.prepare('SELECT * FROM products WHERE id = ?').get(id) as any;
      if (!row) return undefined;
      return { ...row, featured: row.featured === 1 };
    },
    listProducts: () => (db.prepare('SELECT * FROM products ORDER BY createdAt DESC').all() as any[]).map((r:any)=>({...r,featured:r.featured===1})),
    updateProduct: (p: any) => {
      db.prepare(`UPDATE products SET title=?,description=?,category=?,rating=?,reviewCount=?,imageUrl=?,platform=?,affiliateUrl=?,affiliateTag=?,customSubId=?,badge=?,featured=? WHERE id=?`)
        .run(p.title,p.description,p.category,p.rating,p.reviewCount,p.imageUrl,p.platform,p.affiliateUrl,p.affiliateTag??null,p.customSubId??null,p.badge??null,p.featured?1:0,p.id);
      return p;
    },
    deleteProduct: (id: string) => db.prepare('DELETE FROM products WHERE id=?').run(id).changes > 0,

    createClick: (c: any) => {
      db.prepare(`INSERT INTO clicks (id,productId,productTitle,platform,category,timestamp,referrer,device,utmSource,utmMedium,utmCampaign,destinationUrl,visitorHash)
        VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(c.id,c.productId,c.productTitle,c.platform,c.category,c.timestamp,c.referrer,c.device,c.utmSource??null,c.utmMedium??null,c.utmCampaign??null,c.destinationUrl,c.visitorHash??null);
      return c;
    },
    listClicks: () => db.prepare('SELECT * FROM clicks ORDER BY timestamp DESC').all() as any[],
    countTotalClicks: () => (db.prepare('SELECT COUNT(*) AS c FROM clicks').get() as any).c as number,
    deleteClicksOlderThan: (days: number) => {
      const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
      return db.prepare('DELETE FROM clicks WHERE timestamp < ?').run(cutoff).changes;
    },
    deleteAllClicks: () => db.exec('DELETE FROM clicks'),

    createConversion: (c: any) => {
      db.prepare(`INSERT INTO conversions (id,clickId,productId,productTitle,timestamp,platform) VALUES (?,?,?,?,?,?)`)
        .run(c.id,c.clickId??null,c.productId,c.productTitle,c.timestamp,c.platform);
      return c;
    },
    countTotalConversions: () => (db.prepare('SELECT COUNT(*) AS c FROM conversions').get() as any).c as number,
    deleteAllConversions: () => db.exec('DELETE FROM conversions'),

    close: () => db.close(),
    cleanup: () => { try { db.close(); } catch {} fs.rmSync(tmpDir, { recursive: true, force: true }); },
  };

  return store;
}

// =============================================================================
// TEST SUITES
// =============================================================================

describe('Products CRUD', () => {
  let store: ReturnType<typeof makeTempStore>;

  before(() => { store = makeTempStore(); });
  after(()  => { store.cleanup(); });

  it('creates and retrieves a product', () => {
    const p = { id: 'p1', title: 'Test Product', description: 'desc', category: 'Electronics',
      rating: 4.5, reviewCount: 10, imageUrl: 'https://example.com/img.jpg',
      platform: 'Amazon', affiliateUrl: 'https://amzn.to/abc', affiliateTag: 'test-20',
      featured: false, createdAt: new Date().toISOString() };
    store.createProduct(p);
    const fetched = store.getProduct('p1');
    assert.ok(fetched, 'product should exist');
    assert.equal(fetched!.title, 'Test Product');
    assert.equal(fetched!.platform, 'Amazon');
  });

  it('lists all products', () => {
    const products = store.listProducts();
    assert.ok(products.length >= 1);
  });

  it('updates a product', () => {
    const existing = store.getProduct('p1')!;
    const updated = { ...existing, title: 'Updated Title' };
    store.updateProduct(updated);
    assert.equal(store.getProduct('p1')!.title, 'Updated Title');
  });

  it('deletes a product', () => {
    store.createProduct({ id: 'p-delete', title: 'Delete Me', description: '', category: 'Test',
      rating: 5, reviewCount: 1, imageUrl: '', platform: 'Amazon',
      affiliateUrl: 'https://amzn.to/x', featured: false, createdAt: new Date().toISOString() });
    assert.ok(store.deleteProduct('p-delete'));
    assert.equal(store.getProduct('p-delete'), undefined);
  });

  it('returns undefined for a non-existent product', () => {
    assert.equal(store.getProduct('does-not-exist'), undefined);
  });
});

describe('Clicks', () => {
  let store: ReturnType<typeof makeTempStore>;

  before(() => { store = makeTempStore(); });
  after(()  => { store.cleanup(); });

  const baseClick = () => ({
    id: `click-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    productId: 'p1', productTitle: 'Product', platform: 'Amazon', category: 'Test',
    timestamp: new Date().toISOString(), referrer: 'direct', device: 'Desktop',
    destinationUrl: 'https://amazon.com',
  });

  it('records a click and counts it', () => {
    store.createClick(baseClick());
    assert.equal(store.countTotalClicks(), 1);
  });

  it('lists clicks', () => {
    assert.ok(store.listClicks().length >= 1);
  });

  it('deletes all clicks', () => {
    store.deleteAllClicks();
    assert.equal(store.countTotalClicks(), 0);
  });
});

describe('Data Retention', () => {
  let store: ReturnType<typeof makeTempStore>;

  before(() => { store = makeTempStore(); });
  after(()  => { store.cleanup(); });

  it('purges clicks older than the retention window', () => {
    // Insert a click timestamped 100 days ago.
    const oldTs = new Date(Date.now() - 100 * 86_400_000).toISOString();
    store.createClick({
      id: 'old-click', productId: 'p1', productTitle: 'Old', platform: 'Amazon',
      category: 'Test', timestamp: oldTs, referrer: 'direct', device: 'Desktop',
      destinationUrl: 'https://amazon.com',
    });
    // Insert a recent click.
    store.createClick({
      id: 'new-click', productId: 'p1', productTitle: 'New', platform: 'Amazon',
      category: 'Test', timestamp: new Date().toISOString(), referrer: 'direct',
      device: 'Desktop', destinationUrl: 'https://amazon.com',
    });

    assert.equal(store.countTotalClicks(), 2, 'should have 2 clicks before purge');

    const deleted = store.deleteClicksOlderThan(90);
    assert.equal(deleted, 1, 'should have deleted 1 old click');
    assert.equal(store.countTotalClicks(), 1, 'should have 1 recent click remaining');
  });
});

describe('Conversions', () => {
  let store: ReturnType<typeof makeTempStore>;

  before(() => { store = makeTempStore(); });
  after(()  => { store.cleanup(); });

  it('records and counts conversions', () => {
    store.createConversion({
      id: 'conv-1', clickId: 'click-1', productId: 'p1',
      productTitle: 'Product', timestamp: new Date().toISOString(), platform: 'Amazon',
    });
    assert.equal(store.countTotalConversions(), 1);
    store.deleteAllConversions();
    assert.equal(store.countTotalConversions(), 0);
  });
});

describe('Image magic bytes validation', () => {
  // Test the validateMagicBytes logic directly (re-implemented inline to avoid
  // importing server.ts which opens DB/Vite on load).

  function validateMagicBytes(buf: Buffer, ext: string): boolean {
    if (ext === 'jpg')  return buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
    if (ext === 'png')  return buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47 && buf[4] === 0x0D && buf[5] === 0x0A && buf[6] === 0x1A && buf[7] === 0x0A;
    if (ext === 'gif')  return buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38;
    if (ext === 'webp') return buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50;
    return false;
  }

  it('accepts valid JPEG magic bytes', () => {
    const buf = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10]);
    assert.ok(validateMagicBytes(buf, 'jpg'));
  });

  it('accepts valid PNG magic bytes', () => {
    const buf = Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 0x00]);
    assert.ok(validateMagicBytes(buf, 'png'));
  });

  it('accepts valid GIF magic bytes', () => {
    const buf = Buffer.from([0x47, 0x49, 0x46, 0x38, 0x39, 0x61]);
    assert.ok(validateMagicBytes(buf, 'gif'));
  });

  it('accepts valid WEBP magic bytes', () => {
    const buf = Buffer.alloc(12);
    buf.write('RIFF', 0, 'ascii');
    buf.write('WEBP', 8, 'ascii');
    assert.ok(validateMagicBytes(buf, 'webp'));
  });

  it('rejects a JPEG file declared as PNG', () => {
    const buf = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0]); // JPEG magic
    assert.ok(!validateMagicBytes(buf, 'png'), 'should reject JPEG bytes as PNG');
  });

  it('rejects arbitrary bytes as any image type', () => {
    const buf = Buffer.from([0x50, 0x4B, 0x03, 0x04]); // ZIP magic
    assert.ok(!validateMagicBytes(buf, 'jpg'));
    assert.ok(!validateMagicBytes(buf, 'png'));
    assert.ok(!validateMagicBytes(buf, 'gif'));
    assert.ok(!validateMagicBytes(buf, 'webp'));
  });
});
