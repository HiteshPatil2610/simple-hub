import 'dotenv/config';
import crypto from 'crypto';
import { Pool, type PoolClient } from 'pg';
import { Product, ClickEvent, ConversionEvent } from './src/types';

// Postgres-backed persistence layer (designed for Neon's free serverless
// Postgres, but works with any standard Postgres connection string).
//
// Replaces the previous node:sqlite file database, which lived on local
// disk and was wiped whenever Render recycled the web service's ephemeral
// filesystem. A networked Postgres database survives restarts, redeploys,
// and instance recycling because the data no longer lives on the app
// server's disk at all.

const DATABASE_URL = process.env.DATABASE_URL?.trim();

if (!DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set. Create a free Neon Postgres database and set ' +
    'DATABASE_URL (with sslmode=require) in your environment.'
  );
}

// Neon (and most managed Postgres providers) require SSL. `rejectUnauthorized: false`
// matches Neon's standard connection guidance for serverless/Node clients.
export const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

pool.on('error', (err) => {
  // Errors on idle clients (e.g. a dropped connection) should not crash the process.
  console.error('[DB] Unexpected error on idle Postgres client:', err);
});

// ============================================================================
// Schema
// ============================================================================

async function createSchema(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS products (
      id            TEXT PRIMARY KEY,
      title         TEXT NOT NULL,
      description   TEXT NOT NULL DEFAULT '',
      category      TEXT NOT NULL DEFAULT 'Viral Finds',
      rating        REAL NOT NULL DEFAULT 5,
      "reviewCount" INTEGER NOT NULL DEFAULT 1,
      "imageUrl"    TEXT NOT NULL DEFAULT '',
      platform      TEXT NOT NULL DEFAULT 'Amazon',
      "affiliateUrl" TEXT NOT NULL DEFAULT '',
      "affiliateTag" TEXT,
      "customSubId"  TEXT,
      badge         TEXT,
      featured      BOOLEAN NOT NULL DEFAULT FALSE,
      "createdAt"   TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS clicks (
      id            TEXT PRIMARY KEY,
      "productId"   TEXT NOT NULL,
      "productTitle" TEXT NOT NULL,
      platform      TEXT NOT NULL DEFAULT 'Amazon',
      category      TEXT NOT NULL DEFAULT 'Viral Finds',
      timestamp     TEXT NOT NULL,
      referrer      TEXT NOT NULL DEFAULT 'direct',
      device        TEXT NOT NULL DEFAULT 'Desktop',
      "utmSource"   TEXT,
      "utmMedium"   TEXT,
      "utmCampaign" TEXT,
      "destinationUrl" TEXT NOT NULL DEFAULT '',
      "visitorHash" TEXT
    );

    CREATE TABLE IF NOT EXISTS conversions (
      id            TEXT PRIMARY KEY,
      "clickId"     TEXT,
      "productId"   TEXT NOT NULL,
      "productTitle" TEXT NOT NULL,
      timestamp     TEXT NOT NULL,
      platform      TEXT NOT NULL DEFAULT 'Amazon'
    );

    -- Multi-user auth: each user has a hashed password and a role.
    CREATE TABLE IF NOT EXISTS users (
      id            TEXT PRIMARY KEY,
      username      TEXT NOT NULL UNIQUE,
      "passwordHash" TEXT NOT NULL,
      salt          TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'owner',
      "createdAt"   TEXT NOT NULL
    );

    -- Forgot-password OTPs. One active OTP per email at a time (a new
    -- request overwrites the old one). Short-lived and single-use.
    CREATE TABLE IF NOT EXISTS password_resets (
      email       TEXT PRIMARY KEY,
      "otpHash"   TEXT NOT NULL,
      "expiresAt" TEXT NOT NULL,
      attempts    INTEGER NOT NULL DEFAULT 0
    );

    CREATE INDEX IF NOT EXISTS idx_clicks_timestamp      ON clicks(timestamp);
    CREATE INDEX IF NOT EXISTS idx_clicks_productid      ON clicks("productId");
    CREATE INDEX IF NOT EXISTS idx_conversions_productid ON conversions("productId");
    CREATE INDEX IF NOT EXISTS idx_users_username        ON users(username);
  `);
}

// Call once at boot (from server.ts) before handling any requests.
export async function initDb(): Promise<void> {
  await createSchema();
}

// ============================================================================
// Row mappers (Postgres -> domain types)
// ============================================================================

function mapProduct(row: Record<string, unknown>): Product {
  return {
    id: row.id as string,
    title: row.title as string,
    description: row.description as string,
    category: row.category as string,
    rating: Number(row.rating),
    reviewCount: Number(row.reviewCount),
    imageUrl: row.imageUrl as string,
    platform: row.platform as Product['platform'],
    affiliateUrl: row.affiliateUrl as string,
    affiliateTag: (row.affiliateTag as string) ?? undefined,
    customSubId: (row.customSubId as string) ?? undefined,
    badge: (row.badge as string) ?? undefined,
    featured: Boolean(row.featured),
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
// Public data-access API (used by server.ts). All methods are async since
// every call now goes over the network to Postgres instead of hitting a
// local file.
// ============================================================================

export const store = {
  // ---- products ----
  async listProducts(): Promise<Product[]> {
    const { rows } = await pool.query('SELECT * FROM products ORDER BY "createdAt" DESC');
    return rows.map(mapProduct);
  },

  async getProduct(id: string): Promise<Product | undefined> {
    const { rows } = await pool.query('SELECT * FROM products WHERE id = $1', [id]);
    return rows[0] ? mapProduct(rows[0]) : undefined;
  },

  async createProduct(p: Product): Promise<Product> {
    await pool.query(
      `INSERT INTO products (id, title, description, category, rating, "reviewCount",
        "imageUrl", platform, "affiliateUrl", "affiliateTag", "customSubId", badge, featured, "createdAt")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        p.id, p.title, p.description, p.category, p.rating, p.reviewCount,
        p.imageUrl, p.platform, p.affiliateUrl, p.affiliateTag ?? null,
        p.customSubId ?? null, p.badge ?? null, p.featured, p.createdAt,
      ]
    );
    return p;
  },

  async updateProduct(p: Product): Promise<Product> {
    await pool.query(
      `UPDATE products SET
        title = $1, description = $2, category = $3, rating = $4, "reviewCount" = $5,
        "imageUrl" = $6, platform = $7, "affiliateUrl" = $8, "affiliateTag" = $9,
        "customSubId" = $10, badge = $11, featured = $12
       WHERE id = $13`,
      [
        p.title, p.description, p.category, p.rating, p.reviewCount,
        p.imageUrl, p.platform, p.affiliateUrl, p.affiliateTag ?? null,
        p.customSubId ?? null, p.badge ?? null, p.featured, p.id,
      ]
    );
    return p;
  },

  async deleteProduct(id: string): Promise<boolean> {
    const result = await pool.query('DELETE FROM products WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  },

  // ---- clicks ----
  async listClicks(): Promise<ClickEvent[]> {
    const { rows } = await pool.query('SELECT * FROM clicks ORDER BY timestamp DESC');
    return rows.map(mapClick);
  },

  async recentClicks(limit: number): Promise<ClickEvent[]> {
    const { rows } = await pool.query('SELECT * FROM clicks ORDER BY timestamp DESC LIMIT $1', [limit]);
    return rows.map(mapClick);
  },

  async createClick(c: ClickEvent): Promise<ClickEvent> {
    await pool.query(
      `INSERT INTO clicks (id, "productId", "productTitle", platform, category, timestamp,
        referrer, device, "utmSource", "utmMedium", "utmCampaign", "destinationUrl", "visitorHash")
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
      [
        c.id, c.productId, c.productTitle, c.platform, c.category, c.timestamp,
        c.referrer, c.device, c.utmSource ?? null, c.utmMedium ?? null,
        c.utmCampaign ?? null, c.destinationUrl, c.visitorHash ?? null,
      ]
    );
    return c;
  },

  async deleteAllClicks(): Promise<void> {
    await pool.query('DELETE FROM clicks');
  },

  // ---- conversions ----
  async listConversions(): Promise<ConversionEvent[]> {
    const { rows } = await pool.query('SELECT * FROM conversions ORDER BY timestamp DESC');
    return rows.map(mapConversion);
  },

  async createConversion(c: ConversionEvent): Promise<ConversionEvent> {
    await pool.query(
      `INSERT INTO conversions (id, "clickId", "productId", "productTitle", timestamp, platform)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [c.id, c.clickId ?? null, c.productId, c.productTitle, c.timestamp, c.platform]
    );
    return c;
  },

  async deleteAllConversions(): Promise<void> {
    await pool.query('DELETE FROM conversions');
  },

  // ---- data retention ----
  // Purge click records older than `days` days to prevent unbounded DB growth.
  async deleteClicksOlderThan(days: number): Promise<number> {
    const cutoff = new Date(Date.now() - days * 86_400_000).toISOString();
    const result = await pool.query('DELETE FROM clicks WHERE timestamp < $1', [cutoff]);
    return result.rowCount ?? 0;
  },

  // ---- analytics helpers ----
  async countTotalClicks(): Promise<number> {
    const { rows } = await pool.query('SELECT COUNT(*) AS c FROM clicks');
    return Number(rows[0].c);
  },

  async countDistinctVisitors(): Promise<number> {
    const { rows } = await pool.query(
      'SELECT COUNT(DISTINCT "visitorHash") AS c FROM clicks WHERE "visitorHash" IS NOT NULL'
    );
    return Number(rows[0].c);
  },

  async countTotalConversions(): Promise<number> {
    const { rows } = await pool.query('SELECT COUNT(*) AS c FROM conversions');
    return Number(rows[0].c);
  },

  // ---- user management (multi-user auth) ----
  async getUserByUsername(username: string): Promise<{ id: string; username: string; passwordHash: string; salt: string; role: string } | undefined> {
    const { rows } = await pool.query('SELECT * FROM users WHERE username = $1', [username]);
    return rows[0];
  },

  async getUserById(id: string): Promise<{ id: string; username: string; role: string } | undefined> {
    const { rows } = await pool.query('SELECT id, username, role FROM users WHERE id = $1', [id]);
    return rows[0];
  },

  // Like getUserById but includes the password hash/salt — needed to verify
  // a user's CURRENT password during a self-service password change.
  async getUserByIdWithHash(id: string): Promise<{ id: string; username: string; passwordHash: string; salt: string; role: string } | undefined> {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
    return rows[0];
  },

  async listUsers(): Promise<{ id: string; username: string; role: string; createdAt: string }[]> {
    const { rows } = await pool.query('SELECT id, username, role, "createdAt" FROM users ORDER BY "createdAt" ASC');
    return rows;
  },

  async countUsers(): Promise<number> {
    const { rows } = await pool.query('SELECT COUNT(*) AS c FROM users');
    return Number(rows[0].c);
  },

  // Hash a plaintext password using scrypt (unchanged — this is local CPU work, not a DB call).
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

  async createUser(username: string, password: string, role = 'owner'): Promise<{ id: string; username: string; role: string }> {
    const id = `user-${Date.now()}`;
    const { hash, salt } = store.hashPassword(password);
    await pool.query(
      'INSERT INTO users (id, username, "passwordHash", salt, role, "createdAt") VALUES ($1,$2,$3,$4,$5,$6)',
      [id, username, hash, salt, role, new Date().toISOString()]
    );
    return { id, username, role };
  },

  // Create a user ONLY if the username doesn't already exist — leaves an
  // existing account's password untouched. Used to seed admin accounts from
  // ADMIN_ACCOUNTS on boot: this makes the env var a one-time bootstrap for
  // NEW accounts, not a value that gets re-applied every redeploy — so a
  // password someone changes via the app stays changed.
  async createUserIfMissing(username: string, password: string, role = 'owner'): Promise<boolean> {
    const existing = await store.getUserByUsername(username);
    if (existing) return false;
    await store.createUser(username, password, role);
    return true;
  },

  // Update a user's password directly (used by both "change password" while
  // logged in, and "forgot password" after a valid OTP is verified).
  async updateUserPassword(id: string, password: string): Promise<void> {
    const { hash, salt } = store.hashPassword(password);
    await pool.query('UPDATE users SET "passwordHash" = $1, salt = $2 WHERE id = $3', [hash, salt, id]);
  },

  // ---- forgot-password OTPs ----
  // One active OTP per email — a new request replaces any previous one.
  async setPasswordResetOTP(email: string, otp: string, ttlMinutes = 15): Promise<void> {
    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const expiresAt = new Date(Date.now() + ttlMinutes * 60_000).toISOString();
    await pool.query(
      `INSERT INTO password_resets (email, "otpHash", "expiresAt", attempts)
       VALUES ($1, $2, $3, 0)
       ON CONFLICT (email) DO UPDATE SET "otpHash" = $2, "expiresAt" = $3, attempts = 0`,
      [email, otpHash, expiresAt]
    );
  },

  // Verifies an OTP for an email. Returns 'ok', 'expired', 'invalid', or
  // 'too_many_attempts' (locked out after 5 wrong guesses — request a new
  // OTP to try again). Does NOT consume the OTP on failure, so genuine typos
  // can be retried up to the attempt limit.
  async verifyPasswordResetOTP(email: string, otp: string): Promise<'ok' | 'expired' | 'invalid' | 'not_found' | 'too_many_attempts'> {
    const { rows } = await pool.query('SELECT * FROM password_resets WHERE email = $1', [email]);
    const record = rows[0];
    if (!record) return 'not_found';
    if (record.attempts >= 5) return 'too_many_attempts';
    if (new Date(record.expiresAt).getTime() < Date.now()) return 'expired';

    const otpHash = crypto.createHash('sha256').update(otp).digest('hex');
    const matches = otpHash.length === record.otpHash.length &&
      crypto.timingSafeEqual(Buffer.from(otpHash), Buffer.from(record.otpHash));
    if (!matches) {
      await pool.query('UPDATE password_resets SET attempts = attempts + 1 WHERE email = $1', [email]);
      return 'invalid';
    }
    return 'ok';
  },

  async deletePasswordResetOTP(email: string): Promise<void> {
    await pool.query('DELETE FROM password_resets WHERE email = $1', [email]);
  },

  // Insert a user if the username doesn't exist yet, or update their password
  // hash if it does. Used to sync admin accounts from an env var on boot —
  // the env var stays the source of truth, so editing a password there and
  // redeploying rotates it without any manual DB work.
  async upsertUserPassword(username: string, password: string, role = 'owner'): Promise<void> {
    const { hash, salt } = store.hashPassword(password);
    const existing = await store.getUserByUsername(username);
    if (existing) {
      await pool.query('UPDATE users SET "passwordHash" = $1, salt = $2 WHERE id = $3', [hash, salt, existing.id]);
    } else {
      const id = `user-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      await pool.query(
        'INSERT INTO users (id, username, "passwordHash", salt, role, "createdAt") VALUES ($1,$2,$3,$4,$5,$6)',
        [id, username, hash, salt, role, new Date().toISOString()]
      );
    }
  },
};

// Close the pool cleanly on process exit.
process.on('exit', () => {
  pool.end().catch(() => {
    // ignore close errors during shutdown
  });
});
