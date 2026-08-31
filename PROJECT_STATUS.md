# Raccoon Hub Project Status

Last updated: 2026-08-31

---

## Project Summary

Raccoon Hub is a lightweight affiliate storefront for displaying owner-managed product cards and forwarding visitors through tracked Amazon affiliate links. It includes a protected Owner Hub for product management and full click analytics.

The project is scoped exclusively to **Amazon Associates**. It does not use prices, checkout, payment processing, or a networked database.

---

## Technology

- **Frontend:** React 19, TypeScript, Vite 6, Tailwind CSS 4, Motion (animations), Recharts (charts), Lucide (icons)
- **Backend:** Express 4, TypeScript
- **Development runtime:** `tsx`
- **Production runtime:** Node server bundled with `esbuild`
- **Persistence:** SQLite via Node's built-in `node:sqlite` — a single `raccoon-hub.sqlite` file (no external DB server)
- **Authentication:** JWT-based multi-user auth (`jsonwebtoken`); passwords hashed with `crypto.scrypt`
- **Tests:** Node's built-in `node:test` runner (no extra test dependency)

---

## Current Data Flow

1. Owner logs in to the Owner Hub (`/#admin`) with a username and password — receives a signed JWT.
2. Owner adds a product through the Owner Hub (Amazon platform only).
3. The backend validates, stores the product in SQLite (`data/raccoon-hub.sqlite`), and returns the new product.
4. A visitor clicks a product card → `/api/redirect/:id` logs one click (timestamp, device, referrer, visitor hash) in SQLite and issues a 302 redirect to Amazon.
5. The Owner Hub reads protected analytics from `/api/analytics` (JWT required).
6. Public pages receive only the aggregate `clicksToday` value from `/api/analytics/public`.
7. Conversions can be recorded manually via `POST /api/analytics/conversion` or automatically via the HMAC-signed `POST /api/webhooks/conversion` endpoint.
8. On startup and every 24 hours, click records older than `CLICK_RETENTION_DAYS` (default 90) are purged automatically.
9. On first boot, historical data from legacy `data/*.json` files is imported into SQLite automatically.

---

## Completed Tasks

### UI Design System & Theme Engine
- **Neo-Brutalist Theme System**: Custom HSL/CSS token design system with light and dark mode support (`--background`, `--foreground`, `--border`, `--nav-bg`, `--card`).
- **Standardized Border & Offset Shadows**: Cards, category buttons, and product wrappers use solid black (`#111111`) structural borders with dynamic `--border` offset shadows (turning white `#FFFFFF` in dark mode).
- **Glassmorphism Header**: Navigation bar featuring frosted glass background (`bg-[var(--nav-bg)]` + `backdrop-blur-md`).
- **Hardware-Accelerated View Transitions API Theme Toggle**:
  - **Light → Dark Mode**: Expanding Dark Mode circle originating from the click coordinates of the mode toggle button.
  - **Dark → Light Mode**: Shrinking Dark Mode circle collapsing back into the mode toggle button coordinates.
  - Implemented via compositor-thread CSS keyframes (`@keyframes theme-circle-expand` & `@keyframes theme-circle-shrink`) for jitter-free 60 FPS performance and zero 1-frame black screen flashes.
- **Dynamic Bento & Classic Layout Toggle**: Allows visitors to toggle between a dynamic Bento grid (`hero`, `wide`, `tall`, `standard` bento variants) and a uniform grid view.
- **In-App Admin Password Change Modal**: `ChangePasswordModal.tsx` enables authenticated owners to change their account password via `POST /api/auth/change-password`.
- **Redirect Toast Notification Component**: `RedirectNotification.tsx` provides interactive feedback banners on outbound click actions.
- **Interactive Category Filters**: Category pills feature dynamic hover effects (yellow background + black text).

### Security and secrets

- Removed hardcoded owner-key values from the tracked environment template.
- Added `.env` and `.env.*` protection in `.gitignore`.
- **Replaced single `OWNER_KEY` passcode with JWT-based multi-user authentication.**
  - `POST /api/auth/login` exchanges username + password for a signed JWT.
  - Passwords are hashed with `crypto.scrypt` (64-byte key, random salt per user).
  - `JWT_SECRET` signs all tokens; missing in production = server refuses to start.
  - `requireAuth` middleware validates token signature and expiry on all protected routes.
  - First-boot bootstrap: creates initial admin account from `OWNER_USER` / `OWNER_PASS` env vars.
  - Legacy `x-owner-key` header still accepted on `POST /api/owner/verify` for transition.
