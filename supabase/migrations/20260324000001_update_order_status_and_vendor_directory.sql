-- =============================================================================
-- Migration 4: Update order status enum + vendor directory table
-- Date: 2026-03-24
-- Why: Business model shift — PrimeServe admin controls all order fulfilment.
--      Vendors are managed offline (WhatsApp/call). No vendor dashboard.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- CHANGE 1: Extend order_status enum with new flow values
--
-- New flow: pending → approved → forwarded_to_vendor → dispatched → delivered
--           (cancelled is possible at any stage)
--
-- Note: PostgreSQL cannot remove enum values. The old values (confirmed,
-- processing, shipped) stay in the type but will no longer be used by the app.
-- ---------------------------------------------------------------------------

ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'approved';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'forwarded_to_vendor';
ALTER TYPE order_status ADD VALUE IF NOT EXISTS 'dispatched';

-- ---------------------------------------------------------------------------
-- CHANGE 2: Add admin tracking columns to orders
--
-- These let the admin record which vendor was assigned and when each
-- status transition happened.
-- ---------------------------------------------------------------------------

ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_vendor_name TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS assigned_vendor_phone TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS admin_notes TEXT;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS forwarded_at TIMESTAMPTZ;
ALTER TABLE orders ADD COLUMN IF NOT EXISTS dispatched_at TIMESTAMPTZ;

COMMENT ON COLUMN orders.assigned_vendor_name IS 'Name of the vendor the admin forwarded this order to (offline — no FK)';
COMMENT ON COLUMN orders.assigned_vendor_phone IS 'Phone/WhatsApp of the assigned vendor for reference';
COMMENT ON COLUMN orders.admin_notes IS 'Internal notes by PrimeServe admin — not visible to buyer';
COMMENT ON COLUMN orders.forwarded_at IS 'Timestamp when admin forwarded the order to a vendor';
COMMENT ON COLUMN orders.dispatched_at IS 'Timestamp when vendor confirmed dispatch to admin';

-- ---------------------------------------------------------------------------
-- CHANGE 3: Create vendor_directory table
--
-- Internal reference only — NOT a login table.
-- Admins use this to look up vendor contacts when forwarding orders.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS vendor_directory (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  company_name    TEXT NOT NULL,
  phone           TEXT NOT NULL,
  whatsapp        TEXT,
  email           TEXT,
  address         TEXT,
  city            TEXT DEFAULT 'Bangalore',
  categories      product_category[] DEFAULT '{}',
  notes           TEXT,
  is_active       BOOLEAN DEFAULT TRUE,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

COMMENT ON TABLE vendor_directory IS 'Internal admin-only vendor contact book. Not a login/dashboard system.';
COMMENT ON COLUMN vendor_directory.categories IS 'Product categories this vendor can supply — used to match orders to vendors';
COMMENT ON COLUMN vendor_directory.notes IS 'Admin notes: lead time, minimum order, reliability, etc.';

-- Reuse the shared updated_at trigger function from Migration 1
CREATE TRIGGER update_vendor_directory_updated_at
  BEFORE UPDATE ON vendor_directory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- RLS: only admins can read or write
ALTER TABLE vendor_directory ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access to vendor directory"
  ON vendor_directory
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ---------------------------------------------------------------------------
-- CHANGE 4: Make products.vendor_id optional
--
-- Admin uploads all products now. vendor_id is kept for future use but
-- is no longer required. uploaded_by records the admin who added the product.
-- ---------------------------------------------------------------------------

ALTER TABLE products ALTER COLUMN vendor_id DROP NOT NULL;

ALTER TABLE products ADD COLUMN IF NOT EXISTS uploaded_by UUID REFERENCES users(id);

COMMENT ON COLUMN products.vendor_id IS 'Vendor who supplies this product — nullable; set when assigned to a vendor contact';
COMMENT ON COLUMN products.uploaded_by IS 'Admin user who created this product listing';
