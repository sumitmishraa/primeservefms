-- =============================================================================
-- Migration: 20260322000001_core_enums_and_users.sql
-- Description: Product category enum, subcategories reference table (44 rows),
--              all other core ENUMs, updated_at trigger, users table,
--              vendor_applications table, and full RLS policies for all three tables.
-- Project: Primeserve Facility Solutions
-- Created: 2026-03-22
-- =============================================================================


-- =============================================================================
-- SECTION 1: CATEGORY & SUBCATEGORY ENUMS
-- Derived from the real product catalog (394 products across 2 Excel sheets).
-- product_category is an ENUM because the 6 top-level categories are stable.
-- Subcategories use a reference TABLE (not an enum) because we have 44 of them
-- and this list will grow as new products are onboarded.
-- =============================================================================

-- The 6 top-level product categories for Primeserve.
-- 'printing_solution' has 0 products today but is reserved for the roadmap.
CREATE TYPE product_category AS ENUM (
  'housekeeping_materials',
  'cleaning_chemicals',
  'pantry_items',
  'office_stationeries',
  'facility_and_tools',
  'printing_solution'
);

-- Reference table for subcategories. Each row belongs to one product_category.
-- Using a table (not an enum) so subcategories can be added without a DDL migration.
CREATE TABLE subcategories (
  id           UUID             PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Which top-level category this subcategory belongs to
  category     product_category NOT NULL,
  -- URL-safe slug, unique within its category (e.g. "garbage_bags_black")
  name         TEXT             NOT NULL,
  -- Same as name but kept for backwards-compatibility with any slug-based lookups
  slug         TEXT             NOT NULL,
  -- Human-readable label shown in the UI (e.g. "Garbage Bags - Black")
  display_name TEXT             NOT NULL,
  description  TEXT,
  -- lucide-react icon name for the UI (e.g. "trash-2")
  icon_name    TEXT,
  -- Controls ordering within a category's subcategory list
  sort_order   INTEGER          DEFAULT 0,
  is_active    BOOLEAN          DEFAULT TRUE,
  created_at   TIMESTAMPTZ      DEFAULT NOW(),
  -- Prevents duplicate slugs within the same category
  UNIQUE (category, slug)
);

COMMENT ON TABLE subcategories IS
  'Reference table for all product subcategories. '
  'Each row belongs to one product_category enum value. '
  'Use a table (not enum) so new subcategories can be added without DDL migrations.';

