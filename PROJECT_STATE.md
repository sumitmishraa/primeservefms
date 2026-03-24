# Primeserve — Project State

> **Update this file after completing each phase or major feature.**
> Claude Code reads this at the start of every session to understand what exists.

---

## Current Status

| | |
|---|---|
| **Active phase** | Phase 3 — Admin-Centric Product Catalogue |
| **Last completed** | Admin product catalog — Excel import, CRUD API, catalog manager, product form (2026-03-24) |
| **Business model** | PrimeServe admin controls all order fulfilment. No vendor dashboard. Vendors managed offline via WhatsApp/call. |
| **Build status** | ✅ `pnpm build` passes — 47 routes, zero TypeScript errors |
| **Dev server** | `pnpm dev` → `http://localhost:3000` |

---

## Phase Checklist

### ✅ Phase 0 — Project Scaffolding (COMPLETE)
- [x] Next.js 16 project created with pnpm, TypeScript strict, Tailwind v4, App Router, ESLint
- [x] All additional packages installed (see package.json)
- [x] `src/` directory structure created with placeholder files
- [x] `.env.local` created and credentials filled in
- [x] `.env.example` created for Git reference
- [x] `.gitignore` protects `.env.local`
- [x] Supabase clients written (browser, server, admin)
- [x] Firebase clients written (config + admin SDK, Auth ONLY)
- [x] Housekeeping categories constants (7 categories with meta)
- [x] Formatting utilities (formatINR, formatDate IST, formatOrderNumber, truncateText)
- [x] Zod validation schemas (phone, email, OTP)
- [x] TypeScript interfaces (User, Product, Order, Message, VendorApplication, etc.)
- [x] `proxy.ts` route protection placeholder (Next.js 16)
- [x] `.claude/CLAUDE.md` master instructions written

---

### ✅ Phase 1 — Database Schema (COMPLETE)

Goal: Define all Supabase tables, relationships, and RLS policies.

Migration files live in `supabase/migrations/`.
Schema docs live in `docs/database/`.

**Summary: 7 tables, 7 enums, 44 subcategories seeded, 3 migration files, 11 query functions.**

#### Migration 1 — Core Enums & Users (COMPLETE)
File: `supabase/migrations/20260322000001_core_enums_and_users.sql`
Doc:  `docs/database/01_users_and_categories_schema.md`

- [x] `product_category` ENUM — 6 categories from real product catalog (394 products)
- [x] `subcategories` table — 44 rows seeded (housekeeping×21, chemicals×3, pantry×1, stationery×17, facility×2)
- [x] `user_role`, `order_status`, `payment_status`, `stock_status`, `vendor_application_status`, `unit_of_measure` ENUMs
- [x] `update_updated_at_column()` trigger function (reusable across all tables)
- [x] `users` table with full column set, indexes, COMMENT ON TABLE/COLUMN, updated_at trigger
- [x] `vendor_applications` table with product_categories array, indexes, comments, updated_at trigger
- [x] RLS enabled on `users`, `vendor_applications`, `subcategories`
- [x] RLS policies: users (view own, update own, admin view all, admin update all, service role insert)
- [x] RLS policies: vendor_applications (view own, create own, admin view all, admin update all)
- [x] RLS policies: subcategories (public read, admin full write)
- [x] `src/lib/constants/categories.ts` updated — 6 categories, 44 subcategories, helper function

#### Migration 2 — Products Table (COMPLETE)
File: `supabase/migrations/20260322000002_products_table.sql`
Doc:  `docs/database/02_products_schema.md`

- [x] `products` table — 28 columns covering all fields from Housekeeping + Stationery Excel sheets
- [x] `brand` + `size_variant` split from Excel "size/brand" column
- [x] `subcategory_id` (FK) + `subcategory_slug` (denormalized) dual columns
- [x] `pricing_tiers` JSONB for B2B volume discounts
- [x] `hsn_code` + `gst_rate` (constrained to 0/5/12/18/28%) for Indian tax compliance
- [x] `generate_product_slug()` function — auto-slug from name, collision-safe with 4-char suffix
- [x] `set_product_slug` BEFORE INSERT trigger
- [x] `set_products_updated_at` BEFORE UPDATE trigger
- [x] 10 indexes (slug, vendor_id, category, subcategory_slug, category+subcategory composite, is_approved, is_active, stock_status, brand, created_at DESC)
- [x] RLS enabled on `products`
- [x] RLS policies: public view approved+active, vendor view own, vendor insert, vendor update own, admin full access
- [x] COMMENT ON TABLE and all key columns

