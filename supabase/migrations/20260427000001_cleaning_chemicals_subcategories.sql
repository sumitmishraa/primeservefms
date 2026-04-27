-- =============================================================================
-- Migration: 20260427000001_cleaning_chemicals_subcategories.sql
-- Description: Expands the cleaning_chemicals subcategory list to match the
--              Diversey / TASKI 2025 price list "GROUP" column. The new groups
--              cover laundry, kitchen / warewashing, housekeeping cleaners,
--              floor care, washroom & odour control, personal care,
--              pest control, dispensers & accessories, and dishwashing
--              machines / equipment.
--
-- Why: The original 3 cleaning-chemical subcategories (bulk_cleaning_chemicals,
--      branded_cleaning_liquids, soaps_and_detergent_powders) are too coarse
--      for the imported Diversey catalog. Buyers filtering the marketplace
--      for "Floor care" or "Pest control" need first-class subcategories.
--
-- This migration is additive — existing rows under the old slugs remain valid.
--
-- Project: Primeserve Facility Solutions
-- Depends on: 20260322000001_core_enums_and_users.sql
-- =============================================================================

INSERT INTO subcategories (category, name, slug, display_name, sort_order)
VALUES
  ('cleaning_chemicals', 'laundry_chemicals',                     'laundry_chemicals',                     'Laundry Chemicals',                     10),
  ('cleaning_chemicals', 'kitchen_hygiene_and_warewashing',       'kitchen_hygiene_and_warewashing',       'Kitchen Hygiene & Warewashing',         11),
  ('cleaning_chemicals', 'housekeeping_and_general_cleaners',     'housekeeping_and_general_cleaners',     'Housekeeping & General Cleaners',       12),
  ('cleaning_chemicals', 'floor_care_and_polish',                 'floor_care_and_polish',                 'Floor Care & Polish',                   13),
  ('cleaning_chemicals', 'washroom_and_odour_control',            'washroom_and_odour_control',            'Washroom & Odour Control',              14),
  ('cleaning_chemicals', 'personal_care_and_hand_hygiene',        'personal_care_and_hand_hygiene',        'Personal Care & Hand Hygiene',          15),
  ('cleaning_chemicals', 'pest_control_and_fly_management',       'pest_control_and_fly_management',       'Pest Control & Fly Management',         16),
  ('cleaning_chemicals', 'dispensers_and_hygiene_accessories',    'dispensers_and_hygiene_accessories',    'Dispensers & Hygiene Accessories',      17),
  ('cleaning_chemicals', 'dishwashing_machines_and_equipment',    'dishwashing_machines_and_equipment',    'Dishwashing Machines & Equipment',      18)
ON CONFLICT (category, slug) DO NOTHING;