-- -----------------------------------------------------------------------
-- Seed: Housekeeping Materials — 21 subcategories
-- -----------------------------------------------------------------------
INSERT INTO subcategories (category, name, slug, display_name, sort_order) VALUES
  ('housekeeping_materials', 'air_and_room_fresheners',      'air_and_room_fresheners',      'Air & Room Fresheners',         1),
  ('housekeeping_materials', 'brooms_and_cleaning_cloths',   'brooms_and_cleaning_cloths',   'Brooms & Cleaning Cloths',      2),
  ('housekeeping_materials', 'brushes_and_scrubbing_tools',  'brushes_and_scrubbing_tools',  'Brushes & Scrubbing Tools',     3),
  ('housekeeping_materials', 'dispensers_and_hand_dryers',   'dispensers_and_hand_dryers',   'Dispensers & Hand Dryers',      4),
  ('housekeeping_materials', 'dusting_tools',                'dusting_tools',                'Dusting Tools',                 5),
  ('housekeeping_materials', 'floor_cleaning_tools',         'floor_cleaning_tools',         'Floor Cleaning Tools',          6),
  ('housekeeping_materials', 'garbage_bags_black',           'garbage_bags_black',           'Garbage Bags - Black',          7),
  ('housekeeping_materials', 'garbage_bags_colour_coded',    'garbage_bags_colour_coded',    'Garbage Bags - Colour Coded',   8),
  ('housekeeping_materials', 'glass_cleaning_tools',         'glass_cleaning_tools',         'Glass Cleaning Tools',          9),
  ('housekeeping_materials', 'gloves_and_hand_protection',   'gloves_and_hand_protection',   'Gloves & Hand Protection',     10),
  ('housekeeping_materials', 'mops_and_mop_refills',         'mops_and_mop_refills',         'Mops & Mop Refills',           11),
  ('housekeeping_materials', 'paper_and_tissue_products',    'paper_and_tissue_products',    'Paper & Tissue Products',      12),
  ('housekeeping_materials', 'pest_control',                 'pest_control',                 'Pest Control',                 13),
  ('housekeeping_materials', 'plastic_ware_and_bins',        'plastic_ware_and_bins',        'Plastic Ware & Bins',          14),
  ('housekeeping_materials', 'scrubbers_and_sponges',        'scrubbers_and_sponges',        'Scrubbers & Sponges',          15),
  ('housekeeping_materials', 'signage_and_safety_boards',    'signage_and_safety_boards',    'Signage & Safety Boards',      16),
  ('housekeeping_materials', 'spray_bottles_and_dispensers', 'spray_bottles_and_dispensers', 'Spray Bottles & Dispensers',   17),
  ('housekeeping_materials', 'toilet_cleaning_tools',        'toilet_cleaning_tools',        'Toilet Cleaning Tools',        18),
  ('housekeeping_materials', 'toilet_fresheners',            'toilet_fresheners',            'Toilet Fresheners',            19),
  ('housekeeping_materials', 'urinal_care',                  'urinal_care',                  'Urinal Care',                  20),
  ('housekeeping_materials', 'wipers_and_dusters',           'wipers_and_dusters',           'Wipers & Dusters',             21);

-- -----------------------------------------------------------------------
-- Seed: Cleaning Chemicals — 3 subcategories
-- -----------------------------------------------------------------------
INSERT INTO subcategories (category, name, slug, display_name, sort_order) VALUES
  ('cleaning_chemicals', 'bulk_cleaning_chemicals',     'bulk_cleaning_chemicals',     'Bulk Cleaning Chemicals',      1),
  ('cleaning_chemicals', 'branded_cleaning_liquids',    'branded_cleaning_liquids',    'Branded Cleaning Liquids',     2),
  ('cleaning_chemicals', 'soaps_and_detergent_powders', 'soaps_and_detergent_powders', 'Soaps & Detergent Powders',    3);

-- -----------------------------------------------------------------------
-- Seed: Pantry Items — 1 subcategory
-- -----------------------------------------------------------------------
INSERT INTO subcategories (category, name, slug, display_name, sort_order) VALUES
  ('pantry_items', 'disposable_cups_and_plates', 'disposable_cups_and_plates', 'Disposable Cups & Plates', 1);

