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

- **Curated storefront** — a responsive card grid with real-time search and category filters. Products are entered by the owner and displayed with image, title, description, category, and a "View on Amazon" button.
- **Amazon-only affiliate links** — paste any `amazon.com/dp/...` link or `amzn.to/...` short link; affiliate tags and UTM parameters are applied automatically. Only Amazon platform is supported.
- **Server-side redirect & telemetry** — every outbound click routes through a tracking endpoint that logs timestamp, device type, referrer, and UTM data *before* forwarding the visitor, with no client-side delay.
- **Owner Control Hub** — a username + password–gated admin panel to add/edit/delete products, upload images straight from your device, and review analytics.
- **Live analytics** — total clicks, real (hashed, anonymous) unique visitors, a 14-day trend graph, a product leaderboard, a searchable click stream, and CSV export. New deployments start empty and populate only from real activity.
- **Multi-user JWT auth** — secure username + password login; passwords hashed with `crypto.scrypt`; sessions stored as short-lived JWTs (default 8 h).
- **Conversion webhooks** — `POST /api/webhooks/conversion` accepts HMAC-signed payloads from affiliate networks (Impact, CJ, ShareASale).
- **Automatic data retention** — click records older than `CLICK_RETENTION_DAYS` (default 90 days) are purged on startup and daily.
- **Secured by default** — every mutating admin route requires a valid JWT, uploads are type/size/magic-bytes validated, and click endpoints are rate-limited.
- **Automated tests** — `npm test` runs 16 tests using Node's built-in `node:test` runner (no extra test dependency).

---

## 🖥️ How It Works

```
[Store Owner]
      │
      ├─► Logs in to Owner Hub (/#admin) with username + password → receives JWT
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
| Database | SQLite via Node's built-in `node:sqlite` — single file, no external DB server |
| Testing  | Node's built-in `node:test` — 16 tests, zero extra test dependencies |

---

## 📂 Project Structure

```
├── server.ts                        # Express API — JWT auth, redirects, webhooks, retention
├── db.ts                            # SQLite schema + data-access layer + user management
├── index.html                       # Vite entry HTML
├── data/                            # Persisted SQLite DB (products, clicks, conversions, users)
├── public/uploads/                  # Uploaded product images
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
│       ├── OwnerGate.tsx            # Username + password login form (JWT)
│       └── RedirectNotification.tsx
├── .env.example                     # Environment variable template
├── README.md                        # You are here
├── OVERVIEW.md                      # Full architecture & API reference
└── DEPLOYMENT.md                    # Render deployment guide
```

---

## 🚀 Getting Started

**Prerequisites:** Node.js 22.5+

```bash
# 1. Clone and install
git clone <your-repo-url>
cd raccoon-hub
npm install

# 2. Set up environment variables
cp .env.example .env
```

Generate a JWT secret and set your initial admin credentials in `.env`:

```bash
# Generate JWT_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Edit `.env`:
```env
JWT_SECRET=<paste generated secret>
OWNER_USER=admin
OWNER_PASS=<your strong password>
```

```bash
# 3. Run it
npm run dev
```

Open `http://localhost:3000`. Visit `http://localhost:3000/#admin` and sign in with your `OWNER_USER` / `OWNER_PASS` to reach the Owner Control Hub.

> ℹ️ On first boot the server creates an initial admin account from `OWNER_USER` / `OWNER_PASS` and prints a confirmation to the console. You can remove those env vars after the first login.

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

- **Multi-user JWT auth** — the Owner Control Hub and every mutating API route require a valid `Authorization: Bearer <token>` header. Login via `POST /api/auth/login`.
- **Passwords** — hashed with `crypto.scrypt` (64-byte key, random salt per user). Never stored in plaintext.
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
| `OWNER_USER` / `OWNER_PASS` set for first-boot bootstrap | Required (removable after first login) |
| `DATA_DIR` / `UPLOADS_DIR` pointing to persistent volume | Required for data survival across redeploys |
| HTTPS in front of the server | Required — JWTs must not travel over plain HTTP |
| Node.js ≥ 22.5 on the host | Required — for built-in `node:sqlite` |
| Debug code / test routes | PASS — none present |
| Error handling | PASS — generic messages + correlation ID; details server-side only |
| Security headers | PASS — Helmet, CSP, HSTS, X-Frame-Options |
| Rate limiting | PASS — login (5/min), redirects (60/min), uploads (20/min), beacons (120/min), webhooks (30/min) |
| CORS | PASS — no CORS middleware; same-origin only |

### Secret rotation

- Rotate `JWT_SECRET` to invalidate all active sessions (all users will need to re-login).
- The previous `OWNER_KEY` single-passcode system has been replaced. If the old key was committed in git history, it is now irrelevant — no API route checks it (except the legacy `/api/owner/verify` endpoint for transitional compatibility).

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

Tests run against isolated temporary SQLite databases — they never touch `data/raccoon-hub.sqlite`.

---

## 📖 More Documentation

- **[OVERVIEW.md](./OVERVIEW.md)** — full architecture, data model, complete API reference.
- **[PROJECT_STATUS.md](./PROJECT_STATUS.md)** — completed tasks, validation results, pending items.

---

## 📄 License

Private project — no license specified.