#### Migration 3 — Orders, Order Items & Messages (COMPLETE)
File: `supabase/migrations/20260322000003_orders_and_messages.sql`
Doc:  `docs/database/03_orders_messages_schema.md`

- [x] `generate_order_number()` function — PS-ORD-XXXXXX, 6-char random uppercase alphanumeric, collision-safe loop
- [x] `set_order_number` BEFORE INSERT trigger on orders
- [x] `orders` table — 17 columns: order_number, buyer_id, vendor_id, status, payment_status, subtotal, gst_amount, shipping_amount, total_amount, shipping_address (JSONB), billing_address (JSONB), notes, cancelled_reason, delivered_at, timestamps
- [x] ON DELETE RESTRICT on buyer_id and vendor_id — financial records never lost
- [x] `set_orders_updated_at` BEFORE UPDATE trigger
- [x] `order_items` table — 11 columns with product_name and product_sku snapshot columns
- [x] `messages` table — 8 columns with nullable order_id (ON DELETE SET NULL)
- [x] 6 indexes on orders (buyer_id, vendor_id, status, order_number, created_at DESC, payment_status)
- [x] 2 indexes on order_items (order_id, product_id)
- [x] 5 indexes on messages (sender_id, receiver_id, order_id, created_at DESC, partial unread)
- [x] RLS enabled on orders, order_items, messages
- [x] RLS policies: orders (buyer view own, vendor view assigned, buyer insert, vendor update status, admin full access)
- [x] RLS policies: order_items (users view items of their orders, admin full access)
- [x] RLS policies: messages (users view sent/received, users send, receiver mark read, admin view all)
- [x] COMMENT ON TABLE and all key columns for all three tables

#### TypeScript Types & Query Library (COMPLETE)

- [x] `src/types/database.ts` — full `Database` type: 7 tables (Row/Insert/Update), 7 enums, typed JSONB columns (AddressJson, PricingTierJson, BusinessDocumentJson)
- [x] `src/types/index.ts` — clean named interfaces: UserProfile, Product, Subcategory, Order, OrderItem, Message, VendorApplication, PricingTier, ShippingAddress, CartItem, OrderItemInput, ProductFilters, ApiResponse, PaginatedResponse, *DashboardStats, MessageThread
- [x] `src/lib/constants/categories.ts` — 6 categories with productCount + icon (Sparkles, FlaskConical, PenTool, Coffee, Wrench, Printer) + 3 helper functions (getSubcategoriesByCategory, getCategoryLabel, getSubcategoryLabel)
- [x] `src/lib/supabase/queries.ts` — 11 query functions: getUserById, getUserByFirebaseUid, getProducts, getVendorProducts, getProductBySlug, getSubcategories, getOrders, getOrderById, getMessages, getVendorApplications, getDashboardStats
- [x] Supabase clients (client.ts, server.ts, admin.ts) already typed with `Database` generic

#### Migration 4 — Admin Order Flow & Vendor Directory (COMPLETE)
File: `supabase/migrations/20260324000001_update_order_status_and_vendor_directory.sql`

**Business model change:** PrimeServe admin manages all fulfilment. No vendor login/dashboard.

- [x] `order_status` enum extended: `approved`, `forwarded_to_vendor`, `dispatched` added. Old values (confirmed, processing, shipped) remain in DB but unused.
- [x] New order flow: `pending → approved → forwarded_to_vendor → dispatched → delivered` (cancelled at any stage)
- [x] `orders` table — 5 new columns: `assigned_vendor_name`, `assigned_vendor_phone`, `admin_notes`, `forwarded_at`, `dispatched_at`
- [x] `vendor_directory` table — internal admin contact book (NOT a login table). Admin-only RLS.
- [x] `products.vendor_id` — made nullable (admin uploads products now)
- [x] `products.uploaded_by` — new FK to `users.id` (records which admin uploaded the product)
- [x] `src/types/database.ts` — updated: vendor_directory table type, order_status enum, new order columns, nullable vendor_id, uploaded_by
- [x] `src/types/index.ts` — added `VendorContact` type alias; updated `Order` jsdoc
- [x] `src/lib/constants/categories.ts` — added `OrderStatusMeta` interface and `ORDER_STATUSES` array (6 active statuses with color + description)