-- -----------------------------------------------------------------------
-- Seed: Office Stationeries — 17 subcategories
-- -----------------------------------------------------------------------
INSERT INTO subcategories (category, name, slug, display_name, sort_order) VALUES
  ('office_stationeries', 'copier_and_printing_paper',         'copier_and_printing_paper',         'Copier & Printing Paper',            1),
  ('office_stationeries', 'pens_pencils_and_markers',          'pens_pencils_and_markers',          'Pens, Pencils & Markers',            2),
  ('office_stationeries', 'notebooks_and_writing_pads',        'notebooks_and_writing_pads',        'Notebooks & Writing Pads',           3),
  ('office_stationeries', 'staplers_and_punching_machines',    'staplers_and_punching_machines',    'Staplers & Punching Machines',       4),
  ('office_stationeries', 'clips_pins_and_fasteners',          'clips_pins_and_fasteners',          'Clips, Pins & Fasteners',            5),
  ('office_stationeries', 'sticky_notes_and_postits',          'sticky_notes_and_postits',          'Sticky Notes & Post-its',            6),
  ('office_stationeries', 'tapes_and_adhesives',               'tapes_and_adhesives',               'Tapes & Adhesives',                  7),
  ('office_stationeries', 'files_and_folders',                 'files_and_folders',                 'Files & Folders',                    8),
  ('office_stationeries', 'scissors_and_cutters',              'scissors_and_cutters',              'Scissors & Cutters',                 9),
  ('office_stationeries', 'stamps_ink_and_correction',         'stamps_ink_and_correction',         'Stamps, Ink & Correction',          10),
  ('office_stationeries', 'batteries',                         'batteries',                         'Batteries',                         11),
  ('office_stationeries', 'carbon_and_transfer_paper',         'carbon_and_transfer_paper',         'Carbon & Transfer Paper',           12),
  ('office_stationeries', 'calculators_and_desk_accessories',  'calculators_and_desk_accessories',  'Calculators & Desk Accessories',    13),
  ('office_stationeries', 'desk_organizers_and_accessories',   'desk_organizers_and_accessories',   'Desk Organizers & Accessories',     14),
  ('office_stationeries', 'rubber_bands_and_elastics',         'rubber_bands_and_elastics',         'Rubber Bands & Elastics',           15),
  ('office_stationeries', 'envelopes_and_covers',              'envelopes_and_covers',              'Envelopes & Covers',                16),
  ('office_stationeries', 'general_stationery',                'general_stationery',                'General Stationery',                17);

-- -----------------------------------------------------------------------
-- Seed: Facility & Tools — 2 subcategories
-- -----------------------------------------------------------------------
INSERT INTO subcategories (category, name, slug, display_name, sort_order) VALUES
  ('facility_and_tools', 'safety_equipment', 'safety_equipment', 'Safety Equipment', 1),
  ('facility_and_tools', 'plumbing_tools',   'plumbing_tools',   'Plumbing Tools',   2);

-- 'printing_solution' has no subcategories yet — rows will be added
-- when products for that category are onboarded.


-- =============================================================================
-- SECTION 2: OTHER ENUMS
-- These are shared type definitions used across products, orders, and users.
-- =============================================================================

-- Roles for all platform users
CREATE TYPE user_role AS ENUM ('admin', 'buyer', 'vendor');

-- Lifecycle states for an order from placement to fulfillment
CREATE TYPE order_status AS ENUM (
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled'
);

-- Payment states tracked alongside order status
CREATE TYPE payment_status AS ENUM ('pending', 'paid', 'failed', 'refunded');

-- Inventory availability states for a product listing
CREATE TYPE stock_status AS ENUM ('in_stock', 'out_of_stock', 'low_stock');

-- Review states for a vendor onboarding application
CREATE TYPE vendor_application_status AS ENUM ('pending', 'approved', 'rejected');

-- Standard units of measure for B2B product ordering.
-- Derived from the "units" column in the actual product catalog:
--   ream  → paper products (e.g. A4 copier paper)
--   pkt   → products sold in packets
--   can   → chemical concentrates sold in cans
--   bottle→ liquid products (cleaning liquids, etc.)
--   tube  → gel/paste products
CREATE TYPE unit_of_measure AS ENUM (
  'piece',
  'kg',
  'liter',
  'pack',
  'box',
  'carton',
  'roll',
  'pair',
  'set',
  'ream',
  'pkt',
  'can',
  'bottle',
  'tube'
);


-- =============================================================================
-- SECTION 3: UPDATED_AT TRIGGER FUNCTION
-- A single reusable function that automatically stamps updated_at = NOW()
-- whenever a row is updated. Attached to every table that has an updated_at
-- column via a per-table BEFORE UPDATE trigger (see each table below).
-- =============================================================================

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION update_updated_at_column() IS
  'Reusable trigger function: sets updated_at = NOW() on any row UPDATE. '
  'Attach to each table that has an updated_at column.';


