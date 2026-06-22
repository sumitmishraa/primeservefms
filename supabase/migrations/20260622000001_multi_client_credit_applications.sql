-- Migration: Multi-client access + credit applications
-- Allows one buyer to be associated with multiple client companies,
-- and adds a self-service credit application flow.

-- ─── 1. user_clients join table ───────────────────────────────────────────────
-- One buyer user can belong to multiple client companies (e.g. a founder
-- who owns Paris Panini, Pizza Bakery, and Smash Guys as separate clients).
-- users.client_id remains as the "primary" client for backward compatibility.

CREATE TABLE IF NOT EXISTS user_clients (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  client_id  UUID        NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  role       TEXT        NOT NULL DEFAULT 'owner'
                         CHECK (role IN ('owner', 'manager', 'viewer')),
  is_primary BOOLEAN     NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, client_id)
);

ALTER TABLE user_clients ENABLE ROW LEVEL SECURITY;

-- Buyers see only their own rows
CREATE POLICY "buyer_own_clients_select" ON user_clients
  FOR SELECT USING (user_id = auth.uid());

-- Buyers may insert their own rows (needed when they add a company themselves)
CREATE POLICY "buyer_own_clients_insert" ON user_clients
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- Admins have full access
CREATE POLICY "admin_all_user_clients" ON user_clients
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- ─── Backfill: seed existing buyers into user_clients ─────────────────────────
-- Any buyer who already has users.client_id set gets a primary row automatically
INSERT INTO user_clients (user_id, client_id, role, is_primary)
SELECT id, client_id, 'owner', true
FROM   users
WHERE  client_id IS NOT NULL
  AND  role = 'buyer'
ON CONFLICT (user_id, client_id) DO NOTHING;


-- ─── 2. credit_applications table ─────────────────────────────────────────────
-- Self-service credit line applications submitted by buyers.
-- Admin reviews in the admin panel; buyer sees status updates.

CREATE TABLE IF NOT EXISTS credit_applications (
  id                     UUID           PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id               UUID           NOT NULL REFERENCES users(id)   ON DELETE CASCADE,
  client_id              UUID           REFERENCES clients(id),

  -- Lifecycle status
  status                 TEXT           NOT NULL DEFAULT 'submitted'
                                        CHECK (status IN ('submitted', 'under_review', 'approved', 'rejected')),

  -- Document storage URLs (Supabase Storage)
  gst_certificate_url    TEXT,
  pan_card_url           TEXT,
  cin_document_url       TEXT,
  cancelled_cheque_url   TEXT,
  itr_url                TEXT,
  bank_statement_url     TEXT,

  -- Applicant-provided details
  requested_credit_limit NUMERIC(12, 2),
  business_years         INTEGER,
  annual_turnover        TEXT,
  notes                  TEXT,

  -- Admin response
  admin_notes            TEXT,
  reviewed_at            TIMESTAMPTZ,
  reviewed_by            UUID           REFERENCES users(id),

  -- Timestamps
  submitted_at           TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  created_at             TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

ALTER TABLE credit_applications ENABLE ROW LEVEL SECURITY;

-- Buyers can read their own applications
CREATE POLICY "buyer_own_applications_select" ON credit_applications
  FOR SELECT USING (buyer_id = auth.uid());

-- Buyers can create applications (only for themselves)
CREATE POLICY "buyer_own_applications_insert" ON credit_applications
  FOR INSERT WITH CHECK (buyer_id = auth.uid());

-- Admins have full access (approve/reject/update)
CREATE POLICY "admin_all_credit_applications" ON credit_applications
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );

-- Auto-update updated_at on row changes
CREATE OR REPLACE FUNCTION set_credit_application_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER credit_applications_updated_at
  BEFORE UPDATE ON credit_applications
  FOR EACH ROW EXECUTE FUNCTION set_credit_application_updated_at();
