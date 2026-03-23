-- =============================================================================
-- Migration: 20260322000002_products_table.sql
-- Description: Products table with slug auto-generation trigger, full index
--              set, and RLS policies for public marketplace browsing,
--              vendor self-service, and admin management.
-- Project: Primeserve Facility Solutions
-- Depends on: 20260322000001_core_enums_and_users.sql
--             (product_category, unit_of_measure, stock_status ENUMs;
--              subcategories table; users table; update_updated_at_column())
-- Created: 2026-03-22
--
-- CATALOG CONTEXT
-- This table stores all 394 products from two Excel sheets:
--   • Housekeeping sheet  (234 products) — columns: SL.No, Item Description,
--     size/brand, units, Category, Sub-category, Image Urls
--   • Stationery sheet   (160 products) — columns: SL.No, Item Description,
--     size/brand, Qty, Category, Sub-category
--
-- KEY DESIGN DECISIONS (referenced in column comments below):
--
-- 1. brand vs size_variant split
--    The Excel "size/brand" column carries two distinct types of data:
--      • Brand names  → e.g. "JK", "Scotch-Brite", "Pidilite", "3M"
--      • Size values  → e.g. "5Ltr", "500ml", '18"x24"', "A4", "80GSM"
--    Storing them as one TEXT column would make brand-based filtering and
--    size-based display impossible without string parsing. Splitting them
--    at import time gives clean, queryable columns.
--
-- 2. subcategory_id + subcategory_slug dual columns
--    subcategory_id  → FK to subcategories(id) for referential integrity;
--                       used when joining to the subcategories table for
--                       full metadata (icon, display_name, sort_order).
--    subcategory_slug → denormalized TEXT copy of subcategories.slug;
--                       used for fast WHERE / ORDER BY without a JOIN in
--                       high-traffic listing queries.
--    Both are populated together at insert time. subcategory_slug is kept
--    in sync by the application layer whenever subcategory_id changes.
--
-- 3. unit_of_measure enum source
--    Values are derived from the "units" column in the real Housekeeping
--    sheet and the "Qty" column in the Stationery sheet:
--      piece, kg, liter, pack, box, carton, roll, pair, set,
--      ream (paper), pkt (packets), can (chemical cans), bottle, tube
--
-- 4. pricing_tiers JSONB
--    B2B buyers order in bulk — pricing drops at volume thresholds.
--    Schema per element: { min_qty: int, max_qty: int|null, price: decimal }
--    Example: [{"min_qty":1,"max_qty":9,"price":250},
--              {"min_qty":10,"max_qty":null,"price":220}]
--
-- 5. Slug uniqueness
--    Product names in our catalog are not guaranteed to be unique (different
--    vendors may carry the same item). A trigger auto-generates a slug from
--    the name and appends a random 4-char suffix on collision.
-- =============================================================================


-- =============================================================================
-- SECTION 1: SLUG AUTO-GENERATION FUNCTION
-- Runs BEFORE INSERT on products. Converts the product name to a URL-safe
-- slug. Appends a random 4-char alphanumeric suffix if the slug already
-- exists, guaranteeing uniqueness without a serial counter.
-- =============================================================================

CREATE OR REPLACE FUNCTION generate_product_slug()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  base_slug TEXT;
  candidate TEXT;
  suffix    TEXT;
BEGIN
  -- Only auto-generate if the caller did not supply a slug
  IF NEW.slug IS NOT NULL AND NEW.slug <> '' THEN
    RETURN NEW;
  END IF;

  -- 1. Lowercase the name
  base_slug := lower(NEW.name);

  -- 2. Replace any character that is not a-z, 0-9, or hyphen with a hyphen
  base_slug := regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g');

  -- 3. Collapse consecutive hyphens into one
  base_slug := regexp_replace(base_slug, '-{2,}', '-', 'g');

  -- 4. Trim leading and trailing hyphens
  base_slug := trim(both '-' from base_slug);

  -- 5. Guard against empty slug (e.g. product name was all special chars)
  IF base_slug = '' THEN
    base_slug := 'product';
  END IF;

  candidate := base_slug;

  -- 6. If the candidate already exists, append a random 4-char suffix
  WHILE EXISTS (SELECT 1 FROM products WHERE slug = candidate) LOOP
    suffix    := lower(substr(md5(random()::text), 1, 4));
    candidate := base_slug || '-' || suffix;
  END LOOP;

  NEW.slug := candidate;
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION generate_product_slug() IS
  'BEFORE INSERT trigger: auto-generates a unique URL-safe slug from products.name. '
  'Skipped when the caller supplies a non-empty slug. '
  'Appends a random 4-char suffix on slug collision.';


