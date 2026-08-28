# 🦝 Raccoon Hub

**A lightweight, high-performance affiliate storefront and outbound click-tracking platform, purpose-built for Amazon Associates.**

Raccoon Hub lets content creators, curators, and niche site owners share hand-picked Amazon finds through a fast, distraction-free storefront — with a full owner dashboard for managing products and tracking outbound clicks, without the overhead of a traditional e-commerce CMS.

![Node](https://img.shields.io/badge/node-%3E%3D18-brightgreen)
![TypeScript](https://img.shields.io/badge/typescript-5.8-blue)
![React](https://img.shields.io/badge/react-19-61DAFB)
![License](https://img.shields.io/badge/license-private-lightgrey)

---

## ✨ Features

- **Curated storefront** — a responsive card grid with real-time search, category filters, and a mobile bottom-dock nav. Every card shows exactly what matters: image, title, description, category, and a "View on Amazon" button.
- **Direct Amazon affiliate links** — paste any `amazon.com/dp/...` link or `amzn.to/...` short link; affiliate tags and UTM parameters are applied automatically.
- **Server-side redirect & telemetry** — every outbound click routes through a tracking endpoint that logs timestamp, device type, referrer, and UTM data *before* forwarding the visitor, with no client-side delay.
- **Owner Control Hub** — a passcode-gated admin panel to add/edit/delete products, upload images straight from your device, and review analytics.
- **Real analytics** — total clicks, real (hashed, anonymous) unique visitors, a 14-day trend graph, a product leaderboard, a searchable click stream, and CSV export.
- **Secured by default** — every mutating admin route requires a passcode, uploads are type/size validated, and click endpoints are rate-limited.

---

## 🖥️ How It Works

```
[Store Owner]
      │
      ├─► Unlocks the Owner Hub (/#admin) with a passcode
      ├─► Adds/edits a product — title, description, category, price
      ├─► Uploads a product photo directly from device storage
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
            ├─► Logs telemetry: timestamp, device, referrer, unique-visitor hash
            ├─► Updates click / conversion counters
            │
            ▼
    [Amazon product page — affiliate tag + UTM params attached]
```

1. **Add a product** — the owner opens the Owner Hub, uploads an image (or pastes a URL), and enters the title, category, description, and Amazon link. It goes live on the storefront immediately.
2. **Visitor browses** — search by keyword, filter by category, and preview a product in a quick-view modal.
3. **Click tracking** — clicking "View on Amazon" hits the redirect endpoint, which logs the click and forwards the visitor to Amazon with a 302 redirect.
4. **Review performance** — the owner checks click counts, conversion rate, top products, and device/platform breakdowns from the Records & Clicks tab, with CSV export for deeper analysis.

---

## 🧱 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 · Vite 6 · Tailwind CSS 4 · Motion (animations) · Recharts · Lucide icons |
| Backend | Express 4 · TypeScript · `tsx` (dev) / `esbuild` (production bundle) |
| Storage | Flat JSON files on disk — no database required |

---

## 📂 Project Structure

```
├── server.ts                        # Express API — auth, redirects, telemetry
├── index.html                       # Vite entry HTML
├── data/                            # Persisted product & analytics data (JSON)
├── public/uploads/                  # Uploaded product images
├── src/
│   ├── App.tsx                      # Top-level view routing (storefront vs owner hub)
│   ├── types.ts                     # Shared TypeScript types
│   ├── services/api.ts              # Client-side API wrapper
│   └── components/
│       ├── Navbar.tsx / Footer.tsx
│       ├── ProductCard.tsx / ProductDetailModal.tsx
│       ├── ProductAdminModal.tsx    # Add/edit product form + image upload
│       ├── OwnerProductManager.tsx  # Product management UI
│       ├── AnalyticsDashboard.tsx   # Records & Clicks tab
│       ├── OwnerGate.tsx            # Passcode login for /#admin
│       └── RedirectNotification.tsx
├── .env.example
├── README.md                        # You are here
├── OVERVIEW.md                      # Full architecture & API reference
└── DEPLOYMENT.md                    # Render deployment guide
```

---

## 🚀 Getting Started

**Prerequisites:** Node.js 18+

```bash
# 1. Clone and install
git clone <your-repo-url>
cd raccoon-hub
npm install

# 2. Set up environment variables
cp .env.example .env
```

Generate a passcode for the Owner Hub and set it as `OWNER_KEY` in `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

```bash
# 3. Run it
npm run dev
```

Open `http://localhost:3000`. Visit `http://localhost:3000/#admin` and enter your `OWNER_KEY` to reach the Owner Control Hub.

### Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Run locally with Vite + Express in dev mode |
| `npm run build` | Build the frontend (Vite) and bundle the server (esbuild) |
| `npm start` | Run the production build (requires `npm run build` first) |
| `npm run lint` | Type-check with `tsc --noEmit` |

---

## 🔐 Security

- The Owner Control Hub and every mutating API route (`create/edit/delete product`, `upload`, `reset analytics`) require a valid `x-owner-key` header matching `OWNER_KEY`.
- Image uploads are restricted to JPG/PNG/GIF/WEBP (no SVG, to avoid script-carrying files), capped at 8MB, with randomized filenames.
- Redirect and click-tracking endpoints are rate-limited per IP.
- Full details in [OVERVIEW.md](./OVERVIEW.md#3-authentication--security).

> ⚠️ `OWNER_KEY` must be set before deploying anywhere public — without it, the admin API is unauthenticated.

---

## 📖 More Documentation

- **[OVERVIEW.md](./OVERVIEW.md)** — full architecture, data model, complete API reference, and known limitations.
- **[DEPLOYMENT.md](./DEPLOYMENT.md)** — step-by-step guide to deploying on Render, including persistent disk setup for product/click data.

---

## 📄 License

Private project — no license specified.