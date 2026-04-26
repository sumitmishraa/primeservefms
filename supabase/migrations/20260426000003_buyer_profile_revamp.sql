-- =============================================================================
-- Migration: 20260426000003_buyer_profile_revamp.sql
-- Description: Extended buyer profile/company/KYC fields on the users table.
--   Personal: designation, department, alt_phone, procurement_email, invoice_email
--   Company:  legal_company_name, trade_name, cin_number, msme_number, website,
--             incorporation_year, expected_monthly_spend
--   Contacts: payment_contact_*, finance_approver_*
--   Ops:      po_required, billing_cycle_notes, branch_contact_person,
--             delivery_contact_phone, delivery_window_notes,
--             loading_unloading_notes, branch_purchase_notes
-- Project: Primeserve Facility Solutions
-- Created: 2026-04-26
-- =============================================================================

-- ─────────────────────────────────────────────────────────────────────────────
-- Personal / professional fields
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS designation          TEXT,
  ADD COLUMN IF NOT EXISTS department           TEXT,
  ADD COLUMN IF NOT EXISTS alt_phone            TEXT,
  ADD COLUMN IF NOT EXISTS procurement_email    TEXT,
  ADD COLUMN IF NOT EXISTS invoice_email        TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Company / KYC fields (buyer-side — NOT edits to shared client/branch master)
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS legal_company_name      TEXT,
  ADD COLUMN IF NOT EXISTS trade_name              TEXT,
  ADD COLUMN IF NOT EXISTS cin_number              TEXT,
  ADD COLUMN IF NOT EXISTS msme_number             TEXT,
  ADD COLUMN IF NOT EXISTS website                 TEXT,
  ADD COLUMN IF NOT EXISTS incorporation_year      INTEGER,
  ADD COLUMN IF NOT EXISTS expected_monthly_spend  TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Payment / finance contacts
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS payment_contact_name    TEXT,
  ADD COLUMN IF NOT EXISTS payment_contact_email   TEXT,
  ADD COLUMN IF NOT EXISTS payment_contact_phone   TEXT,
  ADD COLUMN IF NOT EXISTS finance_approver_name   TEXT,
  ADD COLUMN IF NOT EXISTS finance_approver_email  TEXT,
  ADD COLUMN IF NOT EXISTS finance_approver_phone  TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Purchasing / operational preferences
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS po_required             BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS billing_cycle_notes     TEXT;

-- ─────────────────────────────────────────────────────────────────────────────
-- Branch-level operational fields
-- ─────────────────────────────────────────────────────────────────────────────
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS branch_contact_person   TEXT,
  ADD COLUMN IF NOT EXISTS delivery_contact_phone  TEXT,
  ADD COLUMN IF NOT EXISTS delivery_window_notes   TEXT,
  ADD COLUMN IF NOT EXISTS loading_unloading_notes TEXT,
  ADD COLUMN IF NOT EXISTS branch_purchase_notes   TEXT;

COMMENT ON COLUMN users.legal_company_name     IS 'Full registered legal name of the company';
COMMENT ON COLUMN users.trade_name             IS 'Trade / DBA name if different from legal name';
COMMENT ON COLUMN users.cin_number             IS 'Company Identification Number / LLPIN';
COMMENT ON COLUMN users.msme_number            IS 'Udyam / MSME registration number';
COMMENT ON COLUMN users.expected_monthly_spend IS 'Self-declared spend band (text label)';
COMMENT ON COLUMN users.po_required            IS 'Whether buyer requires a PO before order fulfillment';
COMMENT ON COLUMN users.branch_purchase_notes  IS 'Special purchasing instructions for this branch';