-- =============================================================================
-- SECTION 2: PRODUCTS TABLE
-- =============================================================================

CREATE TABLE products (
  -- -----------------------------------------------------------------------
  -- Identity
  -- -----------------------------------------------------------------------
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The vendor who listed this product. Cascade-deletes if the vendor
  -- account is removed — products without a vendor have no meaning.
  vendor_id         UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- -----------------------------------------------------------------------
  -- Core product info
  -- -----------------------------------------------------------------------
  name              TEXT          NOT NULL,

  -- URL-safe unique identifier used in product detail page routes
  -- (/marketplace/[slug]). Auto-generated by the trigger below if not set.
  slug              TEXT          UNIQUE NOT NULL,

  description       TEXT,
  short_description TEXT,

  -- Stock-Keeping Unit — vendor's own internal code for the product.
  -- Not enforced as UNIQUE because different vendors may use the same SKU
  -- space. Uniqueness is the vendor's responsibility.
  sku               TEXT,

  -- -----------------------------------------------------------------------
  -- Classification
  -- -----------------------------------------------------------------------
  category          product_category NOT NULL,

  -- FK to subcategories(id). SET NULL if a subcategory is deleted so the
  -- product is not lost — it just becomes uncategorised at subcategory level.
  subcategory_id    UUID          REFERENCES subcategories(id) ON DELETE SET NULL,

  -- Denormalized copy of subcategories.slug for fast WHERE clause filtering
  -- without a JOIN. Kept in sync with subcategory_id by the application.
  -- See DESIGN DECISION 2 in the file header.
  subcategory_slug  TEXT,

  -- -----------------------------------------------------------------------
  -- Brand & size — split from Excel "size/brand" column
  -- See DESIGN DECISION 1 in the file header.
  -- -----------------------------------------------------------------------

  -- The manufacturer or brand name (e.g. "JK", "Scotch-Brite", "3M", "Pidilite").
  -- Populated when the Excel "size/brand" value is a recognisable brand.
  brand             TEXT,

  -- The product size, variant, or specification string
  -- (e.g. "5Ltr", "500ml", '18"x24"', "A4", "80GSM", "900ml").
  -- Populated when the Excel "size/brand" value describes a physical size.
  -- Both brand AND size_variant can be set for items like "JK 80GSM A4 Paper".
  size_variant      TEXT,

  -- -----------------------------------------------------------------------
  -- Units & pricing
  -- -----------------------------------------------------------------------

  -- Unit of measure for one item in an order line (piece, kg, liter, etc.)
  -- See unit_of_measure enum in Migration 1 for all valid values.
  unit_of_measure   unit_of_measure NOT NULL DEFAULT 'piece',

  -- Base (single-unit) price in INR. The pricing_tiers JSONB below overrides
  -- this for bulk quantities; base_price is the fallback for qty < first tier.
  base_price        DECIMAL(10,2)  NOT NULL CHECK (base_price > 0),

  -- Minimum Order Quantity — the smallest quantity a buyer can purchase.
  moq               INTEGER        NOT NULL DEFAULT 1 CHECK (moq >= 1),

  -- Volume pricing tiers. Each element:
  --   { "min_qty": 10, "max_qty": 49, "price": 220.00 }
  --   { "min_qty": 50, "max_qty": null, "price": 195.00 }  (null = no upper limit)
  -- An empty array means flat base_price regardless of quantity.
  pricing_tiers     JSONB          DEFAULT '[]'::jsonb,

  -- -----------------------------------------------------------------------
  -- Media
  -- -----------------------------------------------------------------------

  -- Array of full-resolution image URLs from Supabase Storage.
  -- Sourced from the "Image Urls" column in the Housekeeping Excel sheet.
  -- Stationery sheet had no image URLs — vendors upload those post-onboarding.
  images            TEXT[]         DEFAULT '{}',

  -- First image or a separately optimised thumbnail. Used in product cards
  -- and search results to avoid loading the full images array.
  thumbnail_url     TEXT,

  -- -----------------------------------------------------------------------
  -- Inventory
  -- -----------------------------------------------------------------------
  stock_status      stock_status   DEFAULT 'in_stock',
  stock_quantity    INTEGER        DEFAULT 0,

  -- -----------------------------------------------------------------------
  -- Approval & visibility
  -- -----------------------------------------------------------------------

  -- Admin must set is_approved = TRUE before the product appears on the
  -- public marketplace. Prevents unapproved / low-quality listings.
  is_approved       BOOLEAN        DEFAULT FALSE,

  -- Soft-delete / vendor pause. Vendor can set to FALSE to temporarily hide
  -- a product without deleting it. Admin can also override.
  is_active         BOOLEAN        DEFAULT TRUE,

  -- -----------------------------------------------------------------------
  -- Indian tax fields
  -- -----------------------------------------------------------------------

  -- HSN (Harmonised System of Nomenclature) code — required for GST invoicing
  -- in India. E.g. "3401" for soaps, "4818" for tissue paper.
  hsn_code          TEXT,

  -- GST rate applicable to this product.
  -- Constrained to the 5 valid Indian GST slabs: 0, 5, 12, 18, 28%.
  -- Default 18% covers most B2B cleaning/office supply categories.
  gst_rate          DECIMAL(4,2)   DEFAULT 18.00
                    CHECK (gst_rate IN (0, 5, 12, 18, 28)),

  -- -----------------------------------------------------------------------
  -- Additional metadata
  -- -----------------------------------------------------------------------

  -- Free-form key-value pairs for product specs not covered by other columns.
  -- E.g. {"color": "blue", "material": "microfibre", "ply": "2"}
  specifications    JSONB          DEFAULT '{}'::jsonb,

  -- Search and filter tags (e.g. ["eco-friendly", "antibacterial", "bulk"]).
  tags              TEXT[]         DEFAULT '{}',

  -- -----------------------------------------------------------------------
  -- Aggregate metrics (updated by application logic, not DB triggers)
  -- -----------------------------------------------------------------------

  -- Total number of times this product has appeared in a completed order.
  -- Used for "Best Sellers" sorting. Updated by the order processing API.
  total_orders      INTEGER        DEFAULT 0,

  -- Average buyer rating (0.0 – 5.0). Stored here for fast sorting/filtering.
  -- Updated by the reviews API whenever a new review is submitted.
  avg_rating        DECIMAL(2,1)   DEFAULT 0
                    CHECK (avg_rating >= 0 AND avg_rating <= 5),

  -- -----------------------------------------------------------------------
  -- Timestamps
  -- -----------------------------------------------------------------------
  created_at        TIMESTAMPTZ    DEFAULT NOW(),
  updated_at        TIMESTAMPTZ    DEFAULT NOW()
);


