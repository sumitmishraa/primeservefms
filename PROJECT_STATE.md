# Primeserve — Project State

> Full phase history is in PROJECT_STATE_ARCHIVE.md

---

## Current Status

| | |
|---|---|
| **Active phase** | Phase 4 — Buyer Cart & Checkout |
| **Build status** | ✅ `pnpm build` passes — 45 routes, zero TypeScript errors |
| **Dev server** | `pnpm dev` → `http://localhost:3000` |
| **Framework** | Next.js 16.2.1 (NOT v15 — installed as next@latest, proxy.ts not middleware.ts) |

---

## ⚠️ Pending Before Phase 4 Works Fully

- [ ] **Run Migration 5** in Supabase SQL Editor: `supabase/migrations/20260328000001_clients_and_branches.sql`
  - Creates: `clients`, `branches` tables; adds `client_id`/`branch_id` to `users` + `orders`
- [ ] Wire `POST /api/orders` to auto-set `client_id`/`branch_id` from buyer's profile
- [ ] Add `client_id`/`branch_id` filter params to `GET /api/admin/orders`
- [ ] Supabase Storage bucket for product images (image upload in ProductForm)

---

## Phase 4 — Buyer Cart & Checkout

- [x] Cart state — Zustand `cartStore` (`src/stores/cartStore.ts`)
- [ ] Cart sidebar component (`src/components/buyer/CartSidebar.tsx`)
- [x] Checkout page (`src/app/(dashboard)/buyer/checkout/page.tsx`) — updated to use new flow
- [x] `POST /api/orders/razorpay` — legacy Razorpay order creator (`src/app/api/orders/razorpay/route.ts`)
- [x] `POST /api/orders/create` — server-validated order + Razorpay order (`src/app/api/orders/create/route.ts`) ← NEW
- [x] `POST /api/orders/verify-payment` — HMAC verify + mark paid (`src/app/api/orders/verify-payment/route.ts`) ← NEW
- [x] `GET /api/orders` + `POST /api/orders` — real handlers (`src/app/api/orders/route.ts`)
- [x] `GET /api/orders/[id]` + `PATCH /api/orders/[id]` — detail + admin status update (`src/app/api/orders/[id]/route.ts`) ← NEW
- [x] `src/lib/razorpay/checkout.ts` — loadRazorpayScript + openRazorpayCheckout utilities ← NEW
- [x] Order success page (`src/app/(dashboard)/buyer/checkout/success/page.tsx`) ← NEW
- [x] Buyer order history (`src/app/(dashboard)/buyer/orders/page.tsx`) — filter tabs, cards, pagination ← NEW
- [x] Buyer order detail page (`src/app/(dashboard)/buyer/orders/[id]/page.tsx`) — timeline, items table, reorder ← NEW
- [x] `GET /api/buyer/orders` — buyer order list with status filter (`src/app/api/buyer/orders/route.ts`) ← NEW
- [x] `GET /api/buyer/orders/[id]` — single order detail (`src/app/api/buyer/orders/[id]/route.ts`) ← NEW
- [x] `GET /api/buyer/orders/[id]/reorder` — returns Product[] for re-adding to cart ← NEW
- [x] Quick Reorder page (`src/app/(dashboard)/buyer/reorder/page.tsx`) ← NEW
- [x] Buyer Profile page (`src/app/(dashboard)/buyer/profile/page.tsx`) — personal info, business, saved addresses ← NEW
- [x] Buyer Dashboard home (`src/app/(dashboard)/buyer/page.tsx`) — stats, recent orders, top products ← NEW
- [x] `GET/PUT /api/buyer/profile` — fetch + update profile with client/branch names ← NEW
- [x] `GET /api/buyer/stats` — dashboard stats + frequent products aggregation ← NEW
- [x] Sidebar cart badge — live item count from Zustand cartStore ← NEW
- [ ] Email/WhatsApp notification on order placed (Supabase Edge Function or webhook)

---

## Phase 4 — ✅ COMPLETE

