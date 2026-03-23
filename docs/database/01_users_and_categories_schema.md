# Schema Reference: Users, Vendor Applications & Categories

Migration file: `supabase/migrations/20260322000001_core_enums_and_users.sql`

---

## What this migration does (plain English)

This is the first real database migration for Primeserve. It sets up the building blocks that every other table will depend on:

1. **Product categories and subcategories** — the 6 top-level categories and all 44 subcategories from the real product catalog.
2. **Core enum types** — locked-in choices like order statuses, user roles, and units of measure.
3. **An auto-timestamp function** — a reusable helper that keeps `updated_at` accurate on every table.
4. **The users table** — one row per person who signs up: admin, buyer, or vendor.
5. **The vendor applications table** — when a buyer wants to become a vendor, they submit an application that an admin reviews.
6. **Row Level Security (RLS) policies** — database-level rules that ensure users can only see and edit their own data.

---

## Product Categories

We serve 6 product categories derived from our real catalog (394 products):

| Category value | Display name | Products | Notes |
|---|---|---|---|
| `housekeeping_materials` | Housekeeping Materials | Active | 21 subcategories |
| `cleaning_chemicals` | Cleaning Chemicals | Active | 3 subcategories |
| `pantry_items` | Pantry Items | Active | 1 subcategory |
| `office_stationeries` | Office Stationeries | Active | 17 subcategories |
| `facility_and_tools` | Facility & Tools | Active | 2 subcategories |
| `printing_solution` | Printing Solution | 0 products | Reserved for roadmap |

The category values are stored as a PostgreSQL ENUM (`product_category`). This means the database will reject any value that isn't in this list — good for data integrity.

---

## Subcategories Table

Instead of using another enum (which would require a migration every time we add a subcategory), we use a reference table. This lets admins add new subcategories directly from the admin panel.

**Total: 44 subcategories seeded**

| Column | Type | Purpose |
|---|---|---|
| `id` | UUID | Primary key |
| `category` | product_category | Which top-level category this belongs to |
| `name` | TEXT | Internal slug (e.g. `garbage_bags_black`) |
| `slug` | TEXT | URL-safe identifier (same as name) |
| `display_name` | TEXT | Human-readable label shown in the UI |
| `description` | TEXT | Optional longer description |
| `icon_name` | TEXT | lucide-react icon name for the UI |
| `sort_order` | INTEGER | Controls display order within a category |
| `is_active` | BOOLEAN | Hide/show without deleting |
| `created_at` | TIMESTAMPTZ | When the row was created |

**Uniqueness rule:** `(category, slug)` must be unique — no two subcategories in the same category can have the same slug.

---

## Other Enums

| Enum | Values |
|---|---|
| `user_role` | `admin`, `buyer`, `vendor` |
| `order_status` | `pending`, `confirmed`, `processing`, `shipped`, `delivered`, `cancelled` |
| `payment_status` | `pending`, `paid`, `failed`, `refunded` |
| `stock_status` | `in_stock`, `out_of_stock`, `low_stock` |
| `vendor_application_status` | `pending`, `approved`, `rejected` |
| `unit_of_measure` | `piece`, `kg`, `liter`, `pack`, `box`, `carton`, `roll`, `pair`, `set`, `ream`, `pkt`, `can`, `bottle`, `tube` |

The `unit_of_measure` enum includes `ream` (paper), `pkt` (packets), `can` (chemical cans), `bottle`, and `tube` — all derived from the actual units column in the product catalog.

---

## Users Table

One row per person on the platform.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key — must match Supabase Auth user ID |
| `firebase_uid` | TEXT UNIQUE | Firebase Auth UID from OTP sign-in |
| `role` | user_role | Defaults to `buyer` |
| `email` | TEXT UNIQUE | Optional (phone-only users won't have one) |
| `phone` | TEXT UNIQUE | Optional (email-only users won't have one) |
| `full_name` | TEXT | Required |
| `avatar_url` | TEXT | Profile photo URL |
| `company_name` | TEXT | For B2B identity |
| `company_type` | TEXT | hotel / restaurant / office / hospital / agency / etc. |
| `gst_number` | TEXT | Required for B2B invoicing in India |
| `tax_id` | TEXT | PAN or TAN for compliance |
| `business_verified` | BOOLEAN | Set by admin only |
| `business_documents` | JSONB | Array of `{doc_type, url, uploaded_at}` |
| `address_line1/2` | TEXT | Delivery address |
| `city`, `state`, `pincode` | TEXT | Indian address fields |
| `is_active` | BOOLEAN | Soft-delete flag — admin-controlled |
| `created_at`, `updated_at` | TIMESTAMPTZ | Auto-managed |

**Important:** `id` must equal the Supabase Auth user's UUID. During registration, our API creates the Supabase Auth user first, then inserts a `users` row with that same UUID. This is what makes `auth.uid() = users.id` work in RLS policies.

---

## Vendor Applications Table

When a buyer wants to sell on Primeserve, they submit an application.

| Column | Type | Notes |
|---|---|---|
| `id` | UUID | Primary key |
| `user_id` | UUID → users.id | The applicant |
| `company_name` | TEXT | Required |
| `gst_number` | TEXT | Optional at submission |
| `business_type` | TEXT | Type of business |
| `business_documents` | JSONB | Supporting documents array |
| `product_categories` | product_category[] | Which categories they'll supply |
| `description` | TEXT | About the business |
| `status` | vendor_application_status | Starts as `pending` |
| `reviewed_by` | UUID → users.id | Admin who reviewed (SET NULL if admin deleted) |
| `review_notes` | TEXT | Admin's internal notes |
| `reviewed_at` | TIMESTAMPTZ | When the decision was made |
| `created_at`, `updated_at` | TIMESTAMPTZ | Auto-managed |

---

## Row Level Security Summary

RLS is enabled on all three tables. Here's what each role can do:

### Users table

| Who | Can do what |
|---|---|
| Any logged-in user | Read and update their own row |
| Admin | Read and update any row |
| Registration API (service role) | Insert new rows |
| Anyone else | Nothing |

### Vendor Applications table

| Who | Can do what |
|---|---|
| Applicant (any logged-in user) | Read their own applications, submit new ones |
| Admin | Read all applications, update any application |
| Anyone else | Nothing |

### Subcategories table

| Who | Can do what |
|---|---|
| Anyone (including visitors) | Read all subcategories |
| Admin | Insert, update, delete subcategories |

Subcategories are public reference data — the marketplace must load them even before a user logs in.

---

## Auto-timestamp Trigger

A single function `update_updated_at_column()` is attached to both `users` and `vendor_applications` as a `BEFORE UPDATE` trigger. Every time a row is updated, it automatically sets `updated_at = NOW()`. No application code needs to manage this.

---

## What comes next

After running this migration, the next step is **Migration 2: Products table**, which will reference `product_category` and the `subcategories` table via foreign keys.