-- =============================================================================
-- SECTION 3: TABLE & COLUMN COMMENTS
-- =============================================================================

COMMENT ON TABLE products IS
  'All vendor product listings for the Primeserve marketplace. '
  'A product is only visible to the public when is_approved = TRUE AND is_active = TRUE. '
  'Sourced from a 394-product Excel catalog (Housekeeping + Stationery sheets).';

COMMENT ON COLUMN products.vendor_id IS
  'FK to users(id) — the vendor who owns this listing. Cascades on user delete.';
COMMENT ON COLUMN products.slug IS
  'URL-safe unique identifier for the product detail page route. '
  'Auto-generated from the product name by the set_product_slug trigger. '
  'Example: "jk-copier-paper-a4-80gsm"';
COMMENT ON COLUMN products.category IS
  'Top-level category (product_category enum). One of the 6 Primeserve categories.';
COMMENT ON COLUMN products.subcategory_id IS
  'FK to subcategories(id). SET NULL on subcategory deletion. '
  'Use for JOINs when full subcategory metadata is needed.';
COMMENT ON COLUMN products.subcategory_slug IS
  'Denormalized copy of subcategories.slug for fast WHERE/ORDER BY filtering '
  'without a JOIN. Must be kept in sync with subcategory_id by the app layer.';