#### Remaining Phase 1 tasks
- [ ] Seed script with 3 test buyers, 10 test products (optional — can be done alongside Phase 3)

---

### ✅ Phase 2 — Authentication + Dashboard Shell (COMPLETE)

Goal: Users can log in via Phone OTP or Email OTP, and reach their role-based dashboard.

- [x] `src/lib/auth/session.ts` — `createSession`, `getSession`, `destroySession` using HMAC-SHA256 (`ps-session` cookie, 7 days)
- [x] `src/lib/auth/verify.ts` — `verifyAuth(request)` — the single function all protected routes call first
- [x] `POST /api/auth/register` — Zod validation, terms_accepted check, Firebase token verify, duplicate email+phone check, always role='buyer'
- [x] `POST /api/auth/login` — Email+password and Phone OTP; returns error codes `USER_NOT_FOUND` (404), `ACCOUNT_DEACTIVATED` (403)
- [x] `POST /api/auth/logout` — calls `destroySession()`, clears `ps-session` cookie
- [x] `GET /api/auth/me` — calls `verifyAuth()`, returns full profile excluding `firebase_uid`
- [x] `src/proxy.ts` — full route protection: `/admin/*`, `/vendor/*`, `/buyer/*`; role mismatch redirects; logged-in users redirected away from `/login` + `/register`; passes `x-user-id` / `x-user-role` headers
- [x] `src/types/database.ts` — fixed `Relationships: never[]` on all 7 tables + `Views`/`Functions` as `{ [_ in never]: never }` (required by `@supabase/supabase-js` v2.99.x `GenericSchema`)
- [x] `src/lib/supabase/queries.ts` — fixed pre-existing type errors (join casts, enum param types)
- [x] Login page (`/login`) — Email+password tab + Phone OTP tab; role-based redirect with `?redirect=` support
- [x] Register page (`/register`) — Single-page form: name, email, phone (inline verify), password (strength bar), terms
- [x] `src/app/(auth)/layout.tsx` — Split-screen: teal branding left (desktop), white form right; mobile compact branding
- [x] `src/components/auth/OTPInput.tsx` — 6-box OTP input; auto-advance, backspace, paste, error shake, loading pulse
- [x] `src/components/auth/PasswordStrengthBar.tsx` — 4-level strength bar (too weak/weak/medium/strong)
- [x] `src/components/auth/PhoneVerification.tsx` — Inline phone OTP via PhoneAuthProvider.verifyPhoneNumber; resend timer; verified badge
- [x] `src/hooks/useAuth.ts` — loginWithEmail, loginWithPhone, verifyPhoneOTP, register (email+phone link), logout, redirectAfterLogin
- [x] `src/stores/authStore.ts` — Zustand: user (UserProfile), isLoading, isAuthenticated, setUser, clearUser
- [x] `src/app/layout.tsx` — Plus Jakarta Sans (heading), DM Sans (body), JetBrains Mono, react-hot-toast Toaster

#### Dashboard Shell (Phase 2.5 — COMPLETE)
- [x] `src/app/(dashboard)/layout.tsx` — auth skeleton, redirect guard, Navbar + Sidebar + MobileMenu
- [x] `src/components/layout/Navbar.tsx` — fixed top bar with search, cart badge (buyer), bell, user avatar dropdown
- [x] `src/components/layout/Sidebar.tsx` — role-based nav (buyer 6 items / vendor 6 items / admin 6 items), active state, footer
- [x] `src/components/layout/MobileMenu.tsx` — slide-out overlay, body scroll lock, reuses Sidebar
- [x] `src/components/layout/UserMenu.tsx` — click-outside aware dropdown with profile, settings, logout
- [x] `src/components/ui/PlaceholderPage.tsx` — shared "coming soon" screen (icon + title + message + Go Back)
- [x] 27 placeholder pages across buyer, vendor, admin routes (zero 404s)