- Added login rate limiting: 5 attempts per minute per IP.
- Added Helmet security headers and Content Security Policy.
- Added correlation IDs to all responses.
- Replaced detailed client/server error payload logging with generic messages.
- Confirmed no database URLs, API keys, private keys, payment secrets, or third-party service credentials are present.
- Confirmed no debug, test, seed, or admin-backdoor endpoints exist.

### Privacy and API exposure

- Public analytics exposes only `clicksToday`.
- Detailed analytics requires JWT authentication.
- Visitor hashes are omitted from API responses.
- Referrers are normalized before storage.
- Owner JWT stored in session storage (not local storage).
- No user emails, phone numbers, addresses, or payment data are collected.

### Analytics and business logic

- Fixed duplicate click counting. A product-card click now uses the redirect route as the single click-recording path.
- Removed client-controlled conversion amounts. Conversion records no longer accept arbitrary financial values.
- Removed price and financial fields from product and analytics models.
- Removed fake visitor-count fallbacks.
- Removed synthetic product, click, and conversion generation.
- Cleared the checked-in synthetic analytics fixtures.
- Analytics starts empty and is populated only by real activity.

### Persistence and data retention

- Replaced flat JSON files with a single SQLite database (`raccoon-hub.sqlite`) using Node's built-in `node:sqlite`.
- Products, clicks, conversions, and users now live in SQLite tables with proper write-locking and transactional inserts.
- Added `users` table for multi-user auth (username, passwordHash, salt, role, createdAt).
- Added automatic, idempotent startup migration from legacy `data/*.json` files.
- Added configurable `DATA_DIR` and `UPLOADS_DIR` environment variables.
- **Added automatic data retention:** `deleteClicksOlderThan(days)` purges old click records on startup and every 24 hours. Configured via `CLICK_RETENTION_DAYS` (default: 90 days).
- Removed the unused `@google/genai` dependency.

### Platform restriction (Amazon-only)

- Narrowed `Product.platform` TypeScript type to `'Amazon'` only (removed TikTok Shop, AliExpress, Etsy, Other).
- `POST /api/products` and `PUT /api/products/:id` now validate and reject non-Amazon platforms with HTTP 400.
- All SQLite column defaults updated to `'Amazon'`.

### Image upload security

- Image upload restricted to JPG/PNG/GIF/WEBP (no SVG — prevents stored XSS via inline scripts).
- **Added magic bytes validation:** actual file content bytes are checked against the declared MIME type. A file renamed to `.png` with non-PNG content is rejected before it touches disk.
- Image size capped at 8 MB decoded. Randomized upload filenames.

### Conversion webhooks

- Added `POST /api/webhooks/conversion` — accepts signed payloads from affiliate networks (Impact, CJ Affiliate, ShareASale, etc.).
- Verifies `X-Webhook-Signature: sha256=<hmac>` using `WEBHOOK_SECRET`. Timing-safe comparison prevents timing attacks.
- Amazon Associates has no native real-time webhook API; use `POST /api/analytics/conversion` manually or wire `WEBHOOK_SECRET` to a compatible network.

### Automated tests

- Added `tests/db.test.ts` using Node's built-in `node:test` runner — no additional test dependency.
- `npm test` runs 16 tests across 5 suites: Products CRUD, Clicks, Data Retention, Conversions, and Image magic bytes validation. **All 16 pass.**

### UI and layout

- Removed the top announcement bar.
- Removed the top-bar click counter.
- Removed public Storefront, Owner & Records, and Add Product navigation buttons.
- Removed the Amazon badge beside the Raccoon Hub logo.
- Removed the mobile navigation dock.
- Removed dark mode completely.
- Set the phone product grid to two cards side by side.
- Kept the light neo-brutalist visual theme.
- **Updated `OwnerGate.tsx`:** single passcode prompt replaced with username + password form.

---

## Validation Completed

The following checks have passed after the latest changes:

