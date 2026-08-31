# Raccoon Hub — Project Overview

> Project name: **Simple Hub** · In-app product name: **Raccoon Hub**

Raccoon Hub is a lightweight, high-performance affiliate storefront and outbound tracking platform built for Amazon Associates. It's designed for content creators, curators, and niche site owners who want to share hand-picked Amazon recommendations without the overhead of a full e-commerce CMS.

The design is a retro-modern neo-brutalist aesthetic — bold typography, playful accents, smooth animations via **Motion**, styled with **Tailwind CSS** and dynamic CSS color variables.

---

## 1. Core Capabilities

### Public Storefront
- Responsive card grid of owner-entered Amazon finds — image, title, description, category badge, and a "View on Amazon" button.
- **Neo-Brutalist Design System**: Solid `#111111` structural borders with dynamic `var(--border)` offset shadows (turning crisp white in Dark Mode).
- **Frosted Glass Navigation Header**: Translucent background (`bg-[var(--nav-bg)]`) with `backdrop-blur-md`.
- **Circular View Transitions API Theme Toggle**:
  - **Light → Dark Mode**: Expanding Dark Mode circle originating from toggle button coordinates.
  - **Dark → Light Mode**: Shrinking Dark Mode circle collapsing back into toggle button coordinates.
  - Powered by native browser `@keyframes theme-circle-expand` and `@keyframes theme-circle-shrink` for 60 FPS performance and zero 1-frame flashes.
- **Dynamic Layout Mode Toggle**: Switch between **Bento Grid** (`hero`, `wide`, `tall`, `standard` bento variants) and **Classic Grid**.
- Real-time search, category filtering (with interactive yellow hover states), quick-preview modal (`ProductDetailModal`), and redirect toast notification (`RedirectNotification`).

