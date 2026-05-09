-- product_aliases: maps buyer-written terms to catalog products.
-- Rows are created by: 'system' (seed), 'openai' (AI match), 'admin' (manual link).
-- OpenAI rows start with approved = false until an admin confirms them.

CREATE TABLE IF NOT EXISTS product_aliases (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  alias        TEXT        NOT NULL,
  alias_lower  TEXT        GENERATED ALWAYS AS (lower(trim(alias))) STORED,
  product_id   UUID        REFERENCES products(id) ON DELETE CASCADE,
  created_by   TEXT        NOT NULL DEFAULT 'admin',   -- 'admin' | 'openai' | 'system'
  confidence   INT,                                     -- set when created_by = 'openai'
  approved     BOOLEAN     NOT NULL DEFAULT true,       -- openai rows start false
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS product_aliases_alias_lower_idx
  ON product_aliases (alias_lower);

CREATE INDEX IF NOT EXISTS product_aliases_product_id_idx
  ON product_aliases (product_id);

ALTER TABLE product_aliases ENABLE ROW LEVEL SECURITY;

-- Service role (used by admin client) bypasses RLS automatically.
-- Authenticated buyers only read approved aliases via the API; they never
-- query this table directly, so no buyer-facing policy is needed.
CREATE POLICY "service_role_all" ON product_aliases
  FOR ALL TO service_role USING (true) WITH CHECK (true);