-- =============================================================================
-- SECTION 4: USERS TABLE
-- Central identity table for all platform participants: admins, buyers, vendors.
-- The id column IS the Supabase auth user ID — we insert this row during
-- registration using the service role client, passing the UUID returned by
-- Supabase Auth. This is what allows auth.uid() to match users.id in RLS.
-- Firebase auth is mapped via firebase_uid for OTP flows.
-- =============================================================================

CREATE TABLE users (
  -- Primary identity — matches Supabase auth.users.id
  id                  UUID          PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Firebase Auth UID — maps phone/email OTP sessions to this record
  firebase_uid        TEXT          UNIQUE NOT NULL,

  -- Platform role — determines what the user can see and do
  role                user_role     NOT NULL DEFAULT 'buyer',

  -- Contact — at least one of email or phone required at the application level
  email               TEXT          UNIQUE,
  phone               TEXT          UNIQUE,
  full_name           TEXT          NOT NULL,
  avatar_url          TEXT,

  -- Business identity
  company_name        TEXT,
  -- Values: hotel | restaurant | office | hospital | agency | manufacturer | distributor | other
  company_type        TEXT,
  gst_number          TEXT,
  tax_id              TEXT,

  -- Admin-controlled verification fields (users cannot self-update via RLS)
  business_verified   BOOLEAN       DEFAULT FALSE,
  -- Array of {doc_type, url, uploaded_at} objects stored as JSONB
  business_documents  JSONB         DEFAULT '[]'::jsonb,

  -- Shipping / billing address
  address_line1       TEXT,
  address_line2       TEXT,
  city                TEXT,
  state               TEXT,
  pincode             TEXT,

  -- Soft-delete flag — admin-controlled
  is_active           BOOLEAN       DEFAULT TRUE,

  created_at          TIMESTAMPTZ   DEFAULT NOW(),
  updated_at          TIMESTAMPTZ   DEFAULT NOW()
);

COMMENT ON TABLE users IS
  'All platform users: admins, buyers, and vendors. '
  'id matches Supabase auth.users.id for RLS compatibility. '
  'firebase_uid maps Firebase OTP sessions to this record.';

COMMENT ON COLUMN users.id IS
  'UUID matching Supabase auth.users.id. Set during registration via service role.';
COMMENT ON COLUMN users.firebase_uid IS
  'Firebase Auth UID from phone/email OTP. Used to look up the user at login.';
COMMENT ON COLUMN users.role IS
  'Platform role: admin = operator, buyer = purchasing manager, vendor = supplier.';
COMMENT ON COLUMN users.business_verified IS
  'Set to TRUE only by an admin after reviewing business_documents. '
  'Cannot be changed by the user themselves (blocked at API level).';
COMMENT ON COLUMN users.business_documents IS
  'JSONB array of uploaded verification documents. '
  'Each element: {doc_type: string, url: string, uploaded_at: timestamptz}.';
COMMENT ON COLUMN users.company_type IS
  'Buyer industry: hotel | restaurant | office | hospital. '
  'Vendor type: agency | manufacturer | distributor | other.';
COMMENT ON COLUMN users.gst_number IS
  'GST registration number. Required for B2B invoicing in India.';
COMMENT ON COLUMN users.tax_id IS
  'Alternate tax identifier (PAN or TAN). Used for compliance reporting.';
COMMENT ON COLUMN users.pincode IS
  'Indian 6-digit postal code for shipping address.';

-- Auto-update updated_at on every row change
CREATE TRIGGER set_users_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Indexes for the most common lookup patterns
CREATE INDEX idx_users_firebase_uid ON users(firebase_uid);
CREATE INDEX idx_users_email        ON users(email);
CREATE INDEX idx_users_role         ON users(role);


-- =============================================================================
-- SECTION 5: VENDOR APPLICATIONS TABLE
-- When a user wants to become a vendor, they submit an application.
-- Admins review it and flip the status to 'approved' or 'rejected'.
-- On approval, the API layer also updates users.role = 'vendor'.
-- =============================================================================