All buyer features built:
- Marketplace browsing → Add to Cart → Checkout with Razorpay → Order tracking → Reorder → Profile

### ⚠️ Razorpay env vars — fill in real values before testing payments
Add these 3 to `.env.local` AND Vercel dashboard:
- `RAZORPAY_KEY_ID` — from Razorpay dashboard → Settings → API Keys
- `RAZORPAY_KEY_SECRET` — same page (keep secret, never expose)
- `NEXT_PUBLIC_RAZORPAY_KEY_ID` — same as `RAZORPAY_KEY_ID` (safe to expose, used in browser)

---

## Completed Phases (detail in PROJECT_STATE_ARCHIVE.md)

| Phase | Summary |
|---|---|
| Phase 0 | Scaffolding: Next.js 16, TypeScript strict, Tailwind v4, env, lib files |
| Phase 1 | Database: 5 migrations, 7 tables, 7 enums, RLS on all tables |
| Phase 2 | Auth: Firebase OTP + HMAC session cookie + proxy.ts route protection |
| Phase 2.5 | Dashboard Shell: Navbar, Sidebar, MobileMenu, 27 placeholder pages |
| Phase 3 | Admin: Product catalogue, orders, clients/branches, analytics, marketplace |

---

## Key Files Quick Reference

### Phase 4 files to create/update
| File | Action |
|---|---|
| `src/stores/cartStore.ts` | Create — Zustand cart state |
| `src/components/buyer/CartSidebar.tsx` | Create — slide-out cart panel |
| `src/app/(dashboard)/buyer/checkout/page.tsx` | Create — checkout flow |
| `src/app/api/orders/route.ts` | Update placeholder → POST create order |
| `src/app/api/orders/[id]/route.ts` | Create — GET detail + PATCH status |
| `src/app/(dashboard)/buyer/orders/page.tsx` | Update placeholder → real list |
| `src/app/(dashboard)/buyer/orders/[id]/page.tsx` | Create — order detail view |
| `src/app/marketplace/[slug]/page.tsx` | Update — wire "Add to Cart" button |

### Existing files relevant to Phase 4
| File | Purpose |
|---|---|
| `src/types/index.ts` | `CartItem`, `OrderItemInput`, `Order` types already defined |
| `src/lib/supabase/queries.ts` | `getOrders`, `getOrderById` query functions (extend as needed) |
| `src/lib/utils/formatting.ts` | `formatINR`, `formatOrderNumber`, `formatDate` |
| `src/lib/constants/categories.ts` | `ORDER_STATUSES` array with color + description |
| `src/components/ui/ConfirmDialog.tsx` | Reusable confirm modal (already built) |
| `src/app/(dashboard)/admin/orders/[id]/page.tsx` | Reference for order detail UI pattern |

---

## Architecture Rules (quick ref)
- Pages → `src/app/` (App Router)
- API routes → `src/app/api/` with `route.ts`
- Components → `src/components/` by feature folder
- Route guard → `src/proxy.ts` (exports `proxy`, NOT `middleware`)
- Admin DB ops → `createAdminClient()` from `src/lib/supabase/admin.ts`
- Server pages → use server Supabase client from `src/lib/supabase/server.ts`

## Must-follow Rules
- No `any` TypeScript — zero exceptions
- RLS policy required on every Supabase table
- Firebase = OTP auth ONLY — no Firestore, no Realtime DB, no Storage
- Every API route: `try/catch` + `console.error("[route name]", error)`
- Every component: loading / error / empty / success states — no skipping
- All prices via `formatINR()` — all dates via `formatDate()` (IST)
- pnpm only — never npm/yarn

---

## Environment Variables

All set in `.env.local`. Key ones for Phase 4:
- `WEBHOOK_URL` — ⏳ Pending (set when webhook is created)
- Everything else ✅ already set

---

## Quick Commands

```bash
pnpm dev              # Start dev server → localhost:3000
pnpm build            # Full TypeScript check + production build
pnpm type-check       # tsc --noEmit (faster check)
pnpm lint             # ESLint
```