#### Pre-requisites to test (Firebase Console):
1. Enable **Email/Password** sign-in method (Authentication → Sign-in method)
2. Enable **Phone** sign-in method (Authentication → Sign-in method)
3. Add **authorized domain**: `localhost` (Authentication → Settings → Authorized domains)
4. For dev: add test phone numbers (Authentication → Sign-in method → Phone → Test phone numbers)
5. Ensure `SESSION_SECRET` is set in `.env.local` (any long random string)
6. Ensure `NEXT_PUBLIC_APP_URL=http://localhost:3000` is set in `.env.local`

---

### 🔲 Phase 3 — Admin-Centric Product Catalogue

Goal: Admin uploads all products; buyers can browse and place orders.

#### Admin Dashboard (COMPLETE)
- [x] `src/components/layout/Sidebar.tsx` — updated: admin nav (8 items), buyer nav (5 items), vendor nav removed
  - Longest-prefix active-path algorithm replaces old isItemActive (handles /admin/products vs /admin/products/import correctly)
- [x] `GET /api/admin/stats` — returns stats, pending orders (max 5), recent orders (last 10)
- [x] `src/app/(dashboard)/admin/page.tsx` — full dashboard: welcome banner, 6 stat cards, pending orders table, activity feed
- [x] `src/app/(dashboard)/admin/products/page.tsx` — placeholder
- [x] `src/app/(dashboard)/admin/products/import/page.tsx` — placeholder
- [x] `src/app/(dashboard)/admin/orders/page.tsx` — placeholder
- [x] `src/app/(dashboard)/admin/buyers/page.tsx` — placeholder (new route)
- [x] `src/app/(dashboard)/admin/vendors/page.tsx` — placeholder (updated: Vendor Directory)
- [x] `src/app/(dashboard)/admin/analytics/page.tsx` — placeholder (new route)
- [x] `src/app/(dashboard)/admin/settings/page.tsx` — placeholder

#### Admin Product Catalog (COMPLETE — 2026-03-24)
- [x] `POST /api/admin/products/import` — Excel bulk import (xlsx, 2-sheet, section-header skip, unit/category/subcategory mapping, batch insert, duplicate skip by slug)
- [x] `GET /api/admin/products` — paginated list (25/page), filters: category, subcategory, search, stock status
- [x] `POST /api/admin/products` — create single product (admin-only, auto-slug, uploaded_by)
- [x] `PUT /api/admin/products/[id]` — update any product field
- [x] `DELETE /api/admin/products/[id]` — soft-delete (is_active = false)
- [x] `src/app/(dashboard)/admin/products/import/page.tsx` — drag-and-drop Excel upload, progress, summary card, row error table
- [x] `src/app/(dashboard)/admin/products/page.tsx` — full catalog manager: search, category/subcategory/stock filters, inline price editing (click-to-edit, red ₹0), stock toggle, bulk select/delete, pagination, amber row highlight for unpriced items
- [x] `src/app/(dashboard)/admin/products/[id]/edit/page.tsx` — pre-filled edit form with all fields
- [x] `src/app/(dashboard)/admin/products/new/page.tsx` — empty form to manually add a product
- [x] `src/components/admin/ProductForm.tsx` — shared form component (all fields + bulk pricing tiers + tags + image placeholder)
- [x] `xlsx` 0.18.5 installed; `next.config.ts` updated with `serverExternalPackages: ['xlsx']`

#### Remaining Phase 3 tasks
- [ ] Supabase Storage bucket for product images (image upload in ProductForm)
- [ ] Admin order detail page — review order, approve, forward to vendor, mark dispatched
- [ ] `PATCH /api/orders/:id/status` — update order status with vendor assignment
- [ ] Public marketplace page (`/marketplace`) with category filter and search
- [ ] Product detail page with pricing tier table

---

### 🔲 Phase 4 — Orders & Checkout

Goal: Buyers can place orders; vendors can fulfil them.

- [ ] Cart state (Zustand `cartStore`)
- [ ] Cart sidebar component
- [ ] Checkout page (delivery address, order summary, GST calculation)
- [ ] `POST /api/orders` — create order, generate order number
- [ ] Buyer order history page
- [ ] Vendor order queue page
- [ ] `PATCH /api/orders/:id/status` — update order status
- [ ] Order detail page (for both buyer and vendor)
- [ ] Email notification on order placed (via webhook or Supabase Edge Function)

---