COMMENT ON COLUMN products.brand IS
  'Manufacturer or brand name parsed from the Excel "size/brand" column. '
  'Examples: "JK", "Scotch-Brite", "3M", "Pidilite", "Hindustan Unilever".';
COMMENT ON COLUMN products.size_variant IS
  'Physical size, weight, or variant string parsed from the Excel "size/brand" column. '
  'Examples: "5Ltr", "500ml", "A4 80GSM", "18x24 inch", "900ml".';
COMMENT ON COLUMN products.base_price IS
  'Single-unit price in INR. Override by pricing_tiers for bulk quantities. '
  'Display via formatINR() — never render the raw decimal directly.';
COMMENT ON COLUMN products.moq IS
  'Minimum Order Quantity. Buyers cannot add fewer than this many units to a cart.';
COMMENT ON COLUMN products.pricing_tiers IS
  'JSONB array of volume price breaks. Each element: '
  '{"min_qty": int, "max_qty": int|null, "price": decimal}. '
  'Empty array means flat base_price for all quantities.';
COMMENT ON COLUMN products.images IS
  'Array of full-resolution image URLs stored in Supabase Storage. '
  'Populated from the "Image Urls" column in the Housekeeping Excel sheet.';
COMMENT ON COLUMN products.thumbnail_url IS
  'Optimised thumbnail URL used in product cards and search results. '
  'Usually the first element of images[], stored separately for fast access.';
COMMENT ON COLUMN products.is_approved IS
  'Admin-controlled flag. Product is invisible to the public until TRUE. '
  'Set by admin after reviewing the vendor listing for quality and compliance.';
COMMENT ON COLUMN products.hsn_code IS
  'Harmonised System of Nomenclature code for GST invoicing in India. '
  'Required for generating GST-compliant invoices.';
COMMENT ON COLUMN products.gst_rate IS
  'Indian GST rate applicable to this product (0, 5, 12, 18, or 28%). '
  'Default 18% covers most cleaning supplies and office stationery.';
COMMENT ON COLUMN products.specifications IS
  'Free-form JSONB key-value pairs for product attributes not in other columns. '
  'E.g. {"color": "blue", "material": "microfibre", "ply": "2-ply"}.';
COMMENT ON COLUMN products.total_orders IS
  'Count of completed orders containing this product. Updated by the orders API. '
  'Used for Best Sellers sorting on the marketplace.';
COMMENT ON COLUMN products.avg_rating IS
  'Average buyer rating (0.0–5.0). Updated by the reviews API. '
  'Cached here for fast sort/filter — source of truth is the reviews table.';


-- =============================================================================
-- SECTION 4: TRIGGERS
-- =============================================================================

-- Trigger 1: Auto-generate slug on INSERT if not provided
CREATE TRIGGER set_product_slug
  BEFORE INSERT ON products
  FOR EACH ROW
  EXECUTE FUNCTION generate_product_slug();

-- Trigger 2: Keep updated_at current on every row change
CREATE TRIGGER set_products_updated_at
  BEFORE UPDATE ON products
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();


-- =============================================================================
-- SECTION 5: INDEXES
-- Ordered from most selective / highest traffic to supporting indexes.
-- =============================================================================

-- Direct lookups by primary key (handled automatically) and slug (product pages)
CREATE INDEX idx_products_slug
  ON products(slug);

-- All products by a specific vendor — used on vendor dashboard
CREATE INDEX idx_products_vendor_id
  ON products(vendor_id);

