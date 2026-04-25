-- =============================================================================
-- Migration: 20260426000002_add_payment_method_to_orders.sql
-- Description: Adds payment_method column to orders so the system can
--              distinguish between Razorpay instant payments and 45-day
--              credit orders without touching payment_status semantics.
-- =============================================================================

ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'razorpay'
    CHECK (payment_method IN ('razorpay', 'credit_45day'));

COMMENT ON COLUMN orders.payment_method IS
  'How the buyer intends to pay: razorpay = instant payment via Razorpay modal; '
  'credit_45day = deferred payment against the buyer''s admin-granted credit line.';
