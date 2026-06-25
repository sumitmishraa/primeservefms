-- Credit application wizard: draft/resume + lifecycle status tracking
-- Adds draft-state, per-step resume, identity-number snapshots, PAN back side,
-- and credit-discussion (meeting) fields to credit_applications.

-- ── Lifecycle status ─────────────────────────────────────────────────────────
-- draft            → in progress, not yet submitted
-- submitted        → submitted, awaiting document verification
-- under_review     → (legacy / generic) under review
-- documents_verified → KYC documents verified, awaiting credit discussion
-- meeting_scheduled  → credit discussion (Zoom/call) scheduled
-- approved         → credit term approved (credit_accounts activated)
-- rejected         → declined
ALTER TABLE credit_applications DROP CONSTRAINT IF EXISTS credit_applications_status_check;
ALTER TABLE credit_applications
  ADD CONSTRAINT credit_applications_status_check
  CHECK (status IN (
    'draft', 'submitted', 'under_review',
    'documents_verified', 'meeting_scheduled',
    'approved', 'rejected'
  ));

-- New drafts start as 'draft'
ALTER TABLE credit_applications ALTER COLUMN status SET DEFAULT 'draft';

-- submitted_at is only set when the application is actually submitted
ALTER TABLE credit_applications ALTER COLUMN submitted_at DROP NOT NULL;
ALTER TABLE credit_applications ALTER COLUMN submitted_at DROP DEFAULT;

-- ── Resume / wizard tracking ─────────────────────────────────────────────────
ALTER TABLE credit_applications ADD COLUMN IF NOT EXISTS current_step INTEGER NOT NULL DEFAULT 1;
ALTER TABLE credit_applications ADD COLUMN IF NOT EXISTS entity_type TEXT
  CHECK (entity_type IS NULL OR entity_type IN ('company', 'llp'));

-- ── Identity-number snapshots (also synced to users profile) ──────────────────
ALTER TABLE credit_applications ADD COLUMN IF NOT EXISTS gst_number TEXT;
ALTER TABLE credit_applications ADD COLUMN IF NOT EXISTS pan_number TEXT;
ALTER TABLE credit_applications ADD COLUMN IF NOT EXISTS cin_number TEXT;

-- ── PAN back side (front reuses pan_card_url) ─────────────────────────────────
ALTER TABLE credit_applications ADD COLUMN IF NOT EXISTS pan_card_back_url TEXT;

-- ── Lifecycle timestamps + credit discussion (meeting) ────────────────────────
ALTER TABLE credit_applications ADD COLUMN IF NOT EXISTS documents_verified_at TIMESTAMPTZ;
ALTER TABLE credit_applications ADD COLUMN IF NOT EXISTS meeting_scheduled_at TIMESTAMPTZ;
ALTER TABLE credit_applications ADD COLUMN IF NOT EXISTS meeting_link TEXT;

-- ── RLS: allow buyers to update their own draft rows (defense in depth) ────────
-- API routes use the service-role client, but this keeps direct access safe too.
DROP POLICY IF EXISTS "buyer_own_applications_update" ON credit_applications;
CREATE POLICY "buyer_own_applications_update" ON credit_applications
  FOR UPDATE USING (buyer_id = auth.uid())
  WITH CHECK (buyer_id = auth.uid());

-- Helpful index for "latest application per buyer" lookups
CREATE INDEX IF NOT EXISTS idx_credit_applications_buyer_created
  ON credit_applications (buyer_id, created_at DESC);