### 🔲 Phase 5 — Messaging & Admin Dashboard

Goal: Buyers and vendors can message each other; admin has full visibility.

- [ ] `GET /api/messages` and `POST /api/messages`
- [ ] Messaging UI (conversation list + message thread)
- [ ] Unread message badge
- [ ] Admin dashboard: user list, vendor application queue, order overview
- [ ] Admin user management (verify vendors, manage roles)
- [ ] Basic analytics (total orders, GMV, top vendors)

---

## File Registry

### Configuration
| File | Purpose |
|---|---|
| `.env.local` | Live credentials — never committed |
| `.env.example` | Template for new contributors |
| `.gitignore` | Protects `.env*` and build artifacts |
| `tsconfig.json` | TypeScript strict config, `@/` alias |
| `eslint.config.mjs` | ESLint rules |
| `.claude/CLAUDE.md` | Master Claude Code instructions |

### Dashboard Shell (Phase 2.5)
| File | Purpose |
|---|---|
| `src/app/(dashboard)/layout.tsx` | Authenticated wrapper — auth skeleton, redirect guard, Navbar + Sidebar + MobileMenu |
| `src/components/layout/Navbar.tsx` | Fixed top bar — hamburger, logo, search, cart (buyer), bell, user avatar dropdown |
| `src/components/layout/Sidebar.tsx` | Left nav panel — user info, role-based nav links (buyer/vendor/admin), active state, footer |
| `src/components/layout/MobileMenu.tsx` | Slide-out overlay panel for mobile — wraps Sidebar, body-scroll lock |
| `src/components/layout/UserMenu.tsx` | Avatar dropdown — profile/settings links, logout |
| `src/components/ui/PlaceholderPage.tsx` | Reusable "coming soon" screen used by all 20 stub pages |
| `src/app/(dashboard)/buyer/marketplace/page.tsx` | Placeholder — Coming in Phase 4 |
| `src/app/(dashboard)/buyer/orders/page.tsx` | Placeholder — Coming in Phase 4 |
| `src/app/(dashboard)/buyer/reorder/page.tsx` | Placeholder — Coming in Phase 4 |
| `src/app/(dashboard)/buyer/cart/page.tsx` | Placeholder — Coming in Phase 4 |
| `src/app/(dashboard)/buyer/messages/page.tsx` | Placeholder — Coming in Phase 3 |
| `src/app/(dashboard)/buyer/profile/page.tsx` | Placeholder — Coming in Phase 4 |
| `src/app/(dashboard)/buyer/settings/page.tsx` | Placeholder — Coming Soon |
| `src/app/(dashboard)/vendor/page.tsx` | Placeholder — Coming in Phase 3 |
| `src/app/(dashboard)/vendor/products/page.tsx` | Placeholder — Coming in Phase 3 |
| `src/app/(dashboard)/vendor/orders/page.tsx` | Placeholder — Coming in Phase 3 |
| `src/app/(dashboard)/vendor/messages/page.tsx` | Placeholder — Coming in Phase 3 |
| `src/app/(dashboard)/vendor/analytics/page.tsx` | Placeholder — Coming in Phase 3 |
| `src/app/(dashboard)/vendor/profile/page.tsx` | Placeholder — Coming in Phase 3 |
| `src/app/(dashboard)/vendor/settings/page.tsx` | Placeholder — Coming Soon |
| `src/app/(dashboard)/admin/page.tsx` | Placeholder — Coming in Phase 4 |
| `src/app/(dashboard)/admin/vendors/page.tsx` | Placeholder — Coming in Phase 4 |
| `src/app/(dashboard)/admin/products/page.tsx` | Placeholder — Coming in Phase 4 |
| `src/app/(dashboard)/admin/orders/page.tsx` | Placeholder — Coming in Phase 4 |
| `src/app/(dashboard)/admin/users/page.tsx` | Placeholder — Coming in Phase 4 |
| `src/app/(dashboard)/admin/settings/page.tsx` | Placeholder — Coming Soon |
| `src/app/(dashboard)/admin/profile/page.tsx` | Placeholder — Coming Soon |

