-- =============================================================================
-- Migration: 20260426000004_product_variant_groups.sql
-- Description: Adds group_slug column so variant products (e.g. a cleaning
--              chemical that ships as a 1-litre bottle AND a 5-litre can) can
--              be linked together and displayed with a variant picker on the
--              product detail page.
--
-- Design:
--   Products with the same non-NULL group_slug are treated as siblings.
--   Each sibling is still its own products row with its own price, MOQ,
--   unit_of_measure, and stock status — the group only drives UI grouping.
--
-- Example:
--   INSERT INTO products(name, group_slug, size_variant, unit_of_measure, ...)
--   VALUES
--     ('Domex Disinfectant 1L', 'domex-disinfectant', '1 Ltr', 'bottle', ...),
--     ('Domex Disinfectant 5L', 'domex-disinfectant', '5 Ltr', 'can',    ...);
--
--   Both rows share group_slug = 'domex-disinfectant', so the detail page
--   visiting either slug shows the other as a selectable variant pill.
--
-- Project: Primeserve Facility Solutions
-- Depends on: 20260322000002_products_table.sql
-- =============================================================================

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS group_slug TEXT;

-- Partial index — only indexes rows that actually have a group, keeping it
-- small and fast for the most common query:
--   WHERE group_slug = $1 AND is_approved = TRUE AND is_active = TRUE
CREATE INDEX IF NOT EXISTS idx_products_group_slug
  ON products(group_slug)
  WHERE group_slug IS NOT NULL;

COMMENT ON COLUMN products.group_slug IS
  'Optional identifier that groups variant products of the same family. '
  'Products sharing the same group_slug appear together on the product detail '
  'page as selectable variant pills (size/format/colour). '
  'NULL means this product has no siblings and is displayed as standalone. '
  'Example: "domex-disinfectant" links the 1L bottle and 5L can variants.';