### Direct Amazon Affiliate Link Engine
- Accepts any valid Amazon link: standard `amazon.com/dp/...` affiliate URLs or shortened `amzn.to/...` links.
- `amzn.to` links are passed through unmodified (Amazon's own shortener already encodes the affiliate tag).
- Standard URLs get the configured `affiliateTag` and UTM parameters appended automatically if not already present.

### Server-Side Redirect & Telemetry
- Outbound clicks route through `/api/redirect/:id` (or the short alias `/r/:id`).
- Each click records: timestamp, device type (Mobile/Desktop/Tablet, parsed from the User-Agent), referrer, UTM parameters, and an anonymous per-day visitor fingerprint (see [Analytics](#4-analytics)).
- After logging, the visitor is forwarded with a standard HTTP 302 redirect — accompanied by an interactive redirect toast notification banner.

### Owner Control Hub (`/#admin`)
Gated behind email + password login (see [Authentication](#3-authentication--security)). Once unlocked:
- **Manage Products** — add, edit, delete listings; upload product photos directly from device storage; switch between list and grid views; one-click "Test Link" and "Copy Link".
- **Account Management** — update owner account password directly via `ChangePasswordModal` (`POST /api/auth/change-password`).
- **Records & Clicks** — real-time totals for clicks and unique visitors, a 14-day trend graph, a product performance leaderboard, a searchable click stream, and CSV export.

---

## 2. How It Works

```
[Store Owner]
      │
      ├─► Logs in to "Owner Hub" (/#admin) with email + password → receives JWT
      ├─► Adds/edits a product (title, description, category) — Amazon only
      ├─► Uploads an image from device storage (/api/upload — magic-bytes validated)
      └─► Pastes a direct Amazon affiliate link
            │
            ▼
   [Raccoon Hub Storefront]
            │
            ▼ Visitor browses & clicks "View on Amazon"
            │
  [/api/redirect/:id server endpoint]
            │
            ├─► Rate-limited per IP
            ├─► Logs telemetry (timestamp, device, referrer, visitor hash)
            ├─► Increments click / unique-visitor counters
            ├─► Auto-purges clicks > CLICK_RETENTION_DAYS old (startup + daily)
            │
            ▼
    [Amazon product page, with affiliate tag + UTM params]

   [Affiliate Network Webhook] ──► POST /api/webhooks/conversion (HMAC-verified)
```

---

## 3. Authentication & Security

The Owner Control Hub uses **JWT-based multi-admin auth**, with no external auth service or OAuth involved:

- **Login**: `POST /api/auth/login` — accepts `{username, password}` (the "username" field holds an email address), returns a signed JWT valid for `JWT_EXPIRY` (default 8 h). Passwords are hashed with `crypto.scrypt` (64-byte key, random salt).
- **Client side**: The JWT is stored in session storage and sent as `Authorization: Bearer <token>` on all admin requests.
- **Server side**: `requireAuth` middleware validates the JWT signature and expiry using `JWT_SECRET`. All mutating admin routes require a valid token.
- **Account provisioning**: Admin accounts are defined entirely by the `ADMIN_ACCOUNTS` env var — a comma-separated list of `email:password` pairs. On every boot, each listed account is created if it doesn't exist, or has its stored password hash updated to match if it does. There is no self-service sign-up route; the only way to become an admin is to be listed in this env var. To revoke someone's access, delete their row from the `users` table directly — removing them from the env var alone does not delete their account.
- **Legacy compatibility**: The old `x-owner-key` header is still accepted on `POST /api/owner/verify` for existing integrations during transition.

Additional hardening in place:

| Protection | Where |
|---|---|
| Image upload **magic bytes** check (declared MIME type must match actual file content bytes) | `POST /api/upload` |
| Image upload type allowlist (JPG/PNG/GIF/WEBP only — no SVG, which can carry inline scripts) | `POST /api/upload` |
| Image upload size cap (8MB decoded) | `POST /api/upload` |
| Randomized upload filenames | `POST /api/upload` |
| Per-IP rate limiting | `/api/redirect/:id`, `/api/track/click`, `/api/upload` |
| Product update field allowlist (no blind merge of arbitrary request fields) | `PUT /api/products/:id` |
| Request body size capped at 12MB (down from an unbounded 50MB) | app-wide |

---

## 4. Analytics

Available under **Owner Hub → Records & Clicks**, and via `GET /api/analytics`:

- **Total clicks** and **unique visitors** — uniqueness is computed from an anonymous fingerprint (`sha256(ip + user-agent + date)`), not a real account/session system, so it resets daily and never stores raw IPs. Counts remain zero until real clicks occur.
- **Conversion rate** — conversions ÷ clicks, from manually or programmatically recorded `ConversionEvent`s. See also the webhook endpoint for automated recording from third-party affiliate networks.
- **Data retention** — click records older than `CLICK_RETENTION_DAYS` (default 90) are automatically purged on startup and every 24 hours to prevent unbounded database growth.
- **14-day click trend**, **top products by clicks**, **platform/category/device breakdowns**, and a **recent live click stream** (last 50) with CSV export. New deployments begin with no synthetic records.

---

## 5. Data Model

Data persists in a networked Postgres database (e.g. a free [Neon](https://neon.tech) project), accessed via the `pg` client library, connected using `DATABASE_URL`. Unlike a local SQLite file, this survives redeploys, restarts, and instance recycling on ephemeral-filesystem hosts (Render, Railway, etc.) — nothing about persistence depends on the app server's own disk. Product images are still saved to local disk (`UPLOADS_DIR`) and remain subject to that ephemeral-filesystem caveat unless moved to external storage.

| Table | Contents |
|---|---|
| `products`    | Product catalog (Amazon platform only) |
| `clicks`      | Every outbound click event |
| `conversions` | Recorded conversions (manual or webhook) |
| `users`       | Admin accounts (email, scrypt password hash, salt, role) — synced from `ADMIN_ACCOUNTS` on boot |

| Type | Key fields |
|---|---|
| `Product`         | `id`, `title`, `description`, `category`, `imageUrl`, `platform` (`'Amazon'`), `affiliateUrl`, `affiliateTag`, `featured` |
| `ClickEvent`      | `id`, `productId`, `timestamp`, `referrer`, `device`, `utmSource/Medium/Campaign`, `destinationUrl`, `visitorHash` |
| `ConversionEvent` | `id`, `clickId`, `productId`, `timestamp`, `platform` |
| `User`            | `id`, `username` (holds an email), `passwordHash`, `salt`, `role`, `createdAt` |

---

## 6. API Reference

| Method | Route | Auth | Purpose |
|---|---|---|---|
| `GET`  | `/api/health`                  | —   | Health check |
| `POST` | `/api/auth/login`              | —   | Login with email+password (as `{username, password}`), returns JWT |
| `GET`  | `/api/auth/me`                 | ✅  | Return current authenticated user |
| `POST` | `/api/owner/verify`            | —   | Legacy passcode verify (backwards-compat) |
| `GET`  | `/api/products`                | —   | List products (`?category=`, `?search=`, `?platform=`, `?featured=`) |
| `GET`  | `/api/products/:id`            | —   | Get one product |
| `POST` | `/api/products`                | ✅  | Create a product (Amazon platform only) |
| `PUT`  | `/api/products/:id`            | ✅  | Update a product (Amazon platform only) |
| `DELETE` | `/api/products/:id`          | ✅  | Delete a product |
| `POST` | `/api/upload`                  | ✅  | Upload a product image (base64 data URL, magic-bytes validated) |
| `GET`/`GET` | `/api/redirect/:id`, `/r/:id` | — (rate-limited) | Log a click and 302-redirect to Amazon |
| `POST` | `/api/track/click`             | — (rate-limited) | Client-side click beacon, returns the destination URL without redirecting |
| `POST` | `/api/analytics/conversion`    | ✅  | Record a conversion manually |
| `POST` | `/api/webhooks/conversion`     | HMAC | Accept signed conversion webhook from affiliate networks |
| `GET`  | `/api/analytics/public`        | —   | Public `clicksToday` aggregate only |
| `GET`  | `/api/analytics`               | ✅  | Full owner analytics summary |
| `POST` | `/api/analytics/reset`         | ✅  | Wipe and reseed analytics data |

✅ = requires a valid `Authorization: Bearer <jwt>` header.
HMAC = requires a valid `X-Webhook-Signature: sha256=<hmac>` header (HMAC-SHA256 with `WEBHOOK_SECRET`).

---

## 7. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 6, Tailwind CSS 4, Motion (animations), Recharts (charts), Lucide (icons) |
| Backend  | Express 4, TypeScript, `jsonwebtoken`, `tsx` (dev) / `esbuild` (production bundle) |
| Database | Postgres (e.g. free Neon) via `pg`; `public/uploads/` for images |
| Testing  | Node's built-in `node:test` runner — `npm test` runs 16 tests, 0 dependencies |

---

## 8. Project Structure

```
├── server.ts                        # Express API, JWT auth, redirects, webhooks, retention scheduler
├── db.ts                            # Postgres schema + data-access layer + user management
├── index.html                       # Vite entry HTML
├── metadata.json                    # Project metadata (name: "Simple Hub")
├── public/uploads/                  # Uploaded product images (local disk — see Security note)
├── tests/
│   └── db.test.ts                   # Automated test suite (16 tests — node:test)
├── src/
│   ├── App.tsx                      # Top-level view routing (storefront vs owner hub)
│   ├── main.tsx                     # React entry point
│   ├── types.ts                     # Shared TypeScript types (platform: 'Amazon')
│   ├── index.css                    # Tailwind entry
│   ├── services/api.ts              # Client-side API wrapper + JWT Bearer token handling
│   └── components/
│       ├── Navbar.tsx
│       ├── Footer.tsx
│       ├── ProductCard.tsx
│       ├── ProductDetailModal.tsx
│       ├── ProductAdminModal.tsx    # Add/edit product form, image upload
│       ├── OwnerProductManager.tsx  # Product list/grid management UI
│       ├── AnalyticsDashboard.tsx   # Records & Clicks tab
│       ├── OwnerGate.tsx            # Email + password login form (JWT)
│       └── RedirectNotification.tsx # "Opening Amazon..." toast
├── .env.example                     # Environment variable template
├── README.md                        # Quick start
├── OVERVIEW.md                      # This file
└── DEPLOYMENT.md                    # Render deployment guide
```

---

## 9. Known Limitations (Resolved)

- **No real affiliate-network webhook.** A generic HMAC-signed `POST /api/webhooks/conversion` endpoint is now available. Amazon Associates has no native real-time webhook API; use the manual `POST /api/analytics/conversion` endpoint after reviewing earnings in Associates Central, or wire the webhook endpoint to a compatible network (Impact, CJ Affiliate, ShareASale).
- **Seed catalog includes non-Amazon platforms.** The `platform` type is now narrowed to `'Amazon'` only. Non-Amazon products can no longer be created or updated via the API.
- **Single shared owner passcode.** Replaced with JWT-based multi-admin auth (`POST /api/auth/login`). Accounts are defined via the `ADMIN_ACCOUNTS` env var, hashed and synced into the `users` table on every boot.
- **Single SQLite file.** Replaced with a networked Postgres database (e.g. free Neon), which survives redeploys and instance recycling on ephemeral-filesystem hosts — the original motivation for this change.
- **`@google/genai` dependency.** Already removed from `package.json` — the OVERVIEW was stale.
- **No data retention rules.** Click records older than `CLICK_RETENTION_DAYS` (default 90 days) are now automatically purged on startup and daily.
- **No image content validation.** Magic bytes are now checked against the declared MIME type to prevent spoofed uploads.
- **No automated test suite.** `npm test` now runs `tests/db.test.ts` covering CRUD, retention, conversions, and magic bytes validation.
- **Product images still on local disk.** `UPLOADS_DIR` is not covered by the Postgres migration above — on ephemeral-filesystem hosts, uploaded images are still lost on redeploy unless moved to a persistent volume or external storage (e.g. Cloudinary, S3-compatible storage).
