# Database Schema: Users & Vendor Applications

**Migration file:** `supabase/migrations/20260322000001_core_enums_and_users.sql`
**Created:** 2026-03-22
**Status:** Ready to run

---

## What this migration does (plain English)

This is the very first database migration. It sets up the **foundation** of the entire Primeserve platform — the building blocks every other table will depend on.

---

## Part 1 — Enums (Locked-in value lists)

Think of enums as dropdown menus that the database enforces. If you try to save a value that isn't in the list, the database rejects it. This prevents garbage data.

| Enum name | What it controls | Allowed values |
|-----------|-----------------|---------------|
| `user_role` | What kind of account someone has | admin, buyer, vendor |
| `product_category` | Housekeeping product types (strict boundary) | cleaning_chemicals, cleaning_tools_equipment, paper_disposables, uniforms_linens, trash_management, washroom_supplies, amenities_consumables |
| `order_status` | Where an order is in its lifecycle | pending → confirmed → processing → shipped → delivered → cancelled |
| `payment_status` | Payment state | pending, paid, failed, refunded |
| `stock_status` | Product availability | in_stock, out_of_stock, low_stock |
| `vendor_application_status` | State of a vendor application | pending, approved, rejected |
| `unit_of_measure` | How products are sold | piece, kg, liter, pack, box, carton, roll, pair, set |

---

## Part 2 — Auto-timestamp function

Every time a row is updated anywhere in the database, we need `updated_at` to automatically change to right now. Instead of writing this logic 10 times, we write it once as a **trigger function** called `update_updated_at_column()` and attach it to every table.

---

## Part 3 — The `users` table

This is the **single most important table**. Every person using Primeserve — whether they're buying, selling, or running the platform — has exactly one row here.

### How authentication works with this table

- Firebase handles the **OTP login** (phone or email code)
- When a user logs in for the first time, our app creates a row in this table
- The `id` column is a UUID that **matches their Supabase Auth ID** — this is what allows the database security rules to know who is asking for data
- The `firebase_uid` column stores their Firebase ID so we can look them up during login

### Key columns explained

| Column | Plain English |
|--------|--------------|
| `id` | Unique identifier — same UUID as their Supabase login ID |
| `firebase_uid` | Their Firebase OTP identity — used during login to find their account |
| `role` | Are they a buyer, vendor, or admin? Default is buyer |
| `email` / `phone` | Contact info — at least one is required |
| `company_name` / `company_type` | Their business identity |
| `gst_number` | Required for B2B invoicing in India |
| `business_verified` | Has an admin confirmed their business documents? Defaults to false |
| `business_documents` | List of uploaded verification files (stored as flexible JSON) |
| `is_active` | Can they use the platform? Admins can deactivate accounts |

### Automatic behaviors
- `updated_at` changes automatically every time any field is updated
- Three database indexes are created for fast lookups by Firebase UID, email, and role

---

## Part 4 — The `vendor_applications` table

When a buyer wants to become a vendor (supplier), they fill out an application form. This table stores those applications.

### How the vendor onboarding flow works

1. User (currently a buyer) fills out the vendor application form
2. A row is created in `vendor_applications` with `status = 'pending'`
3. Admin sees it in their dashboard and reviews the business documents
4. Admin either approves (sets `status = 'approved'`) or rejects (`status = 'rejected'`)
5. On approval: the app also updates `users.role = 'vendor'` for that user

### Key columns explained

| Column | Plain English |
|--------|--------------|
| `user_id` | Which user submitted this application |
| `product_categories` | Which housekeeping categories they want to sell in |
| `business_documents` | Their GST certificate, trade license, etc. |
| `status` | Where the application is in review (pending/approved/rejected) |
| `reviewed_by` | Which admin reviewed it |
| `review_notes` | Admin's internal notes (reason for approval or rejection) |
| `reviewed_at` | When the decision was made |

---

## Part 5 — Security rules (RLS)

Row Level Security (RLS) is like a filter the database applies to every single query. Even if someone's code tries to fetch all users, RLS silently filters the results to only what they're allowed to see.

### Users table security

| Who | What they can do |
|-----|-----------------|
| Any logged-in user | Read and update **their own** profile row only |
| Admin | Read and update **any** user row |
| Registration API (service role) | Insert new user rows during sign-up |

**Important:** Regular users **cannot** change their own `role`, `business_verified`, or `is_active` fields. Those can only be changed by an admin (enforced at the API layer, not RLS, since RLS can't restrict individual columns — only rows).

### Vendor applications security

| Who | What they can do |
|-----|-----------------|
| Any logged-in user | Read their own applications, create a new application |
| Admin | Read all applications, update any application (to approve/reject) |

---

## How to run this migration

### Option A — Supabase Dashboard SQL Editor (recommended if no CLI)

1. Go to [supabase.com](https://supabase.com) and open your project
2. Click **SQL Editor** in the left sidebar
3. Click **New query**
4. Copy the entire contents of `supabase/migrations/20260322000001_core_enums_and_users.sql`
5. Paste it into the editor
6. Click **Run** (or press Ctrl+Enter / Cmd+Enter)
7. You should see "Success. No rows returned" — that's correct for DDL statements

### Option B — Supabase CLI (if set up)

```bash
supabase db push
```

---

## Verify it worked

After running, go to **Table Editor** in your Supabase dashboard. You should see:
- `users` table with all columns listed
- `vendor_applications` table with all columns listed

Go to **Database → Functions** and you should see `update_updated_at_column`.

Go to **Authentication → Policies** and you should see 5 policies on `users` and 4 on `vendor_applications`.
