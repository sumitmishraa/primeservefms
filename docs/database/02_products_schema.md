# Schema Reference: Products Table

Migration file: `supabase/migrations/20260322000002_products_table.sql`
Depends on: Migration 1 (`20260322000001_core_enums_and_users.sql`)

---

## What this migration does (plain English)

This migration creates the `products` table — the core of the Primeserve marketplace. Every one of the 394 products from the Excel catalog will be stored here. It also adds:

- A **slug auto-generation function** so product URLs are created automatically from the product name
- **10 indexes** so the marketplace loads fast even with thousands of products
- **5 RLS policies** so the public can browse freely, vendors only touch their own listings, and admins can manage everything

---

## Where the data comes from (Excel → Database mapping)

The product catalog has two Excel sheets:

| Excel sheet | Products | Columns |
|---|---|---|
| Housekeeping | 234 | SL.No, Item Description, size/brand, units, Category, Sub-category, Image Urls |
| Stationery | 160 | SL.No, Item Description, size/brand, Qty, Category, Sub-category |

| Excel column | Database column(s) |
|---|---|
| Item Description | `name` |
| size/brand | Split into `brand` + `size_variant` (see below) |
| units / Qty | `unit_of_measure` |
| Category | `category` (maps to `product_category` enum) |
| Sub-category | `subcategory_id` + `subcategory_slug` |
| Image Urls | `images[]` + `thumbnail_url` |

---

## How brand vs size_variant works

The Excel "size/brand" column contains two completely different types of data mixed together. Some rows have a brand name, some have a size, and some have both:

| "size/brand" in Excel | `brand` column | `size_variant` column |
|---|---|---|
| `JK` | `JK` | (empty) |
| `5Ltr` | (empty) | `5Ltr` |
| `500ml` | (empty) | `500ml` |
| `18"x24"` | (empty) | `18"x24"` |
| `Scotch-Brite` | `Scotch-Brite` | (empty) |
| `JK 80GSM A4` | `JK` | `80GSM A4` |
| `3M` | `3M` | (empty) |

**Why split them?**
- **Brand filtering**: The marketplace sidebar shows "Filter by Brand" → `WHERE brand = 'JK'`. This is impossible if brand and size are in one text field.
- **Size display**: Product cards show the size variant prominently below the name (e.g. "500ml bottle"). Mixing it with brand names makes this messy.
- Both `brand` and `size_variant` are nullable — not every product has a brand name (generic items) and not every product has a size variant (e.g. a pack of pens).

---

## How subcategory_id and subcategory_slug work together

Every product has two subcategory columns that carry the same information in different forms:

| Column | Type | Purpose |
|---|---|---|
| `subcategory_id` | UUID → subcategories.id | Referential integrity. Used when you need JOIN data (icon, display name, sort order). |
| `subcategory_slug` | TEXT | Speed. Used in WHERE clauses without a JOIN. |

**Example query using subcategory_slug (fast, no JOIN):**
```sql
SELECT * FROM products
WHERE category = 'housekeeping_materials'
  AND subcategory_slug = 'mops_and_mop_refills'
  AND is_approved = TRUE
  AND is_active = TRUE;
```

**Example query using subcategory_id (with JOIN for full metadata):**
```sql
SELECT p.*, s.display_name, s.icon_name
FROM products p
JOIN subcategories s ON s.id = p.subcategory_id
WHERE p.id = $1;
```

**Important:** When the application updates `subcategory_id`, it must also update `subcategory_slug` to match. There is no database trigger that syncs them automatically — this is intentional to keep the trigger simple. The product form API handles this.

---

## Full table structure

