# Primeserve — Claude Code Master Instructions

> Read this file at the start of every session before writing any code.
> Also read `PROJECT_STATE.md` in the project root to know what is built and what comes next.

---

## 1. Project Identity

| Field | Value |
|---|---|
| **Product name** | Primeserve Facility Solutions |
| **Type** | B2B Marketplace |
| **Phase** | MVP — Housekeeping supplies and services ONLY |
| **Users** | Buyers (facility managers), Vendors (suppliers), Admins |
| **Market** | India — prices in INR, dates in IST, GST-compliant |

**STRICT BOUNDARY:** This MVP covers housekeeping supplies and services ONLY.
Do NOT build features for plumbing, electrical, HVAC, pest control, security, or any
other facility management category. That is a future product. Stay in scope.

---

## 2. Tech Stack

| Layer | Technology | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router) | Installed as "next@latest" — actually v16 |
| Language | TypeScript strict mode | No `any` types — ever |
| Styling | Tailwind CSS v4 | Utility-only — no inline styles |
| Auth | Firebase Auth | Phone OTP + Email OTP ONLY |
| Database | Supabase PostgreSQL | Single source of truth for all data |
| State | Zustand | Lightweight client state stores |
| Icons | lucide-react | Use icon names from `src/lib/constants/categories.ts` |
| Toasts | react-hot-toast | All user feedback via toast |
| Dates | date-fns + date-fns-tz | Always render in IST (Asia/Kolkata) |
| Validation | zod | Schema validation for all forms and API inputs |
| Package manager | pnpm | Never use npm or yarn |
| Deployment | Vercel | Environment variables set in Vercel dashboard |

### What Firebase is used for — and ONLY this:
- `signInWithPhoneNumber()` — Phone OTP
- `sendSignInLinkToEmail()` — Email OTP (passwordless)
- `verifyIdToken()` on the server (via Firebase Admin SDK)

**FORBIDDEN Firebase imports:**
```
// ❌ NEVER import these — they introduce a second database
import { getFirestore } from "firebase/firestore";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";
```

---

## 3. Architecture & File Structure

```
src/
├── app/                          ← All pages (Next.js App Router)
│   ├── (auth)/login/             ← Login page
│   ├── (auth)/register/          ← Registration page
│   ├── (dashboard)/admin/        ← Admin dashboard
│   ├── (dashboard)/buyer/        ← Buyer dashboard
│   ├── (dashboard)/vendor/       ← Vendor dashboard
│   ├── api/auth/                 ← Auth API routes
│   ├── api/products/             ← Products CRUD
│   ├── api/orders/               ← Order management
│   ├── api/vendors/              ← Vendor management
│   ├── api/messages/             ← Messaging
│   ├── api/webhooks/             ← External webhooks
│   ├── marketplace/              ← Public product catalogue
│   ├── layout.tsx                ← Root layout
│   └── page.tsx                  ← Landing page
├── components/
│   ├── ui/                       ← Reusable: Button, Input, Modal, Card, Badge, Spinner
│   ├── layout/                   ← Navbar, Sidebar, Footer, PageHeader
│   ├── auth/                     ← LoginForm, OtpInput, PhoneInput
│   ├── admin/                    ← VendorApproval, OrderManagement, UserTable
│   ├── buyer/                    ← OrderHistory, CartSidebar, AddressForm
│   ├── vendor/                   ← ProductForm, OrderQueue, EarningsSummary
│   └── marketplace/              ← ProductCard, CategoryFilter, SearchBar, PricingTable
├── lib/
│   ├── supabase/client.ts        ← Browser Supabase client
│   ├── supabase/server.ts        ← Server Supabase client (cookie-aware)
│   ├── supabase/admin.ts         ← Service role client (bypasses RLS)
│   ├── firebase/config.ts        ← Firebase Auth init (client)
│   ├── firebase/admin.ts         ← Firebase Admin SDK (server)
│   ├── utils/formatting.ts       ← formatINR, formatDate, formatOrderNumber, truncateText
│   ├── utils/validation.ts       ← Zod schemas: phoneSchema, emailSchema, otpSchema
│   └── constants/categories.ts  ← 7 housekeeping categories with meta
├── hooks/                        ← Custom hooks: useAuth, useCart, useProducts, etc.
├── stores/                       ← Zustand stores: authStore, cartStore
├── types/
│   ├── database.ts               ← Auto-generated Supabase types (run gen command to update)
│   └── index.ts                  ← Business types: User, Product, Order, Message, etc.
└── proxy.ts                      ← Route protection (Next.js 16 renamed middleware → proxy)
```

### Rules:
1. Pages go in `src/app/` — no exceptions
2. API routes go in `src/app/api/` with `route.ts` files
3. Every reusable piece of UI goes in `src/components/`
4. No business logic in components — keep it in `src/lib/` or API routes
5. No direct Supabase calls in Server Components — use API routes
6. The `proxy.ts` export must be named `proxy` (not `middleware`) — Next.js 16 requirement

---

## 4. Coding Standards

### TypeScript
- Strict mode is enabled — no `any`, no `@ts-ignore`
- All function parameters and return types must be explicit
- Use interfaces from `src/types/index.ts` — don't redefine types inline
- Use `Database` type from `src/types/database.ts` for Supabase queries

### JSDoc
Every exported function must have a JSDoc comment:
```typescript
/**
 * Brief one-line description.
 * @param amount - The amount in INR paise
 * @returns Formatted string like "₹1,23,456.00"
 */
export function formatINR(amount: number): string { ... }
```