### Auth components (Phase 2)
| File | Purpose |
|---|---|
| `src/components/auth/PhoneOTPForm.tsx` | Phone number + 6-digit OTP form; invisible reCAPTCHA |
| `src/components/auth/EmailOTPForm.tsx` | Firebase email magic-link form |
| `src/hooks/useAuth.ts` | login, register, logout, redirectAfterLogin, session check on mount |
| `src/stores/authStore.ts` | Zustand: user, isLoading, isAuthenticated |

### App pages (all placeholders until Phase 2+)
| File | Route |
|---|---|
| `src/app/page.tsx` | `/` — Landing page |
| `src/app/layout.tsx` | Root layout |
| `src/app/globals.css` | Global styles |
| `src/app/(auth)/login/page.tsx` | `/login` — Phone OTP + Email magic-link tabs; handles email link callback |
| `src/app/(auth)/register/page.tsx` | `/register` — 4-step: OTP → role → details → vendor extras |
| `src/app/(dashboard)/admin/page.tsx` | `/admin` |
| `src/app/(dashboard)/buyer/page.tsx` | `/buyer` |
| `src/app/(dashboard)/vendor/page.tsx` | `/vendor` |
| `src/app/marketplace/page.tsx` | `/marketplace` |

### API routes (all return placeholder JSON until Phase 2+)
| File | Endpoint |
|---|---|
| `src/app/api/auth/route.ts` | `GET /api/auth` |
| `src/app/api/products/route.ts` | `GET /api/products` |
| `src/app/api/orders/route.ts` | `GET /api/orders` |
| `src/app/api/vendors/route.ts` | `GET /api/vendors` |
| `src/app/api/messages/route.ts` | `GET /api/messages` |
| `src/app/api/webhooks/route.ts` | `POST /api/webhooks` |

### Library files (fully implemented)
| File | Contents |
|---|---|
| `src/lib/supabase/client.ts` | `createClient()` — browser client |
| `src/lib/supabase/server.ts` | `createClient()` — server client with cookies |
| `src/lib/supabase/admin.ts` | `createAdminClient()` — service role, bypasses RLS |
| `src/lib/firebase/config.ts` | Firebase app + `auth` export (Auth ONLY) |
| `src/lib/firebase/admin.ts` | `adminAuth` for server-side token verification |
| `src/lib/utils/formatting.ts` | `formatINR`, `formatDate`, `formatOrderNumber`, `truncateText` |
| `src/lib/utils/validation.ts` | Zod: `phoneSchema`, `emailSchema`, `otpSchema` |
| `src/lib/constants/categories.ts` | 6 categories + 44 subcategories with helpers (`PRODUCT_CATEGORIES`, `SUBCATEGORIES`, `getSubcategoriesByCategory`) |
| `supabase/migrations/20260322000001_core_enums_and_users.sql` | Migration 1: enums, subcategories table (44 rows), users, vendor_applications, RLS |
| `docs/database/01_users_and_categories_schema.md` | Plain-English schema reference for Migration 1 |
| `supabase/migrations/20260322000002_products_table.sql` | Migration 2: products table (28 cols), slug trigger, 10 indexes, 5 RLS policies |
| `docs/database/02_products_schema.md` | Plain-English schema reference for Migration 2 |
| `supabase/migrations/20260322000003_orders_and_messages.sql` | Migration 3: orders (17 cols), order_items (11 cols), messages (8 cols), order number trigger, 13 indexes, 11 RLS policies |
| `docs/database/03_orders_messages_schema.md` | Plain-English schema reference for Migration 3 |
| `supabase/migrations/20260324000001_update_order_status_and_vendor_directory.sql` | Migration 4: new order_status values, 5 new order columns, vendor_directory table, products.vendor_id nullable, products.uploaded_by |
| `src/app/api/admin/stats/route.ts` | GET /api/admin/stats — admin-only; returns 6 stats, 5 pending orders, 10 recent orders |
| `src/app/(dashboard)/admin/page.tsx` | Admin dashboard home — welcome banner, stat cards, pending orders table, activity feed |
| `src/app/(dashboard)/admin/products/import/page.tsx` | Excel import page — drag-and-drop .xlsx upload, progress, summary card, error table |
| `src/app/(dashboard)/admin/products/page.tsx` | Product Catalog Manager — search/filter, inline price edit, stock toggle, bulk actions, pagination |
| `src/app/(dashboard)/admin/products/[id]/edit/page.tsx` | Edit product — pre-filled ProductForm, PUT on save |
| `src/app/(dashboard)/admin/products/new/page.tsx` | Add new product — empty ProductForm, POST on save |
| `src/components/admin/ProductForm.tsx` | Shared product form: all fields, bulk pricing tiers, tags, image placeholder |
| `src/app/api/admin/products/import/route.ts` | POST — Excel bulk import (xlsx, 2-sheet, unit/category map, batch insert) |
| `src/app/api/admin/products/route.ts` | GET (paginated list + filters) + POST (create single) — admin only |
| `src/app/api/admin/products/[id]/route.ts` | PUT (update any field) + DELETE (soft-delete) — admin only |
| `src/app/(dashboard)/admin/buyers/page.tsx` | Placeholder — Buyer accounts list |
| `src/app/(dashboard)/admin/analytics/page.tsx` | Placeholder — Platform analytics |
| `src/types/database.ts` | Full `Database` type: 7 tables (Row/Insert/Update for each), 7 enums, typed JSONB helpers |
| `src/lib/supabase/queries.ts` | 11 typed query functions for all major data access patterns |
| `TECH_DECISIONS.md` | Architecture decisions log — why we built it the way we did |

