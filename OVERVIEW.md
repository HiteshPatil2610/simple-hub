# Raccoon Hub — Project Overview

> Project name: **Simple Hub** · In-app product name: **Raccoon Hub**

Raccoon Hub is a lightweight, high-performance affiliate storefront and outbound tracking platform built for Amazon Associates. It's designed for content creators, curators, and niche site owners who want to share hand-picked Amazon recommendations without the overhead of a full e-commerce CMS.

The design is a retro-modern neo-brutalist aesthetic — bold typography, playful accents, smooth animations via **Motion**, styled with **Tailwind CSS**.

---

## 1. Core Capabilities

### Public Storefront
- Responsive card grid of curated Amazon finds — image, title, description, category badge, and a "View on Amazon" button.
- Real-time search, category filtering, and a mobile bottom-dock navigation.
- Quick-preview modal for a product before committing to the outbound click.

### Direct Amazon Affiliate Link Engine
- Accepts any valid Amazon link: standard `amazon.com/dp/...` affiliate URLs or shortened `amzn.to/...` links.
- `amzn.to` links are passed through unmodified (Amazon's own shortener already encodes the affiliate tag).
- Standard URLs get the configured `affiliateTag` and UTM parameters appended automatically if not already present.

### Server-Side Redirect & Telemetry
- Outbound clicks route through `/api/redirect/:id` (or the short alias `/r/:id`).
- Each click records: timestamp, device type (Mobile/Desktop/Tablet, parsed from the User-Agent), referrer, UTM parameters, and an anonymous per-day visitor fingerprint (see [Analytics](#4-analytics)).
- After logging, the visitor is forwarded with a standard HTTP 302 redirect — no client-side delay.

### Owner Control Hub (`/#admin`)
Gated behind a passcode (see [Authentication](#3-authentication--security)). Once unlocked:
- **Manage Products** — add, edit, delete listings; upload product photos directly from device storage; switch between list and grid views; one-click "Test Link" and "Copy Link".
- **Records & Clicks** — real-time totals for clicks and unique visitors, a 14-day trend graph, a product performance leaderboard, a searchable click stream, and CSV export.

---

## 2. How It Works

```
[Store Owner]
      │
      ├─► Unlocks "Owner Hub" (/#admin) with OWNER_KEY passcode
      ├─► Adds/edits a product (title, description, category, price)
      ├─► Uploads an image from device storage (/api/upload)
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
            │
            ▼
    [Amazon product page, with affiliate tag + UTM params]
```

---

## 3. Authentication & Security

The Owner Control Hub and its underlying API routes are protected by a single shared passcode, set via the `OWNER_KEY` environment variable:

- **Client side:** navigating to `/#admin` shows a passcode prompt (`OwnerGate`) before any admin UI renders. The entered key is verified against the server and, once valid, stored in `localStorage` and attached as an `x-owner-key` header on subsequent admin requests.
- **Server side:** every mutating route — creating/editing/deleting products, image upload, resetting analytics, recording a conversion — is wrapped in a `requireOwnerAuth` middleware that checks the `x-owner-key` header against `OWNER_KEY`. Requests without a valid key get `401 Unauthorized`.
- **Missing configuration:** if `OWNER_KEY` is left unset, protected routes return `503 Service Unavailable` instead of opening the admin API. Always set it before starting the server (see [DEPLOYMENT.md](./DEPLOYMENT.md)).

Additional hardening in place:

| Protection | Where |
|---|---|
| Image upload type allowlist (JPG/PNG/GIF/WEBP only — no SVG, which can carry inline scripts) | `POST /api/upload` |
| Image upload size cap (8MB decoded) | `POST /api/upload` |
| Randomized upload filenames | `POST /api/upload` |
| Per-IP rate limiting | `/api/redirect/:id`, `/api/track/click`, `/api/upload` |
| Product update field allowlist (no blind merge of arbitrary request fields) | `PUT /api/products/:id` |
| Request body size capped at 12MB (down from an unbounded 50MB) | app-wide |

---

## 4. Analytics

Available under **Owner Hub → Records & Clicks**, and via `GET /api/analytics`:

- **Total clicks** and **unique visitors** — uniqueness is computed from an anonymous fingerprint (`sha256(ip + user-agent + date)`), not a real account/session system, so it resets daily and never stores raw IPs.
- **Conversion rate** — conversions ÷ clicks, from manually or programmatically recorded `ConversionEvent`s (there's no live Amazon order-status integration; this is a self-reported/simulated figure until a real affiliate-network webhook is wired in).
- **14-day click trend**, **top products by clicks**, **platform/category/device breakdowns**, and a **recent click stream** (last 50) with CSV export.

---

## 5. Data Model

Data persists as flat JSON files in `data/`, loaded into memory on boot and rewritten on every mutation:

| File | Contents |
|---|---|
| `data/products.json` | Product catalog |
| `data/clicks.json` | Every outbound click event |
| `data/conversions.json` | Recorded conversions |

| Type | Key fields |
|---|---|
| `Product` | `id`, `title`, `description`, `category`, `price`, `imageUrl`, `platform`, `affiliateUrl`, `affiliateTag`, `commissionRate`, `featured` |
| `ClickEvent` | `id`, `productId`, `timestamp`, `referrer`, `device`, `utmSource/Medium/Campaign`, `destinationUrl`, `visitorHash` |
| `ConversionEvent` | `id`, `clickId`, `productId`, `orderValue`, `commissionEarned`, `timestamp` |

> **Note:** flat-file storage with `fs.writeFileSync` is fine at small/personal scale, but concurrent writes aren't locked — under simultaneous requests, one write can be lost to another. Consider a real database (SQLite, Postgres) if traffic grows meaningfully.

---

## 6. API Reference

| Method | Route | Auth | Purpose |
|---|---|---|---|
| `GET` | `/api/health` | — | Health check |
| `GET` | `/api/products` | — | List products (`?category=`, `?search=`, `?platform=`, `?featured=`) |
| `GET` | `/api/products/:id` | — | Get one product |
| `POST` | `/api/products` | ✅ | Create a product |
| `PUT` | `/api/products/:id` | ✅ | Update a product |
| `DELETE` | `/api/products/:id` | ✅ | Delete a product |
| `POST` | `/api/upload` | ✅ | Upload a product image (base64 data URL) |
| `GET`/`GET` | `/api/redirect/:id`, `/r/:id` | — (rate-limited) | Log a click and 302-redirect to Amazon |
| `POST` | `/api/track/click` | — (rate-limited) | Client-side click beacon, returns the destination URL without redirecting |
| `POST` | `/api/analytics/conversion` | ✅ | Record a conversion |
| `GET` | `/api/analytics` | — | Full analytics summary |
| `POST` | `/api/analytics/reset` | ✅ | Wipe and reseed analytics data |
| `POST` | `/api/owner/verify` | ✅ | Verify an `x-owner-key` header (used by the login gate) |

✅ = requires a valid `x-owner-key` header matching `OWNER_KEY`.

---

## 7. Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite 6, Tailwind CSS 4, Motion (animations), Recharts (charts), Lucide (icons) |
| Backend | Express 4, TypeScript, `tsx` (dev) / `esbuild` (production bundle) |
| Storage | Flat JSON files on disk (`data/`, `public/uploads/`) |

---

## 8. Project Structure

```
├── server.ts                        # Express API, auth, redirect/telemetry logic
├── index.html                       # Vite entry HTML
├── metadata.json                    # Project metadata (name: "Simple Hub")
├── data/                            # Persisted JSON data (products, clicks, conversions)
├── public/uploads/                  # Uploaded product images
├── src/
│   ├── App.tsx                      # Top-level view routing (storefront vs owner hub)
│   ├── main.tsx                     # React entry point
│   ├── types.ts                     # Shared TypeScript types
│   ├── index.css                    # Tailwind entry
│   ├── services/api.ts              # Client-side API wrapper + owner-key handling
│   └── components/
│       ├── Navbar.tsx
│       ├── Footer.tsx
│       ├── ProductCard.tsx
│       ├── ProductDetailModal.tsx
│       ├── ProductAdminModal.tsx    # Add/edit product form, image upload
│       ├── OwnerProductManager.tsx  # Product list/grid management UI
│       ├── AnalyticsDashboard.tsx   # Records & Clicks tab
│       ├── OwnerGate.tsx            # Passcode login screen for /#admin
│       └── RedirectNotification.tsx # "Opening Amazon..." toast
├── .env.example                     # Environment variable template
├── README.md                        # Quick start
├── OVERVIEW.md                      # This file
└── DEPLOYMENT.md                    # Render deployment guide
```

---

## 9. Known Limitations

- **No real affiliate-network webhook.** `POST /api/analytics/conversion` exists as a stub for recording conversions but isn't wired to any live Amazon Associates reporting — revenue figures are only as accurate as what's manually or programmatically fed into it.
- **Seed catalog includes non-Amazon platforms** (TikTok Shop, AliExpress, Etsy) despite the product being scoped to Amazon Associates. Safe to delete these from the Owner Hub if you want the storefront to match the pitch exactly.
- **Single shared owner passcode**, not per-user accounts — fine for a solo operator, not suitable if multiple people need distinct admin permissions.
- **Flat-file storage** has no write-locking — see the note in [Data Model](#5-data-model).
- **`@google/genai` dependency** is present in `package.json` from the project's original scaffolding but isn't used anywhere in the current code — safe to remove if you want a leaner install, or safe to leave if you plan to add AI features later.