-- Category-level browsing — the primary marketplace filter
CREATE INDEX idx_products_category
  ON products(category);

-- Subcategory drill-down — second-level marketplace filter (no JOIN needed)
CREATE INDEX idx_products_subcategory_slug
  ON products(subcategory_slug);

-- Composite: category + subcategory — covers the most common filtered browse
-- query: WHERE category = $1 AND subcategory_slug = $2
CREATE INDEX idx_products_category_subcategory
  ON products(category, subcategory_slug);

-- Approval and visibility filters — used in every public marketplace query
CREATE INDEX idx_products_is_approved
  ON products(is_approved);

CREATE INDEX idx_products_is_active
  ON products(is_active);

-- Stock status filter — "In Stock Only" toggle on the marketplace
CREATE INDEX idx_products_stock_status
  ON products(stock_status);

-- Brand filter — "Filter by Brand" on the marketplace sidebar
CREATE INDEX idx_products_brand
  ON products(brand);

-- Default sort order on the marketplace (newest first)
CREATE INDEX idx_products_created_at
  ON products(created_at DESC);


-- =============================================================================
-- SECTION 6: ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE products ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Policy 1: Public can browse the marketplace without logging in.
-- What it does: Allows any visitor (including unauthenticated) to SELECT rows
--               where is_approved = TRUE AND is_active = TRUE.
-- Why we need it: The marketplace must be publicly accessible — buyers and
--                 potential buyers browse products before creating an account.
--               Using (select ...) wrapping around auth.uid() is a Supabase
--               best practice: it evaluates the function once per query rather
--               than once per row, improving performance on large result sets.
-- ---------------------------------------------------------------------------
CREATE POLICY "Public can view approved active products"
  ON products
  FOR SELECT
  USING (is_approved = TRUE AND is_active = TRUE);

-- ---------------------------------------------------------------------------
-- Policy 2: Vendors can see all their own products, including unapproved ones.
-- What it does: Allows a logged-in vendor to SELECT any row where vendor_id
--               matches their Supabase Auth UUID.
-- Why we need it: Vendors need to manage their full product catalog — including
--                 drafts and pending-approval listings — from their dashboard.
-- ---------------------------------------------------------------------------
CREATE POLICY "Vendors can view own products"
  ON products
  FOR SELECT
  USING ((select auth.uid()) = vendor_id);

-- ---------------------------------------------------------------------------
-- Policy 3: Vendors can create new product listings.
-- What it does: Allows INSERT when the new row's vendor_id equals the caller's
--               auth UUID. Prevents a vendor from creating listings under
--               another vendor's account.
-- Why we need it: Vendors add products from the vendor dashboard.
-- ---------------------------------------------------------------------------
CREATE POLICY "Vendors can insert own products"
  ON products
  FOR INSERT
  WITH CHECK ((select auth.uid()) = vendor_id);

-- ---------------------------------------------------------------------------
-- Policy 4: Vendors can update their own product listings.
-- What it does: Allows UPDATE on rows where vendor_id = auth.uid().
-- Why we need it: Vendors must be able to edit price, description, stock, etc.
--               Note: vendors cannot flip is_approved themselves — that column
--               is admin-controlled and any attempt is rejected at the API layer.
-- ---------------------------------------------------------------------------
CREATE POLICY "Vendors can update own products"
  ON products
  FOR UPDATE
  USING     ((select auth.uid()) = vendor_id)
  WITH CHECK ((select auth.uid()) = vendor_id);

-- ---------------------------------------------------------------------------
-- Policy 5: Admins have unrestricted access to all products.
-- What it does: Allows ALL operations (SELECT, INSERT, UPDATE, DELETE) for any
--               user whose row in the users table has role = 'admin'.
-- Why we need it: Admins must approve, reject, edit, and remove any product
--               regardless of which vendor owns it.
-- ---------------------------------------------------------------------------
CREATE POLICY "Admins have full access to products"
  ON products
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = (select auth.uid())
        AND role = 'admin'
    )
  );