CREATE TABLE vendor_applications (
  id                  UUID                      PRIMARY KEY DEFAULT gen_random_uuid(),

  -- The user who submitted the application
  user_id             UUID                      NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  company_name        TEXT                      NOT NULL,
  gst_number          TEXT,
  business_type       TEXT,

  -- Supporting documents uploaded during application
  business_documents  JSONB                     DEFAULT '[]'::jsonb,

  -- Which product categories this vendor intends to supply (PostgreSQL array)
  product_categories  product_category[],

  description         TEXT,

  -- Review workflow
  status              vendor_application_status DEFAULT 'pending',

  -- NULL until an admin reviews the application
  reviewed_by         UUID                      REFERENCES users(id) ON DELETE SET NULL,
  review_notes        TEXT,
  reviewed_at         TIMESTAMPTZ,

  created_at          TIMESTAMPTZ               DEFAULT NOW(),
  updated_at          TIMESTAMPTZ               DEFAULT NOW()
);

COMMENT ON TABLE vendor_applications IS
  'Onboarding applications submitted by users who want to become vendors. '
  'Admins approve or reject; on approval the API should also set users.role = ''vendor''.';

COMMENT ON COLUMN vendor_applications.product_categories IS
  'PostgreSQL array of product_category enum values. '
  'Indicates which categories this vendor intends to supply.';
COMMENT ON COLUMN vendor_applications.reviewed_by IS
  'FK to users.id of the admin who reviewed this application. '
  'SET NULL on admin deletion so the application record is not lost.';
COMMENT ON COLUMN vendor_applications.business_documents IS
  'JSONB array of supporting documents (GST cert, trade license, etc.). '
  'Each element: {doc_type: string, url: string, uploaded_at: timestamptz}.';
COMMENT ON COLUMN vendor_applications.review_notes IS
  'Admin''s internal notes explaining the approval decision or rejection reason.';

-- Auto-update updated_at on every row change
CREATE TRIGGER set_vendor_applications_updated_at
  BEFORE UPDATE ON vendor_applications
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Indexes for admin dashboard queries and user self-service lookups
CREATE INDEX idx_vendor_applications_user_id ON vendor_applications(user_id);
CREATE INDEX idx_vendor_applications_status  ON vendor_applications(status);


-- =============================================================================
-- SECTION 6: ROW LEVEL SECURITY
-- RLS ensures every user can only read and write rows they are allowed to.
--
-- Auth model:
--   Supabase Auth issues JWTs; auth.uid() returns the UUID that matches
--   users.id (set during registration via the service role client).
--   Firebase handles OTP delivery, but the resulting session is represented
--   as a Supabase auth user — so auth.uid() always works in policies.
-- =============================================================================

-- Enable RLS on all three tables.
-- No SELECT/INSERT/UPDATE/DELETE is allowed until at least one policy grants it.
ALTER TABLE users                ENABLE ROW LEVEL SECURITY;
ALTER TABLE vendor_applications  ENABLE ROW LEVEL SECURITY;
ALTER TABLE subcategories        ENABLE ROW LEVEL SECURITY;


-- ---------------------------------------------------------------------------
-- USERS TABLE POLICIES
-- ---------------------------------------------------------------------------

-- Policy 1: A user can read their own profile row.
-- What it does: Allows a logged-in user to SELECT their own row from the users
--               table. The condition id = auth.uid() matches the row's primary
--               key against the Supabase Auth UUID in the current JWT.
-- Why we need it: Users must be able to fetch their own data for the dashboard
--                 and profile settings page.
CREATE POLICY "Users can view own profile"
  ON users
  FOR SELECT
  USING (id = auth.uid());

