-- Migration 6: Contact messages + Newsletter subscribers
-- Backs the public Contact page form and PublicFooter newsletter signup.
-- Both are intentionally simple — admins can read in the admin panel later.

-- ─────────────────────────────────────────────────────────────────────────────
-- CONTACT MESSAGES
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE contact_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  message TEXT NOT NULL,
  source TEXT DEFAULT 'website',
  is_resolved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_contact_messages_created_at ON contact_messages(created_at DESC);
CREATE INDEX idx_contact_messages_is_resolved ON contact_messages(is_resolved);

ALTER TABLE contact_messages ENABLE ROW LEVEL SECURITY;

-- Admins read/write everything
CREATE POLICY "Admins full access to contact_messages" ON contact_messages
  FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

-- Anonymous users can submit a contact form (insert only).
-- The API route uses the service role key, so this policy is mostly defensive.
CREATE POLICY "Public can submit contact_messages" ON contact_messages
  FOR INSERT WITH CHECK (TRUE);

-- ─────────────────────────────────────────────────────────────────────────────
-- NEWSLETTER SUBSCRIBERS
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE newsletter_subscribers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  source TEXT DEFAULT 'footer',
  is_active BOOLEAN DEFAULT TRUE,
  subscribed_at TIMESTAMPTZ DEFAULT NOW(),
  unsubscribed_at TIMESTAMPTZ
);

CREATE INDEX idx_newsletter_subscribers_subscribed_at ON newsletter_subscribers(subscribed_at DESC);

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins full access to newsletter_subscribers" ON newsletter_subscribers
  FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role = 'admin'));

CREATE POLICY "Public can subscribe newsletter" ON newsletter_subscribers
  FOR INSERT WITH CHECK (TRUE);
