# Primeserve — Claude Code Instructions

> Read PROJECT_STATE.md first. It tells you what is built and what comes next.

---

## Stack

| Layer | Tech | Notes |
|---|---|---|
| Framework | Next.js 16 (App Router) | `proxy.ts` not `middleware.ts`; export `proxy` not `middleware` |
| Language | TypeScript strict | No `any` — ever |
| Styling | Tailwind CSS v4 | Utility-only, no inline styles |
| Auth | Firebase Auth | Phone OTP + Email OTP ONLY |
| Database | Supabase PostgreSQL | Single source of truth |
| State | Zustand | Client stores only |
| Icons | lucide-react | |
| Toasts | react-hot-toast | |
| Validation | zod | All forms and API inputs |
| Package mgr | pnpm | Never npm/yarn |

**Firebase ONLY for:** `signInWithPhoneNumber`, `sendSignInLinkToEmail`, `verifyIdToken` (server)
**NEVER import:** `firebase/firestore`, `firebase/database`, `firebase/storage`

---

## File Structure

```
src/app/          ← Pages (App Router) + API routes in api/
src/components/   ← UI by feature: ui/, layout/, auth/, admin/, buyer/, vendor/, marketplace/
src/lib/          ← supabase/(client|server|admin).ts, firebase/(config|admin).ts, utils/, constants/
src/hooks/        ← Custom hooks (useAuth, etc.)
src/stores/       ← Zustand stores (authStore, cartStore)
src/types/        ← database.ts (auto-gen), index.ts (business types)
src/proxy.ts      ← Route protection (NOT middleware.ts)
```

Rules: No direct Supabase calls in Server Components — use API routes. No business logic in components.

---

## Coding Standards

**API routes** — every handler:
```typescript
export async function GET(request: NextRequest) {
  try {
    return NextResponse.json({ data: result, error: null });
  } catch (error) {
    console.error("[api/route GET]", error);
    return NextResponse.json({ data: null, error: "Internal server error" }, { status: 500 });
  }
}
```

**Components** — every component must handle all four states:
```typescript
if (isLoading) return <Spinner />;
if (error) return <ErrorState message={error} />;
if (!data || data.length === 0) return <EmptyState />;
return <ActualContent data={data} />;
```

**Prices:** always `formatINR(amount)` — **Dates:** always `formatDate(date)` in IST

---

## Design System

| Role | Tailwind |
|---|---|
| Primary | `teal-600` / `teal-700` |
| Secondary | `slate-600` |
| Accent / Warning | `amber-500` |
| Success | `emerald-500` |
| Error | `rose-500` |
| Background | `slate-50` |
| Surface | `white` |
| Border | `slate-200` |
| Text primary | `slate-900` |
| Text secondary | `slate-500` |

Fonts (loaded via `next/font/google`): headings = Plus Jakarta Sans (`font-heading`), body = DM Sans, numbers = JetBrains Mono (`font-mono`)

Cards: `rounded-xl shadow-sm border border-slate-200` | Buttons: `rounded-lg` | Inputs: `rounded-lg border border-slate-300 focus:ring-2 focus:ring-teal-500` | Page width: `max-w-7xl mx-auto px-4 sm:px-6 lg:px-8`

---

## Supabase Rules

1. Every table must have RLS enabled — no exceptions
2. Admin ops use `createAdminClient()` (service role — bypasses RLS)
3. Soft deletes only — `deleted_at TIMESTAMPTZ`, never hard-delete
4. All timestamps UTC in DB — convert to IST in UI only
5. snake_case for all table/column names

---

## Auth Flow (brief)

1. Browser sends Phone/Email OTP via Firebase → gets Firebase ID token
2. `POST /api/auth/verify` validates token, upserts user in Supabase, sets `ps-session` httpOnly cookie
3. All subsequent requests use `ps-session` cookie
4. `proxy.ts` reads cookie to protect `/admin/*`, `/vendor/*`, `/buyer/*`

---

## Forbidden

- `any` type anywhere
- Firestore / Realtime DB / Firebase Storage
- `localStorage` for auth tokens — use httpOnly cookies
- Inline CSS — Tailwind only
- Facility management features (plumbing, electrical, HVAC, pest, security)
- Skipping RLS on any table
- Installing packages without stating the reason
- Hard-deleting rows from the database

---

## User Context

Non-technical founder — vibe coding. Always:
- Explain decisions in plain English
- Warn before changes that could break something
- Ask approval before destructive/irreversible actions
- Flag anything with cost implications (Supabase, Firebase pricing)

---

## Quick Commands

```bash
pnpm dev          # localhost:3000
pnpm build        # TypeScript + production build
pnpm type-check   # tsc --noEmit
pnpm lint         # ESLint
```