### API Routes
Every route handler must follow this pattern:
```typescript
export async function GET(request: NextRequest) {
  try {
    // logic here
    return NextResponse.json({ data: result, error: null });
  } catch (error) {
    console.error("[api/products GET]", error);
    return NextResponse.json({ data: null, error: "Internal server error" }, { status: 500 });
  }
}
```

### Components
Every component must handle all four states — no exceptions:
```typescript
if (isLoading) return <Spinner />;
if (error) return <ErrorState message={error} />;
if (!data || data.length === 0) return <EmptyState />;
return <ActualContent data={data} />;
```

### Currency & Dates
- All prices stored as `number` (float, INR)
- All prices displayed via `formatINR()` from `src/lib/utils/formatting.ts`
- All dates displayed via `formatDate()` — always IST
- Never use `new Date().toString()` directly in the UI

---

## 5. Design System

### Colour Palette
| Role | Name | Hex | Tailwind |
|---|---|---|---|
| Primary | Deep Teal | `#0D9488` | `teal-600` |
| Primary dark | Deep Teal Dark | `#0F766E` | `teal-700` |
| Secondary | Slate Blue | `#475569` | `slate-600` |
| Accent | Amber | `#F59E0B` | `amber-500` |
| Success | Emerald | `#10B981` | `emerald-500` |
| Warning | Amber | `#F59E0B` | `amber-500` |
| Error | Rose | `#F43F5E` | `rose-500` |
| Background | Slate 50 | `#F8FAFC` | `slate-50` |
| Surface | White | `#FFFFFF` | `white` |
| Border | Slate 200 | `#E2E8F0` | `slate-200` |
| Text primary | Slate 900 | `#0F172A` | `slate-900` |
| Text secondary | Slate 500 | `#64748B` | `slate-500` |

### Typography
| Use | Font | Tailwind class |
|---|---|---|
| Headings (H1–H3) | Plus Jakarta Sans | `font-heading` |
| Body text | DM Sans | `font-sans` (default) |
| Numbers, prices, order IDs | JetBrains Mono | `font-mono` |

Fonts must be loaded via `next/font/google` in `src/app/layout.tsx`.

### Spacing & Radius
- Cards: `rounded-xl shadow-sm border border-slate-200`
- Buttons: `rounded-lg`
- Inputs: `rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500`
- Page max width: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`

### Component Conventions
```
Button variants: primary (teal), secondary (slate outline), ghost, danger (rose)
Badge variants: status colours matching OrderStatus and VendorApplicationStatus
Card: white bg, slate-200 border, xl radius, sm shadow
```

---

## 6. Supabase Rules

1. **Every table must have RLS enabled** — no table is accessible without a policy
2. **Never skip the service role client for admin ops** — use `createAdminClient()`
3. **Foreign keys must reference `users.id`** — not Firebase UID directly
4. **Soft deletes only** — add `deleted_at TIMESTAMPTZ` rather than hard-deleting rows
5. **All timestamps in UTC** in the database — convert to IST only in the UI layer
6. **Naming convention:** snake_case for all table and column names

### RLS Policy pattern:
```sql
-- Users can only see their own data
CREATE POLICY "users_own_data" ON users
  FOR ALL USING (auth.uid()::text = id::text);
```

---

## 7. Auth Flow

```
Browser                     Firebase              Supabase
  │                             │                     │
  │── Phone/Email OTP ─────────>│                     │
  │<─ Firebase ID Token ────────│                     │
  │                             │                     │
  │── POST /api/auth/verify ──────────────────────────>
  │   { idToken: "..." }        │   verify token       │
  │                             │   upsert user row    │
  │<─ Set httpOnly cookie ─────────────────────────────
  │   (Supabase session)        │                     │
```

- Firebase handles OTP delivery and token issuance
- `/api/auth/verify` validates the Firebase token, upserts the user in Supabase, sets a session cookie
- All subsequent requests use the Supabase session cookie
- `proxy.ts` reads the cookie to protect routes

---

## 8. Forbidden Patterns

```typescript
// ❌ Never use any type
const data: any = response.json();

// ❌ Never use Firestore or Realtime DB
import { getFirestore } from "firebase/firestore";

// ❌ Never expose service role key to the browser
// (createAdminClient in a "use client" component)

// ❌ Never use localStorage for auth tokens
localStorage.setItem("token", idToken);

// ❌ Never write inline CSS
<div style={{ color: "red" }}>

// ❌ Never build facility management features
// (plumbing, electrical, HVAC, security systems, pest control)

// ❌ Never skip RLS on a Supabase table

// ❌ Never install packages without stating why
```

---

## 9. User Context

The user is a **non-technical founder** using vibe coding. When writing code or explaining decisions:

- Use plain English — avoid jargon without explanation
- Explain the "why" not just the "what"
- Warn before making changes that could break something
- Ask for approval before destructive or irreversible actions
- When something might take a while, say so upfront
- Flag any decision that has cost implications (Supabase, Firebase pricing)

---

## 10. Quick Reference Commands

```bash
pnpm dev              # Start development server on localhost:3000
pnpm build            # Production build (runs TypeScript check)
pnpm lint             # ESLint check
pnpm type-check       # TypeScript check only (tsc --noEmit)

# Supabase (when Supabase CLI is installed)
pnpm supabase gen types typescript --project-id <id> > src/types/database.ts
```