```text
npm run lint   ✅ (TypeScript type-check — zero errors)
npm test       ✅ (16/16 tests pass)
```

Additional runtime checks completed:

- Legacy JSON → SQLite migration imported existing products, clicks, and conversions on first boot.
- `users` table created and initial admin account bootstrapped on first boot.
- `POST /api/auth/login` with valid credentials → HTTP 200 + JWT.
- `POST /api/auth/login` with bad password → HTTP 401.
- Admin route without token → HTTP 401.
- Admin route with valid JWT → HTTP 200.
- Login rate limit returned HTTP 429 after the allowed attempts.
- Non-Amazon platform rejected on `POST /api/products` → HTTP 400.
- JPEG magic bytes accepted; ZIP magic bytes declared as PNG rejected → HTTP 400.
- Click retention purge deleted old records, preserved recent records.
- Security headers verified in production mode.
- Production startup refused when `JWT_SECRET` was missing.
- `.env` and `.git/config` contents were not exposed.
- No known secret formats were found in tracked source/config files.

---

## Current Files of Interest

- `server.ts` — Express API, JWT auth, redirects, telemetry, webhooks, magic bytes upload, retention scheduler
- `db.ts` — SQLite schema (products, clicks, conversions, users), data-access layer, JSON migration, retention, user management
- `src/App.tsx` — storefront/Owner Hub routing and product interaction flow
- `src/components/OwnerGate.tsx` — username + password login form (JWT)
- `src/components/ProductAdminModal.tsx` — owner product creation/edit form
- `src/components/OwnerProductManager.tsx` — owner product management
- `src/components/AnalyticsDashboard.tsx` — owner analytics interface
- `src/services/api.ts` — frontend API client and JWT Bearer token handling
- `src/types.ts` — shared TypeScript types (platform narrowed to `'Amazon'`)
- `tests/db.test.ts` — automated test suite (16 tests)
- `data/raccoon-hub.sqlite` — persisted SQLite database (products, clicks, conversions, users)
- `.env.example` — environment variable template (updated for JWT, retention, webhooks)
- `README.md` — project quick start and deployment checklist
- `OVERVIEW.md` — architecture and API documentation

---

## Pending Tasks

### Required before production deployment

- Set a strong, unique `JWT_SECRET` in the hosting provider's secret/environment settings.
- Set `OWNER_USER` and `OWNER_PASS` for first-boot admin account creation (can be removed after first login).
- Configure `DATA_DIR` and `UPLOADS_DIR` to point to a mounted persistent volume.
- Ensure the runtime is Node.js ≥ 22.5 (for the built-in `node:sqlite` module).
- Deploy behind HTTPS so JWTs are not sent over plain HTTP.
- Confirm the hosting provider does not use an ephemeral filesystem for the SQLite database and uploads.
- Confirm the production build and health endpoint after deployment.

### Recommended future improvements

- Switch from SQLite to PostgreSQL if the backend must scale horizontally across multiple instances.
- Add backup and restore procedures for the SQLite database and uploads volume.
- Wire `WEBHOOK_SECRET` to a live affiliate network (Impact, CJ, ShareASale) for automated conversion tracking.
- Add more granular role-based access control if multiple operators need distinct permission levels.
- Add a password-change endpoint so admins can rotate credentials without redeploying.

---

## Important Limitations

- SQLite persistence survives refreshes and server restarts only when the storage directory/volume survives. Ephemeral-filesystem deployments will lose data on redeploy.
- SQLite is single-writer and suited to one backend instance; horizontal scaling requires a networked database.
- Requires Node.js ≥ 22.5 for the built-in `node:sqlite` module.
- Amazon Associates has no native real-time conversion webhook; conversions are recorded manually or via a third-party network webhook.
- JWT tokens are invalidated on `JWT_SECRET` rotation — all active sessions will need to re-login.

---

## Recommended Deployment Variables

```env
# Required
JWT_SECRET=<long-random-secret>
OWNER_USER=admin
OWNER_PASS=<strong-password>
PORT=3000
DATA_DIR=/var/data
UPLOADS_DIR=/var/data/uploads

# Optional
JWT_EXPIRY=8h
CLICK_RETENTION_DAYS=90
WEBHOOK_SECRET=<long-random-secret>
```

Never commit the real `.env` file or any secrets to the repository.
