# Raccoon Hub Project Status

Last updated: 2026-08-28

## Project Summary

Raccoon Hub is a lightweight affiliate storefront for displaying owner-managed product cards and forwarding visitors through tracked affiliate links. It includes a protected Owner Hub for product management and click analytics.

The project intentionally does not use prices, checkout, user accounts, passwords, payment processing, or a database connection.

## Technology

- Frontend: React, TypeScript, Vite, Tailwind CSS, Motion, Recharts, Lucide
- Backend: Express with TypeScript
- Development runtime: `tsx`
- Production runtime: bundled Node server with `esbuild`
- Persistence: SQLite (Node's built-in `node:sqlite`) — a single `raccoon-hub.sqlite` file
- Authentication: shared `OWNER_KEY` request header

## Current Data Flow

1. Owner enters a product through the Owner Hub.
2. The backend validates and stores the product in SQLite (`data/raccoon-hub.sqlite`).
3. A visitor clicks a product card.
4. `/api/redirect/:id` records one click in SQLite and redirects the visitor.
5. The Owner Hub reads protected analytics from `/api/analytics`.
6. Public pages receive only the aggregate `clicksToday` value.
7. Conversion records, if manually added by the owner, are stored in SQLite.

On first boot, historical data from the legacy `data/*.json` files is imported into SQLite automatically.

## Completed Tasks

### Security and secrets

- Removed hardcoded owner-key values from the tracked environment template.
- Added `.env` and `.env.*` protection in `.gitignore`.
- Added `OWNER_KEY` production startup validation.
- Protected owner product, upload, analytics, conversion, and reset routes.
- Added owner-key rate limiting: 5 attempts per minute per IP.
- Added Helmet security headers and Content Security Policy.
- Added correlation IDs to responses.
- Replaced detailed client/server error payload logging with generic messages.
- Confirmed no database URLs, API keys, private keys, payment secrets, or third-party service credentials are present.
- Confirmed no debug, test, seed, or admin-backdoor endpoints exist.

### Privacy and API exposure

- Public analytics exposes only `clicksToday`.
- Detailed analytics requires owner authentication.
- Visitor hashes are omitted from API responses.
- Referrers are normalized before storage.
- Owner credentials use session storage instead of local storage.
- No user accounts, emails, phone numbers, addresses, passwords, or payment data are collected.

### Analytics and business logic

- Fixed duplicate click counting. A product-card click now uses the redirect route as the single click-recording path.
- Removed client-controlled conversion amounts. Conversion records no longer accept arbitrary financial values.
- Removed price and financial fields from product and analytics models because the project does not use prices.
- Removed fake visitor-count fallbacks.
- Removed synthetic product, click, and conversion generation.
- Cleared the checked-in synthetic analytics fixtures.
- Analytics now starts empty and is populated only by real activity.

### Persistence

- Replaced flat JSON files with a single SQLite database (`raccoon-hub.sqlite`) using Node's built-in `node:sqlite` (no native dependencies, no external database server).
- Products, clicks, and conversions now live in SQLite tables with proper write-locking and transactional inserts.
- Added automatic, idempotent startup migration that imports existing `data/products.json`, `data/clicks.json`, and `data/conversions.json` into SQLite on first boot (JSON files are preserved as backups).
- Added configurable `DATA_DIR` and `UPLOADS_DIR` environment variables.
- Added persistent-volume guidance to `.env.example` and project documentation.
- Removed the unused `@google/genai` dependency.

### UI and layout

- Removed the top announcement bar.
- Removed the top-bar click counter.
- Removed public Storefront, Owner & Records, and Add Product navigation buttons.
- Removed the Amazon badge beside the Raccoon Hub logo.
- Removed the mobile navigation dock.
- Removed dark mode completely.
- Set the phone product grid to two cards side by side.
- Kept the light neo-brutalist visual theme.

## Validation Completed

The following checks have passed after the latest changes:

```text
npm run lint
npm run build
git diff --check
```

Additional runtime checks completed:

- Legacy JSON -> SQLite migration imported existing products, clicks, and conversions on first boot.
- `npm run lint` and `npm run build` (Vite + esbuild bundle) pass with the SQLite-backed `server.ts`.
- Production server booted and served `/api/health` from the SQLite store.
- `node:sqlite` loads and runs correctly on the target Node version (no native compilation needed).
- Valid owner key accepted with HTTP 200.
- Invalid owner key rejected with HTTP 401.
- Detailed analytics rejected without authentication.
- Owner-key rate limit returned HTTP 429 after the allowed attempts.
- Security headers verified in production mode.
- Production startup refused when `OWNER_KEY` was missing.
- `.env` and `.git/config` contents were not exposed.
- No known secret formats were found in tracked source/config files.

## Current Files of Interest

- `server.ts`: Express API, authentication, persistence, uploads, redirects, analytics, security middleware
- `db.ts`: SQLite schema, data-access layer, and legacy JSON migration
- `src/App.tsx`: storefront/Owner Hub routing and product interaction flow
- `src/components/Navbar.tsx`: simplified logo and search header
- `src/components/ProductAdminModal.tsx`: owner product creation/edit form
- `src/components/OwnerProductManager.tsx`: owner product management
- `src/components/AnalyticsDashboard.tsx`: owner analytics interface
- `src/services/api.ts`: frontend API client and owner-key handling
- `src/types.ts`: shared product, click, conversion, and analytics types
- `data/raccoon-hub.sqlite`: persisted SQLite database (products, clicks, conversions)
- `.env.example`: environment variable template
- `README.md`: project quick start and deployment checklist
- `OVERVIEW.md`: architecture and API documentation

## Pending Tasks

### Required before production deployment

- Configure a strong, unique `OWNER_KEY` in the hosting provider's secret/environment settings.
- Configure `DATA_DIR` and `UPLOADS_DIR` to point to a mounted persistent volume.
- Ensure the runtime is Node.js ≥ 22.5 (for the built-in `node:sqlite` module).
- Deploy behind HTTPS so the owner key is not sent over plain HTTP.
- Confirm the hosting provider does not use an ephemeral filesystem for the SQLite database and uploads.
- Confirm the production build and health endpoint after deployment.

### Recommended future improvements

- Switch from SQLite to PostgreSQL if the backend must scale horizontally across many instances.
- Add automated API and persistence tests.
- Add real affiliate-network conversion webhooks if conversion reporting is needed.
- Replace the shared owner passcode with account-based authentication and role-based access if multiple operators are required.
- Add backup and restore procedures for product and analytics files.
- Add data retention rules for click telemetry.
- Add image-content validation using a media parser if uploads become public or high-risk.

## Important Limitations

- SQLite persistence survives refreshes and server restarts only when the storage directory/volume survives.
- Deployments with ephemeral storage can lose products, uploads, and analytics after redeployment.
- SQLite is single-writer and suited to one backend instance; horizontal scaling requires a networked database.
- Requires Node.js ≥ 22.5 for the built-in `node:sqlite` module.
- The conversion endpoint is a local/manual record mechanism, not a verified payment-provider webhook.
- A single shared owner key grants all Owner Hub permissions.
- No automated test suite currently exists; validation relies on type checking, production builds, and manual/runtime smoke tests.

## Recommended Deployment Variables

```env
OWNER_KEY=use_a_long_unique_secret_here
PORT=3000
DATA_DIR=/var/data
UPLOADS_DIR=/var/data/uploads
```

Never commit the real `.env` file or a real `OWNER_KEY` to the repository.
