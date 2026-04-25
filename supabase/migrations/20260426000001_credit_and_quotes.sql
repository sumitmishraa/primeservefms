-- =============================================================================
-- Migration: 20260426000001_credit_and_quotes.sql
-- Description: credit_accounts (buyer credit limits) and quote_requests
--              (monthly requirement upload / quote request flow).
-- Project: Primeserve Facility Solutions
-- Created: 2026-04-26
-- =============================================================================


-- =============================================================================
-- SECTION 1: CREDIT ACCOUNTS
-- One row per buyer. Tracks the credit limit an admin grants them and how
-- much of it has been used (via deferred payment orders). Starts as 'pending'
-- until an admin activates and sets a limit.
-- =============================================================================

CREATE TABLE credit_accounts (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id      UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  credit_limit  DECIMAL(12,2) NOT NULL DEFAULT 0,
  used_amount   DECIMAL(12,2) NOT NULL DEFAULT 0,
  status        TEXT          NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'active', 'suspended')),
  notes         TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  UNIQUE (buyer_id)
);

COMMENT ON TABLE credit_accounts IS
  'One row per buyer. Tracks admin-assigned credit limit and current usage. '
  'Status: pending = not yet activated, active = credit available, suspended = frozen.';

CREATE TRIGGER set_credit_accounts_updated_at
  BEFORE UPDATE ON credit_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_credit_accounts_buyer_id ON credit_accounts(buyer_id);

ALTER TABLE credit_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers read own credit"
  ON credit_accounts FOR SELECT
  USING (buyer_id = auth.uid());

CREATE POLICY "Admins manage all credit"
  ON credit_accounts FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );


-- =============================================================================
-- SECTION 2: QUOTE REQUESTS
-- Buyers submit a list of products they need monthly (or on another cadence).
-- Admin reviews and responds with a quoted price. Items are stored as JSONB
-- so the schema stays flexible without extra tables.
-- =============================================================================

CREATE TABLE quote_requests (
  id             UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  buyer_id       UUID          NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title          TEXT          NOT NULL,
  status         TEXT          NOT NULL DEFAULT 'submitted'
                               CHECK (status IN (
                                 'submitted', 'under_review', 'quoted', 'accepted', 'rejected'
                               )),
  -- Array of { product_name, quantity, unit, frequency, notes }
  items          JSONB         NOT NULL DEFAULT '[]',
  notes          TEXT,
  document_url   TEXT,
  admin_notes    TEXT,
  quoted_amount  DECIMAL(12,2),
  valid_until    DATE,
  created_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE quote_requests IS
  'Monthly requirement uploads submitted by buyers. '
  'items JSONB: [{product_name, quantity, unit, frequency, notes}]. '
  'Admin reviews and sets quoted_amount + valid_until.';

CREATE TRIGGER set_quote_requests_updated_at
  BEFORE UPDATE ON quote_requests
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_quote_requests_buyer_id ON quote_requests(buyer_id);
CREATE INDEX idx_quote_requests_status   ON quote_requests(status);

ALTER TABLE quote_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Buyers read own quotes"
  ON quote_requests FOR SELECT
  USING (buyer_id = auth.uid());

CREATE POLICY "Buyers create own quotes"
  ON quote_requests FOR INSERT
  WITH CHECK (buyer_id = auth.uid());

CREATE POLICY "Admins manage all quotes"
  ON quote_requests FOR ALL
  USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin')
  );