### Types
| File | Contents |
|---|---|
| `src/types/database.ts` | Empty shell — populate after Phase 1 schema |
| `src/types/index.ts` | User, Product, Order, Message, VendorApplication, PricingTier, OrderItem, DeliveryAddress, ApiResponse, PaginatedResponse |

### Other
| File | Contents |
|---|---|
| `src/proxy.ts` | Route protection placeholder (Next.js 16 proxy convention) |
| `src/hooks/index.ts` | Placeholder — hooks added in Phase 2 |
| `src/stores/index.ts` | Placeholder — Zustand stores added in Phase 2 |

---

## Environment Variables Status

| Variable | Status | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✅ Set | |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✅ Set | |
| `SUPABASE_SERVICE_ROLE_KEY` | ✅ Set | |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | ✅ Set | |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | ✅ Set | |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | ✅ Set | |
| `FIREBASE_ADMIN_PROJECT_ID` | ✅ Set | |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | ✅ Set | |
| `FIREBASE_ADMIN_PRIVATE_KEY` | ✅ Set | |
| `WEBHOOK_URL` | ⏳ Pending | Set when webhook endpoint is created in Phase 4 |
| `NEXT_PUBLIC_APP_URL` | ✅ Set | `http://localhost:3000` — update to prod URL on Vercel |

---

## Installed Packages

### Dependencies
| Package | Version | Why |
|---|---|---|
| `next` | 16.2.1 | Framework |
| `react` + `react-dom` | 19.2.4 | UI runtime |
| `typescript` | 5.9.3 | Language |
| `tailwindcss` | 4.2.2 | Styling |
| `@supabase/supabase-js` | 2.99.3 | Database client |
| `@supabase/ssr` | 0.9.0 | Cookie-aware server client |
| `firebase` | 12.11.0 | Auth OTP (client) |
| `firebase-admin` | 13.7.0 | Token verification (server) |
| `zustand` | 5.0.12 | Client state management |
| `react-hot-toast` | 2.6.0 | Toast notifications |
| `lucide-react` | 0.577.0 | Icons |
| `date-fns` | 4.1.0 | Date formatting |
| `date-fns-tz` | 3.2.0 | IST timezone conversion |
| `zod` | 4.3.6 | Schema validation |
| `xlsx` | 0.18.5 | Parse .xlsx files for bulk product import (server-side, SheetJS) |

---

## Known Issues & Decisions

| # | Issue / Decision | Resolution |
|---|---|---|
| 1 | `create-next-app` installed Next.js 16 despite requesting v15 | Accepted — v16 is strictly better, no breaking changes for us |
| 2 | Next.js 16 renamed `middleware.ts` → `proxy.ts` and `middleware()` → `proxy()` | Fixed — file is `src/proxy.ts` exporting `proxy` |
| 3 | Firebase Admin SDK v13 uses modular imports (`firebase-admin/auth`) not `admin.auth()` | Fixed — `src/lib/firebase/admin.ts` uses modular style |
| 4 | `date-fns-tz` needed for IST timezone in `formatDate()` | Added as explicit dependency |
