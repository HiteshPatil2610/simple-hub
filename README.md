# 🦝 Raccoon Hub

**A lightweight, high-performance affiliate storefront and outbound click-tracking platform, purpose-built for Amazon Associates.**

Raccoon Hub lets content creators, curators, and niche site owners share hand-picked Amazon finds through a fast, distraction-free storefront — with a full owner dashboard for managing products and tracking outbound clicks, without the overhead of a traditional e-commerce CMS.

![Node](https://img.shields.io/badge/node-%3E%3D22.5-brightgreen)
![TypeScript](https://img.shields.io/badge/typescript-5.8-blue)
![React](https://img.shields.io/badge/react-19-61DAFB)
![Tests](https://img.shields.io/badge/tests-16%20passing-brightgreen)
![License](https://img.shields.io/badge/license-private-lightgrey)

---

## ✨ Features

- **Neo-Brutalist design system** — bold typography, curated HSL color tokens, solid `#111111` borders, frosted glass header backdrop, and yellow interactive hover states.
- **Circular View Transitions theme toggle** — hardware-accelerated circular reveal (Light → Dark) and shrinking collapse (Dark → Light) using the native Browser View Transitions API (`@keyframes theme-circle-expand` / `theme-circle-shrink`), with state persisted in `localStorage` (`raccoon_hub_theme`).
- **Dynamic Bento & Classic layout toggle** — switch between a dynamic Bento Grid featuring `hero`, `wide`, `tall`, and `standard` card variants, and a traditional uniform grid layout.
- **Curated storefront** — a responsive card grid with real-time search and category filters. Products are entered by the owner and displayed with image, title, description, category, and a "View on Amazon" button.
- **Amazon-only affiliate links** — paste any `amazon.com/dp/...` link or `amzn.to/...` short link; affiliate tags and UTM parameters are applied automatically. Only Amazon platform is supported.
- **Server-side redirect & telemetry** — every outbound click routes through a tracking endpoint that logs timestamp, device type, referrer, and UTM data *before* forwarding the visitor with an interactive redirect notification toast.
- **Owner Control Hub** — an email + password–gated admin panel to add/edit/delete products, upload images straight from your device, change admin password (`ChangePasswordModal`), and review analytics.
- **Live analytics** — total clicks, real (hashed, anonymous) unique visitors, a 14-day trend graph, a product leaderboard, a searchable click stream, and CSV export. New deployments start empty and populate only from real activity.
- **Multi-admin auth, no external service** — admin accounts (email + password) are defined via one `ADMIN_ACCOUNTS` env var; passwords are hashed with `crypto.scrypt` before storage; sessions are short-lived JWTs (default 8 h). Includes an in-app password update dialog (`/api/auth/change-password`).
- **Conversion webhooks** — `POST /api/webhooks/conversion` accepts HMAC-signed payloads from affiliate networks (Impact, CJ, ShareASale).
- **Automatic data retention** — click records older than `CLICK_RETENTION_DAYS` (default 90 days) are purged on startup and daily.
- **Secured by default** — every mutating admin route requires a valid JWT, uploads are type/size/magic-bytes validated, and click endpoints are rate-limited.
- **Automated tests** — `npm test` runs 16 tests using Node's built-in `node:test` runner (no extra test dependency).

---

## 🖥️ How It Works

```
[Store Owner]
      │
      ├─► Logs in to Owner Hub (/#admin) with email + password → receives JWT
      ├─► Adds/edits a product — title, description, category (Amazon only)
      ├─► Uploads a product photo (magic-bytes validated, max 8 MB)
      └─► Pastes a direct Amazon affiliate link
            │
            ▼
   [Raccoon Hub Storefront]
            │
            ▼  Visitor browses & clicks "View on Amazon"
            │
  [/api/redirect/:id  — server-side tracking endpoint]
            │
            ├─► Rate-limited per IP
            ├─► Logs telemetry: timestamp, device, referrer, anonymous visitor hash
            ├─► Updates click counters (old records purged automatically)
            │
            ▼
    [Amazon product page — affiliate tag + UTM params attached]

   [Affiliate Network] ──► POST /api/webhooks/conversion (HMAC-signed)
```

1. **Add a product** — the owner signs in, uploads an image, and enters the title, category, description, and Amazon affiliate link. It goes live immediately.
2. **Visitor browses** — search by keyword, filter by category, and preview a product in a quick-view modal.
3. **Click tracking** — clicking "View on Amazon" hits the redirect endpoint, which logs the click and forwards the visitor to Amazon with a 302 redirect.
4. **Review performance** — the owner checks click counts, conversion rate, top products, and device breakdowns from the Records & Clicks tab, with CSV export.

---

## 🧱 Tech Stack

| Layer    | Technology |
|---|---|
| Frontend | React 19 · Vite 6 · Tailwind CSS 4 · Motion (animations) · Recharts · Lucide icons |
| Backend  | Express 4 · TypeScript · `jsonwebtoken` · `tsx` (dev) / `esbuild` (production) |
| Database | Postgres (e.g. free Neon) via `pg` — networked, survives redeploys/restarts |
| Testing  | Node's built-in `node:test` — 16 tests, zero extra test dependencies |

---

## 📂 Project Structure

```
├── server.ts                        # Express API — JWT auth, redirects, webhooks, retention
├── db.ts                            # Postgres schema + data-access layer + user management
├── index.html                       # Vite entry HTML
├── public/uploads/                  # Uploaded product images (local disk — see Security note)
├── tests/
│   └── db.test.ts                   # Automated test suite (16 tests — node:test)
├── src/
│   ├── App.tsx                      # Top-level view routing (storefront vs owner hub)
│   ├── types.ts                     # Shared TypeScript types (platform: 'Amazon')
│   ├── services/api.ts              # Client-side API wrapper + JWT Bearer token handling
│   └── components/
│       ├── Navbar.tsx / Footer.tsx
│       ├── ProductCard.tsx / ProductDetailModal.tsx
│       ├── ProductAdminModal.tsx    # Add/edit product form + image upload
│       ├── OwnerProductManager.tsx  # Product management UI
│       ├── AnalyticsDashboard.tsx   # Records & Clicks tab
│       ├── OwnerGate.tsx            # Email + password login form (JWT)
│       └── RedirectNotification.tsx
├── .env.example                     # Environment variable template
├── README.md                        # You are here
├── OVERVIEW.md                      # Full architecture & API reference
└── DEPLOYMENT.md                    # Render deployment guide
```

---

## 🚀 Getting Started

**Prerequisites:** Node.js 18+, a Postgres database (e.g. a free [Neon](https://neon.tech) project)

```bash
# 1. Clone and install
git clone <your-repo-url>
cd raccoon-hub
npm install

# 2. Set up environment variables
cp .env.example .env
```

Generate a JWT secret and define your admin accounts in `.env`:

```bash
# Generate JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Edit `.env`:
```env
DATABASE_URL=<your Postgres connection string, e.g. from Neon>
JWT_SECRET=<paste generated secret>
ADMIN_ACCOUNTS=you@example.com:choose-a-strong-password
```

```bash
# 3. Run it
npm run dev
```

Open `http://localhost:3000`. Visit `http://localhost:3000/#admin` and sign in with one of the email/password pairs from `ADMIN_ACCOUNTS` to reach the Owner Control Hub.

> ℹ️ On every boot, each `email:password` pair listed in `ADMIN_ACCOUNTS` is created if it doesn't exist yet, or has its stored password hash updated to match if it does. Add more people by adding more comma-separated pairs; rotate a password by editing it and redeploying. Only the salted hash is ever written to the database — the env var is a source of truth for boot-time syncing, not persistent storage of the plaintext.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev`   | Run locally with Vite + Express in dev mode |
| `npm run build` | Build the frontend (Vite) and bundle the server (esbuild) |
| `npm start`     | Run the production build (requires `npm run build` first) |
| `npm run lint`  | Type-check with `tsc --noEmit` |
| `npm test`      | Run automated test suite (16 tests, Node built-in runner) |

---

## 🔐 Security

- **Multi-admin JWT auth, no external service** — the Owner Control Hub and every mutating API route require a valid `Authorization: Bearer <token>` header. Login via `POST /api/auth/login`. Accounts are defined entirely by the `ADMIN_ACCOUNTS` env var (see Getting Started) — no self-service sign-up, no third-party auth provider.
- **Passwords** — hashed with `crypto.scrypt` (64-byte key, random salt per user). Never stored in plaintext; only the hash lives in the database.
- **Image uploads** — restricted to JPG/PNG/GIF/WEBP (no SVG), capped at 8 MB, **magic bytes verified** (actual file content must match declared MIME type), randomized filenames.
- **Platform restriction** — only Amazon affiliate links are accepted. Non-Amazon platform values are rejected at the API level.
- **Redirect & click-tracking endpoints** — rate-limited per IP.
- **Conversion webhooks** — `POST /api/webhooks/conversion` requires a valid HMAC-SHA256 signature (`X-Webhook-Signature: sha256=<hmac>` with `WEBHOOK_SECRET`).
- **Data retention** — click records older than `CLICK_RETENTION_DAYS` (default 90 days) are automatically purged.
- **Helmet** — `nosniff`, `X-Frame-Options: DENY`, one-year HSTS, same-origin CSP.
- Full details in [OVERVIEW.md → Section 3](./OVERVIEW.md#3-authentication--security).

> ⚠️ `JWT_SECRET` must be set before starting the server in production. Protected routes fail closed when it is missing.

### Pre-deployment checklist

| Item | Status |
|---|---|
| `JWT_SECRET` set in production environment | Required |
| `DATABASE_URL` pointing to a reachable Postgres instance (e.g. Neon) | Required |
| `ADMIN_ACCOUNTS` set with at least one `email:password` pair | Required |
| `UPLOADS_DIR` pointing to persistent volume, or images moved to external storage | Recommended — local disk is ephemeral on most PaaS free tiers |
| HTTPS in front of the server | Required — JWTs must not travel over plain HTTP |
| Node.js ≥ 18 on the host | Required |
| Debug code / test routes | PASS — none present |
| Error handling | PASS — generic messages + correlation ID; details server-side only |
| Security headers | PASS — Helmet, CSP, HSTS, X-Frame-Options |
| Rate limiting | PASS — login (5/min), redirects (60/min), uploads (20/min), beacons (120/min), webhooks (30/min) |
| CORS | PASS — no CORS middleware; same-origin only |

### Secret rotation

- Rotate `JWT_SECRET` to invalidate all active sessions (all users will need to re-login).
- Rotate a specific admin's password by editing their entry in `ADMIN_ACCOUNTS` and redeploying.
- The old `OWNER_KEY` single-passcode system is kept only as a legacy fallback on `POST /api/owner/verify` for old integrations; new logins should always use `POST /api/auth/login`.

---

## 🪝 Conversion Webhooks

Amazon Associates does not provide real-time conversion webhooks natively. Two options:

1. **Manual** — after reviewing your earnings in Associates Central, call `POST /api/analytics/conversion` with your owner JWT.
2. **Automated** — set `WEBHOOK_SECRET` in your environment and configure a third-party affiliate network (Impact, CJ Affiliate, ShareASale) to POST signed conversion events to `POST /api/webhooks/conversion`.

The webhook endpoint verifies `X-Webhook-Signature: sha256=<hmac>` (HMAC-SHA256 of the raw request body using `WEBHOOK_SECRET`) before recording the conversion.

---

## 🧪 Tests

```bash
npm test
```

```
▶ Products CRUD         5 tests ✔
▶ Clicks                3 tests ✔
▶ Data Retention        1 test  ✔
▶ Conversions           1 test  ✔
▶ Image magic bytes     6 tests ✔

tests 16 · pass 16 · fail 0
```

Tests run against their own isolated temporary SQLite database (used purely to replicate the schema logic in a fast, dependency-free way) — they never touch the real production Postgres database.

---

## 📖 More Documentation

- **[OVERVIEW.md](./OVERVIEW.md)** — full architecture, data model, complete API reference.
- **[PROJECT_STATUS.md](./PROJECT_STATUS.md)** — completed tasks, validation results, pending items.

---

## 📄 License

Private project — no license specified.