-- Policy 2: A user can update their own profile (safe fields only).
-- What it does: Allows a logged-in user to UPDATE their own row. Both USING
--               and WITH CHECK enforce id = auth.uid() — the first prevents
--               touching another user's row, the second prevents changing your
--               own id to impersonate someone else.
-- Why we need it: Users should update their name, address, phone etc., but
--                 role, business_verified, and is_active are blocked at the
--                 API level (the UPDATE query only sets the allowed columns).
CREATE POLICY "Users can update own profile"
  ON users
  FOR UPDATE
  USING     (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- Policy 3: Admins can view every user row.
-- What it does: Allows any row in users to be SELECTed if the currently
--               authenticated user has role = 'admin'. The EXISTS sub-select
--               looks up the caller's own row to check their role.
-- Why we need it: Admins need the full user list for the management dashboard,
--                 vendor approval flow, and account moderation.
CREATE POLICY "Admins can view all users"
  ON users
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );

-- Policy 4: Admins can update any user row.
-- What it does: Allows admins to UPDATE any row in users.
-- Why we need it: Admins must be able to flip business_verified, toggle
--                 is_active, and change role (e.g. after approving a vendor).
CREATE POLICY "Admins can update any user"
  ON users
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );

-- Policy 5: Service role can INSERT new user rows during registration.
-- What it does: Allows INSERT with no row-level restriction (WITH CHECK (true)).
-- Why we need it: Our Next.js /api/auth/verify route uses the Supabase service
--                 role client, which bypasses RLS entirely — but defining this
--                 policy makes the intent explicit and supports anon-role inserts
--                 if the registration flow ever changes.
CREATE POLICY "Service role insert for registration"
  ON users
  FOR INSERT
  WITH CHECK (true);


-- ---------------------------------------------------------------------------
-- VENDOR APPLICATIONS TABLE POLICIES
-- ---------------------------------------------------------------------------

-- Policy 1: A user can view their own vendor applications.
-- What it does: Allows SELECT on rows where user_id matches the caller's auth UUID.
-- Why we need it: Applicants need to check their application status
--                 ("pending", "approved", "rejected") from their dashboard.
CREATE POLICY "Vendors can view own applications"
  ON vendor_applications
  FOR SELECT
  USING (user_id = auth.uid());

-- Policy 2: A logged-in user can submit a new vendor application.
-- What it does: Allows INSERT only when the new row's user_id equals the
--               caller's auth UUID — prevents impersonating another user.
-- Why we need it: Any authenticated buyer who wants to become a vendor
--                 must be able to create an application.
CREATE POLICY "Vendors can create applications"
  ON vendor_applications
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Policy 3: Admins can view all vendor applications.
-- What it does: Allows admins to SELECT all rows in vendor_applications.
-- Why we need it: Admins need to see the full pending queue to review,
--                 approve, or reject applications — this is the primary
--                 admin workflow.
CREATE POLICY "Admins can view all applications"
  ON vendor_applications
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );

-- Policy 4: Admins can update any vendor application.
-- What it does: Allows admins to UPDATE any row in vendor_applications.
-- Why we need it: The review action (approve / reject) requires updating
--                 status, reviewed_by, review_notes, and reviewed_at.
--                 Only admins perform this action.
CREATE POLICY "Admins can update applications"
  ON vendor_applications
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );


-- ---------------------------------------------------------------------------
-- SUBCATEGORIES TABLE POLICIES
-- ---------------------------------------------------------------------------

-- Policy 1: Anyone (including unauthenticated visitors) can read subcategories.
-- What it does: Allows unrestricted SELECT on all rows in subcategories.
-- Why we need it: Subcategories are public reference data — the marketplace
--                 category filter and product forms need to load them without
--                 requiring the user to be logged in.
CREATE POLICY "Anyone can read subcategories"
  ON subcategories
  FOR SELECT
  USING (true);

-- Policy 2: Admins can manage subcategories (insert, update, delete).
-- What it does: Allows admins full write access to the subcategories table.
-- Why we need it: When new product lines are onboarded (e.g. printing_solution
--                 subcategories), an admin must be able to add rows without
--                 a DDL migration.
CREATE POLICY "Admins can manage subcategories"
  ON subcategories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE id = auth.uid()
        AND role = 'admin'
    )
  );