| Column | Type | Required | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | Yes | gen_random_uuid() | Primary key |
| `vendor_id` | UUID → users.id | Yes | — | Cascade delete |
| `name` | TEXT | Yes | — | Product display name |
| `slug` | TEXT UNIQUE | Yes | auto-generated | URL-safe, generated from name |
| `description` | TEXT | No | — | Long description (HTML OK) |
| `short_description` | TEXT | No | — | 1-2 sentence summary for cards |
| `sku` | TEXT | No | — | Vendor's internal code |
| `category` | product_category | Yes | — | One of 6 categories |
| `subcategory_id` | UUID → subcategories.id | No | NULL | SET NULL on subcategory delete |
| `subcategory_slug` | TEXT | No | NULL | Denormalized for fast filtering |
| `brand` | TEXT | No | NULL | From Excel "size/brand" |
| `size_variant` | TEXT | No | NULL | From Excel "size/brand" |
| `unit_of_measure` | unit_of_measure | Yes | `piece` | Enum with 14 values |
| `base_price` | DECIMAL(10,2) | Yes | — | INR, must be > 0 |
| `moq` | INTEGER | Yes | 1 | Min order qty, must be ≥ 1 |
| `pricing_tiers` | JSONB | No | `[]` | Volume discounts array |
| `images` | TEXT[] | No | `{}` | Full-res image URLs |
| `thumbnail_url` | TEXT | No | NULL | Used in product cards |
| `stock_status` | stock_status | No | `in_stock` | in_stock / out_of_stock / low_stock |
| `stock_quantity` | INTEGER | No | 0 | Current stock count |
| `is_approved` | BOOLEAN | No | FALSE | Admin sets to TRUE to publish |
| `is_active` | BOOLEAN | No | TRUE | Vendor can pause; admin can override |
| `hsn_code` | TEXT | No | NULL | For GST invoicing |
| `gst_rate` | DECIMAL(4,2) | No | 18.00 | Must be 0, 5, 12, 18, or 28 |
| `specifications` | JSONB | No | `{}` | Free-form product attributes |
| `tags` | TEXT[] | No | `{}` | Search and filter tags |
| `total_orders` | INTEGER | No | 0 | Updated by orders API |
| `avg_rating` | DECIMAL(2,1) | No | 0 | Updated by reviews API |
| `created_at` | TIMESTAMPTZ | No | NOW() | Auto-set |
| `updated_at` | TIMESTAMPTZ | No | NOW() | Auto-updated by trigger |

---

## Slug auto-generation

When a vendor submits a new product, the `set_product_slug` trigger fires before the row is inserted and:

1. Takes the product name (e.g. `"Scotch-Brite Floor Scrubber 18"x24""`)
2. Lowercases it → `"scotch-brite floor scrubber 18\"x24\""`)
3. Replaces non-alphanumeric chars with hyphens → `"scotch-brite-floor-scrubber-18-x24-"`
4. Collapses consecutive hyphens → `"scotch-brite-floor-scrubber-18-x24-"`
5. Trims edge hyphens → `"scotch-brite-floor-scrubber-18-x24"`
6. Checks if this slug exists — if yes, appends `-ab3f` (random 4 chars) and retries

The resulting slug is used as the product page URL: `/marketplace/scotch-brite-floor-scrubber-18-x24`.

---

## Pricing tiers (B2B volume discounts)

The `pricing_tiers` JSONB column stores volume pricing brackets. Example for a cleaning chemical:

```json
[
  { "min_qty": 1,  "max_qty": 9,    "price": 250.00 },
  { "min_qty": 10, "max_qty": 49,   "price": 220.00 },
  { "min_qty": 50, "max_qty": null, "price": 195.00 }
]
```

- `max_qty: null` means "this price applies to all quantities above min_qty"
- An empty array `[]` means the product uses `base_price` for all quantities
- The application applies the correct tier when a buyer selects quantity in their cart

---

## RLS policies

| Policy | Who | Operation | Condition |
|---|---|---|---|
| Public can view approved active products | Anyone (no login required) | SELECT | `is_approved = TRUE AND is_active = TRUE` |
| Vendors can view own products | Logged-in vendor | SELECT | `vendor_id = auth.uid()` (includes unapproved) |
| Vendors can insert own products | Logged-in vendor | INSERT | `vendor_id = auth.uid()` |
| Vendors can update own products | Logged-in vendor | UPDATE | `vendor_id = auth.uid()` |
| Admins have full access | Admin role | ALL | Admin role check via users table |

**Important note on `is_approved`:** A vendor can update their own products (Policy 4) but cannot set `is_approved = TRUE` themselves — this is blocked at the API layer, not the RLS layer. The API's PATCH /products/:id handler only allows vendors to update safe fields (name, description, price, images, etc.) and ignores any `is_approved` value in the request body.

---

## Indexes explained

| Index | Covers | Why |
|---|---|---|
| `idx_products_slug` | `slug` | Product detail page lookup by URL slug |
| `idx_products_vendor_id` | `vendor_id` | Vendor dashboard "my products" list |
| `idx_products_category` | `category` | Marketplace top-level category filter |
| `idx_products_subcategory_slug` | `subcategory_slug` | Marketplace subcategory drill-down |
| `idx_products_category_subcategory` | `(category, subcategory_slug)` | Most common browse query — covers both filters in one index |
| `idx_products_is_approved` | `is_approved` | Every public marketplace query includes this filter |
| `idx_products_is_active` | `is_active` | Every public marketplace query includes this filter |
| `idx_products_stock_status` | `stock_status` | "In Stock Only" toggle |
| `idx_products_brand` | `brand` | Brand filter sidebar |
| `idx_products_created_at` | `created_at DESC` | Default "Newest First" sort |

---

## What comes next

After running this migration, the next step is **Migration 3: Orders table**, which will reference `products` via `order_items JSONB` (or a separate `order_items` table).
