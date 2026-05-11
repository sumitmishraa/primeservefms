/**
 * Primeserve product category and subcategory constants.
 *
 * Derived from the live approved product catalog across 6 categories.
 *
 * These values must stay in sync with:
 *   - The `product_category` enum (Migration 1)
 *   - The `subcategories` table (seeded in Migration 1 with 44 rows)
 */

import type { ProductCategory, OrderStatus } from '@/types/index';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface OrderStatusMeta {
  /** Value stored in the DB — matches order_status enum */
  value: OrderStatus;
  /** Human-readable label for UI display */
  label: string;
  /** Tailwind colour token (without prefix) — e.g. 'yellow' → use text-yellow-600 */
  color: string;
  /** Plain-English description of what this status means */
  description: string;
}

export interface ProductCategoryMeta {
  /** Value stored in the DB — matches product_category enum */
  value: ProductCategory;
  /** Human-readable label for UI display */
  label: string;
  /** Short description for category cards and filter panels */
  description: string;
  /** lucide-react icon component name (PascalCase) */
  icon: string;
  /** Approximate number of active marketplace products in this category */
  productCount: number;
}

export interface SubcategoryMeta {
  /** Slug stored in subcategories.slug and products.subcategory_slug */
  value: string;
  /** Human-readable label matching subcategories.display_name */
  label: string;
  /** URL-safe slug — same as value */
  slug: string;
}

export interface MarketplaceSubcategoryFilterMeta extends SubcategoryMeta {
  /** One or more database subcategory slugs included in this buyer-facing filter. */
  slugs: string[];
}

export interface MarketplaceBrandMeta {
  value: string;
  label: string;
}

// ---------------------------------------------------------------------------
// 6 top-level product categories
// ---------------------------------------------------------------------------

/**
 * All 6 Primeserve product categories.
 * 'printing_solution' is a roadmap placeholder (0 products currently).
 * productCount is approximate — from the active marketplace catalog.
 */
export const PRODUCT_CATEGORIES: ProductCategoryMeta[] = [
  {
    value: 'housekeeping_materials',
    label: 'Housekeeping Materials',
    description: 'Cleaning cloths, mops, brushes, garbage bags, dispensers, and all housekeeping tools',
    icon: 'Sparkles',
    productCount: 151,
  },
  {
    value: 'cleaning_chemicals',
    label: 'Cleaning Chemicals',
    description: 'Laundry, kitchen, floor, washroom, hand-care and pest-control chemicals — including the full Diversey / TASKI catalog',
    icon: 'FlaskConical',
    productCount: 55,
  },
  {
    value: 'office_stationeries',
    label: 'Office Stationeries',
    description: 'Pens, files, staplers, tapes, notebooks, envelopes, and desk accessories',
    icon: 'PenTool',
    productCount: 155,
  },
  {
    value: 'pantry_items',
    label: 'Pantry Items',
    description: 'Disposable cups, plates, and pantry consumables',
    icon: 'Coffee',
    productCount: 0,
  },
  {
    value: 'facility_and_tools',
    label: 'Facility & Tools',
    description: 'Safety equipment, plumbing tools, and facility maintenance gear',
    icon: 'Wrench',
    productCount: 19,
  },
  {
    value: 'printing_solution',
    label: 'Printing Solution',
    description: 'Printer cartridges, toners, and printing supplies',
    icon: 'Printer',
    productCount: 0,
  },
];

// ---------------------------------------------------------------------------
// 44 subcategories keyed by parent category
// Matches the exact rows seeded in supabase/migrations/20260322000001_core_enums_and_users.sql
// ---------------------------------------------------------------------------

/**
 * All subcategories grouped by their parent product_category value.
 * Total: 44 rows — must match the subcategories table exactly.
 *   housekeeping_materials → 21
 *   cleaning_chemicals     →  3
 *   pantry_items           →  1
 *   office_stationeries    → 17
 *   facility_and_tools     →  2
 *   printing_solution      →  0  (rows added when products are onboarded)
 */
export const SUBCATEGORIES: Record<ProductCategory, SubcategoryMeta[]> = {

  housekeeping_materials: [
    { value: 'air_and_room_fresheners',      label: 'Air & Room Fresheners',        slug: 'air_and_room_fresheners' },
    { value: 'brooms_and_cleaning_cloths',   label: 'Brooms & Cleaning Cloths',     slug: 'brooms_and_cleaning_cloths' },
    { value: 'brushes_and_scrubbing_tools',  label: 'Brushes & Scrubbing Tools',    slug: 'brushes_and_scrubbing_tools' },
    { value: 'dispensers_and_hand_dryers',   label: 'Dispensers & Hand Dryers',     slug: 'dispensers_and_hand_dryers' },
    { value: 'dusting_tools',                label: 'Dusting Tools',                slug: 'dusting_tools' },
    { value: 'floor_cleaning_tools',         label: 'Floor Cleaning Tools',         slug: 'floor_cleaning_tools' },
    { value: 'garbage_bags_black',           label: 'Garbage Bags - Black',         slug: 'garbage_bags_black' },
    { value: 'garbage_bags_colour_coded',    label: 'Garbage Bags - Colour Coded',  slug: 'garbage_bags_colour_coded' },
    { value: 'glass_cleaning_tools',         label: 'Glass Cleaning Tools',         slug: 'glass_cleaning_tools' },
    { value: 'gloves_and_hand_protection',   label: 'Gloves & Hand Protection',     slug: 'gloves_and_hand_protection' },
    { value: 'mops_and_mop_refills',         label: 'Mops & Mop Refills',           slug: 'mops_and_mop_refills' },
    { value: 'paper_and_tissue_products',    label: 'Paper & Tissue Products',      slug: 'paper_and_tissue_products' },
    { value: 'pest_control',                 label: 'Pest Control',                 slug: 'pest_control' },
    { value: 'plastic_ware_and_bins',        label: 'Plastic Ware & Bins',          slug: 'plastic_ware_and_bins' },
    { value: 'scrubbers_and_sponges',        label: 'Scrubbers & Sponges',          slug: 'scrubbers_and_sponges' },
    { value: 'signage_and_safety_boards',    label: 'Signage & Safety Boards',      slug: 'signage_and_safety_boards' },
    { value: 'spray_bottles_and_dispensers', label: 'Spray Bottles & Dispensers',   slug: 'spray_bottles_and_dispensers' },
    { value: 'toilet_cleaning_tools',        label: 'Toilet Cleaning Tools',        slug: 'toilet_cleaning_tools' },
    { value: 'toilet_fresheners',            label: 'Toilet Fresheners',            slug: 'toilet_fresheners' },
    { value: 'urinal_care',                  label: 'Urinal Care',                  slug: 'urinal_care' },
    { value: 'wipers_and_dusters',           label: 'Wipers & Dusters',             slug: 'wipers_and_dusters' },
  ],

  cleaning_chemicals: [
    // Diversey / TASKI catalog groups — match the "GROUP" column in the 2025
    // price list. Order roughly mirrors a buyer's mental model
    // (laundry → kitchen → housekeeping → floor → washroom → personal → pest).
    { value: 'laundry_chemicals',                  label: 'Laundry Chemicals',                  slug: 'laundry_chemicals' },
    { value: 'kitchen_hygiene_and_warewashing',    label: 'Kitchen Hygiene & Warewashing',      slug: 'kitchen_hygiene_and_warewashing' },
    { value: 'housekeeping_and_general_cleaners',  label: 'Housekeeping & General Cleaners',    slug: 'housekeeping_and_general_cleaners' },
    { value: 'floor_care_and_polish',              label: 'Floor Care & Polish',                slug: 'floor_care_and_polish' },
    { value: 'washroom_and_odour_control',         label: 'Washroom & Odour Control',           slug: 'washroom_and_odour_control' },
    { value: 'personal_care_and_hand_hygiene',     label: 'Personal Care & Hand Hygiene',       slug: 'personal_care_and_hand_hygiene' },
    { value: 'pest_control_and_fly_management',    label: 'Pest Control & Fly Management',      slug: 'pest_control_and_fly_management' },
    { value: 'dispensers_and_hygiene_accessories', label: 'Dispensers & Hygiene Accessories',   slug: 'dispensers_and_hygiene_accessories' },
    { value: 'dishwashing_machines_and_equipment', label: 'Dishwashing Machines & Equipment',   slug: 'dishwashing_machines_and_equipment' },
    // Legacy slugs retained for any rows imported under the old taxonomy
    { value: 'bulk_cleaning_chemicals',            label: 'Bulk Cleaning Chemicals',            slug: 'bulk_cleaning_chemicals' },
    { value: 'branded_cleaning_liquids',           label: 'Branded Cleaning Liquids',           slug: 'branded_cleaning_liquids' },
    { value: 'soaps_and_detergent_powders',        label: 'Soaps & Detergent Powders',          slug: 'soaps_and_detergent_powders' },
  ],

  pantry_items: [
    { value: 'disposable_cups_and_plates', label: 'Disposable Cups & Plates', slug: 'disposable_cups_and_plates' },
  ],

  office_stationeries: [
    { value: 'copier_and_printing_paper',        label: 'Copier & Printing Paper',        slug: 'copier_and_printing_paper' },
    { value: 'pens_pencils_and_markers',         label: 'Pens, Pencils & Markers',        slug: 'pens_pencils_and_markers' },
    { value: 'notebooks_and_writing_pads',       label: 'Notebooks & Writing Pads',       slug: 'notebooks_and_writing_pads' },
    { value: 'staplers_and_punching_machines',   label: 'Staplers & Punching Machines',   slug: 'staplers_and_punching_machines' },
    { value: 'clips_pins_and_fasteners',         label: 'Clips, Pins & Fasteners',        slug: 'clips_pins_and_fasteners' },
    { value: 'sticky_notes_and_postits',         label: 'Sticky Notes & Post-its',        slug: 'sticky_notes_and_postits' },
    { value: 'tapes_and_adhesives',              label: 'Tapes & Adhesives',              slug: 'tapes_and_adhesives' },
    { value: 'files_and_folders',                label: 'Files & Folders',                slug: 'files_and_folders' },
    { value: 'scissors_and_cutters',             label: 'Scissors & Cutters',             slug: 'scissors_and_cutters' },
    { value: 'stamps_ink_and_correction',        label: 'Stamps, Ink & Correction',       slug: 'stamps_ink_and_correction' },
    { value: 'batteries',                        label: 'Batteries',                      slug: 'batteries' },
    { value: 'carbon_and_transfer_paper',        label: 'Carbon & Transfer Paper',        slug: 'carbon_and_transfer_paper' },
    { value: 'calculators_and_desk_accessories', label: 'Calculators & Desk Accessories', slug: 'calculators_and_desk_accessories' },
    { value: 'desk_organizers_and_accessories',  label: 'Desk Organizers & Accessories',  slug: 'desk_organizers_and_accessories' },
    { value: 'rubber_bands_and_elastics',        label: 'Rubber Bands & Elastics',        slug: 'rubber_bands_and_elastics' },
    { value: 'envelopes_and_covers',             label: 'Envelopes & Covers',             slug: 'envelopes_and_covers' },
    { value: 'general_stationery',               label: 'General Stationery',             slug: 'general_stationery' },
  ],

  facility_and_tools: [
    { value: 'safety_equipment', label: 'Safety Equipment', slug: 'safety_equipment' },
    { value: 'plumbing_tools',   label: 'Plumbing Tools',   slug: 'plumbing_tools' },
  ],

  // No subcategories yet — rows will be added when printing products are onboarded
  printing_solution: [],
};

// ---------------------------------------------------------------------------
// Buyer-facing marketplace filters
// ---------------------------------------------------------------------------

/**
 * Shorter subcategory groups for marketplace browsing.
 *
 * The admin/product data still uses the exact DB slugs in SUBCATEGORIES above.
 * These grouped values are only used by buyer-facing filters and map back to
 * one or more DB slugs when /api/products applies the filter.
 */
export const MARKETPLACE_SUBCATEGORY_FILTERS: Record<ProductCategory, MarketplaceSubcategoryFilterMeta[]> = {
  housekeeping_materials: [
    {
      value: 'air_and_odour_care',
      label: 'Air & Odour Care',
      slug: 'air_and_odour_care',
      slugs: ['air_and_room_fresheners', 'toilet_fresheners', 'urinal_care'],
    },
    {
      value: 'brooms_cloths_and_dusters',
      label: 'Brooms, Cloths & Dusters',
      slug: 'brooms_cloths_and_dusters',
      slugs: ['brooms_and_cleaning_cloths', 'dusting_tools', 'wipers_and_dusters'],
    },
    {
      value: 'mops_and_floor_tools',
      label: 'Mops & Floor Tools',
      slug: 'mops_and_floor_tools',
      slugs: ['mops_and_mop_refills', 'floor_cleaning_tools'],
    },
    {
      value: 'brushes_scrubbers_and_toilet_tools',
      label: 'Brushes, Scrubbers & Toilet Tools',
      slug: 'brushes_scrubbers_and_toilet_tools',
      slugs: ['brushes_and_scrubbing_tools', 'scrubbers_and_sponges', 'toilet_cleaning_tools'],
    },
    {
      value: 'garbage_bags_bins_and_plasticware',
      label: 'Garbage Bags, Bins & Plasticware',
      slug: 'garbage_bags_bins_and_plasticware',
      slugs: ['garbage_bags_black', 'garbage_bags_colour_coded', 'plastic_ware_and_bins'],
    },
    {
      value: 'paper_tissue_and_dispensers',
      label: 'Paper, Tissue & Dispensers',
      slug: 'paper_tissue_and_dispensers',
      slugs: ['paper_and_tissue_products', 'dispensers_and_hand_dryers', 'spray_bottles_and_dispensers'],
    },
    {
      value: 'glass_tools_safety_and_pest',
      label: 'Glass Tools, Safety & Pest',
      slug: 'glass_tools_safety_and_pest',
      slugs: ['glass_cleaning_tools', 'gloves_and_hand_protection', 'signage_and_safety_boards', 'pest_control'],
    },
  ],

  cleaning_chemicals: [
    {
      value: 'laundry_and_detergents',
      label: 'Laundry & Detergents',
      slug: 'laundry_and_detergents',
      slugs: ['laundry_chemicals', 'soaps_and_detergent_powders'],
    },
    {
      value: 'kitchen_and_dishwash',
      label: 'Kitchen & Dishwash',
      slug: 'kitchen_and_dishwash',
      slugs: ['kitchen_hygiene_and_warewashing', 'dishwashing_machines_and_equipment'],
    },
    {
      value: 'floor_and_general_cleaners',
      label: 'Floor & General Cleaners',
      slug: 'floor_and_general_cleaners',
      slugs: ['housekeeping_and_general_cleaners', 'floor_care_and_polish', 'bulk_cleaning_chemicals', 'branded_cleaning_liquids'],
    },
    {
      value: 'washroom_and_odour_control',
      label: 'Washroom & Odour Control',
      slug: 'washroom_and_odour_control',
      slugs: ['washroom_and_odour_control'],
    },
    {
      value: 'hand_hygiene_and_dispensers',
      label: 'Hand Hygiene & Dispensers',
      slug: 'hand_hygiene_and_dispensers',
      slugs: ['personal_care_and_hand_hygiene', 'dispensers_and_hygiene_accessories'],
    },
    {
      value: 'pest_and_fly_management',
      label: 'Pest & Fly Management',
      slug: 'pest_and_fly_management',
      slugs: ['pest_control_and_fly_management'],
    },
  ],

  pantry_items: [
    {
      value: 'disposable_cups_plates_and_pantry_consumables',
      label: 'Cups, Plates & Pantry Consumables',
      slug: 'disposable_cups_plates_and_pantry_consumables',
      slugs: ['disposable_cups_and_plates'],
    },
  ],

  office_stationeries: [
    {
      value: 'paper_notebooks_and_pads',
      label: 'Paper, Notebooks & Pads',
      slug: 'paper_notebooks_and_pads',
      slugs: ['copier_and_printing_paper', 'carbon_and_transfer_paper', 'notebooks_and_writing_pads', 'sticky_notes_and_postits'],
    },
    {
      value: 'writing_marking_and_correction',
      label: 'Writing, Marking & Correction',
      slug: 'writing_marking_and_correction',
      slugs: ['pens_pencils_and_markers', 'stamps_ink_and_correction'],
    },
    {
      value: 'files_folders_and_envelopes',
      label: 'Files, Folders & Envelopes',
      slug: 'files_folders_and_envelopes',
      slugs: ['files_and_folders', 'envelopes_and_covers'],
    },
    {
      value: 'stapling_clips_and_fasteners',
      label: 'Stapling, Clips & Fasteners',
      slug: 'stapling_clips_and_fasteners',
      slugs: ['staplers_and_punching_machines', 'clips_pins_and_fasteners', 'rubber_bands_and_elastics'],
    },
    {
      value: 'tapes_adhesives_and_cutters',
      label: 'Tapes, Adhesives & Cutters',
      slug: 'tapes_adhesives_and_cutters',
      slugs: ['tapes_and_adhesives', 'scissors_and_cutters'],
    },
    {
      value: 'desk_accessories_and_general_stationery',
      label: 'Desk Accessories & General Stationery',
      slug: 'desk_accessories_and_general_stationery',
      slugs: ['calculators_and_desk_accessories', 'desk_organizers_and_accessories', 'batteries', 'general_stationery'],
    },
  ],

  facility_and_tools: [
    {
      value: 'safety_and_facility_tools',
      label: 'Safety & Facility Tools',
      slug: 'safety_and_facility_tools',
      slugs: ['safety_equipment', 'plumbing_tools'],
    },
  ],

  printing_solution: [],
};

export const MARKETPLACE_BRANDS: Record<ProductCategory, MarketplaceBrandMeta[]> = {
  housekeeping_materials: [
    { value: 'Gala', label: 'Gala' },
    { value: 'Scotch', label: 'Scotch-Brite' },
    { value: 'Harpic', label: 'Harpic' },
    { value: 'Hit', label: 'Hit' },
    { value: 'Rin', label: 'Rin' },
  ],
  cleaning_chemicals: [
    { value: 'Vim', label: 'Vim' },
    { value: 'Dettol', label: 'Dettol' },
    { value: 'Surf Excel', label: 'Surf Excel' },
    { value: 'Rin', label: 'Rin' },
    { value: 'Colin', label: 'Colin' },
    { value: 'Domex', label: 'Domex' },
    { value: 'Lizol', label: 'Lizol' },
    { value: 'Harpic', label: 'Harpic' },
    { value: 'Life Boy', label: 'Lifebuoy' },
    { value: 'Good Night', label: 'Good Night' },
  ],
  office_stationeries: [
    { value: 'JK', label: 'JK Paper' },
    { value: 'SPS', label: 'SPS' },
    { value: 'Maya', label: 'Maya' },
    { value: 'Camlin', label: 'Camlin' },
    { value: 'Omega', label: 'Omega' },
    { value: 'Cello', label: 'Cello' },
    { value: 'Kangaroo', label: 'Kangaroo' },
    { value: 'Apsara', label: 'Apsara' },
    { value: 'Nataraj', label: 'Nataraj' },
    { value: 'Eveready', label: 'Eveready' },
    { value: 'Kores', label: 'Kores' },
    { value: 'Reynolds', label: 'Reynolds' },
  ],
  pantry_items: [
    { value: 'Chuk', label: 'Chuk' },
    { value: 'Ecoware', label: 'Ecoware' },
    { value: 'Huhtamaki', label: 'Huhtamaki' },
    { value: 'Nescafe', label: 'Nescafe' },
    { value: 'Tetley', label: 'Tetley' },
    { value: 'Paper Boat', label: 'Paper Boat' },
  ],
  facility_and_tools: [
    { value: '3M', label: '3M' },
    { value: 'Karam', label: 'Karam' },
    { value: 'Venus', label: 'Venus' },
    { value: 'Stanley', label: 'Stanley' },
    { value: 'Taparia', label: 'Taparia' },
    { value: 'Bosch', label: 'Bosch' },
  ],
  printing_solution: [
    { value: 'HP', label: 'HP' },
    { value: 'Canon', label: 'Canon' },
    { value: 'Epson', label: 'Epson' },
    { value: 'Brother', label: 'Brother' },
    { value: 'Xerox', label: 'Xerox' },
  ],
};

// ---------------------------------------------------------------------------
// Order status metadata — admin-centric flow (Migration 4)
// ---------------------------------------------------------------------------

/**
 * All active order statuses with display metadata.
 * Legacy DB values (confirmed, processing, shipped) are excluded — they will
 * never appear in new orders but may exist in historical data.
 */
export const ORDER_STATUSES: OrderStatusMeta[] = [
  {
    value: 'pending',
    label: 'Pending',
    color: 'yellow',
    description: 'Buyer placed order, awaiting admin review',
  },
  {
    value: 'approved',
    label: 'Approved',
    color: 'blue',
    description: 'Admin reviewed and accepted the order',
  },
  {
    value: 'forwarded_to_vendor',
    label: 'Forwarded to Vendor',
    color: 'purple',
    description: 'Admin sent the order to a vendor for fulfilment',
  },
  {
    value: 'dispatched',
    label: 'Dispatched',
    color: 'orange',
    description: 'Vendor has shipped the products',
  },
  {
    value: 'delivered',
    label: 'Delivered',
    color: 'green',
    description: 'Buyer confirmed receipt of products',
  },
  {
    value: 'cancelled',
    label: 'Cancelled',
    color: 'red',
    description: 'Order was cancelled at any stage',
  },
];

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Diversey / TASKI workbook GROUP -> cleaning_chemicals subcategory_slug
// ---------------------------------------------------------------------------

/**
 * Maps the raw GROUP value from the Diversey / TASKI 2025 price list to a
 * cleaning_chemicals subcategory_slug. Used by the admin Excel importer.
 *
 * Keys are normalised to lowercase before lookup. Unrecognised groups fall
 * back to 'housekeeping_and_general_cleaners' so no row is dropped.
 */
export const TASKI_GROUP_TO_SUBCATEGORY: Record<string, string> = {
  'laundry':   'laundry_chemicals',
  'kitchen':   'kitchen_hygiene_and_warewashing',
  'mww':       'kitchen_hygiene_and_warewashing',
  'mww conc':  'kitchen_hygiene_and_warewashing',
  'hsk':       'housekeeping_and_general_cleaners',
  'bc':        'housekeeping_and_general_cleaners',
  'fc':        'floor_care_and_polish',
  'oc':        'washroom_and_odour_control',
  'pc':        'personal_care_and_hand_hygiene',
  'ipm':       'pest_control_and_fly_management',
  'others':    'dispensers_and_hygiene_accessories',
  'dwp':       'dishwashing_machines_and_equipment',
};

/**
 * Default subcategory_slug used when an imported row has an empty or
 * unrecognised GROUP value.
 */
export const TASKI_DEFAULT_SUBCATEGORY = 'housekeeping_and_general_cleaners';

/**
 * Returns the subcategories for a given product category value.
 * Returns an empty array if the category has no subcategories yet
 * (e.g. 'printing_solution').
 *
 * @param category - A product_category enum value
 * @returns Array of SubcategoryMeta for that category
 *
 * @example
 *   getSubcategoriesByCategory('cleaning_chemicals')
 *   // → [{ value: 'bulk_cleaning_chemicals', ... }, ...]
 */
export function getSubcategoriesByCategory(category: string): SubcategoryMeta[] {
  return SUBCATEGORIES[category as ProductCategory] ?? [];
}

export function getMarketplaceSubcategoriesByCategory(category: string): MarketplaceSubcategoryFilterMeta[] {
  return MARKETPLACE_SUBCATEGORY_FILTERS[category as ProductCategory] ?? [];
}

export function getSubcategoryFilterSlugs(category: string, filterValue: string): string[] {
  if (!filterValue) return [];

  const groupedFilters = category
    ? getMarketplaceSubcategoriesByCategory(category)
    : PRODUCT_CATEGORIES.flatMap((cat) => MARKETPLACE_SUBCATEGORY_FILTERS[cat.value]);

  const grouped = groupedFilters
    .find((s) => s.slug === filterValue || s.value === filterValue);
  if (grouped) return grouped.slugs;

  const exactSubcategories = category
    ? getSubcategoriesByCategory(category)
    : PRODUCT_CATEGORIES.flatMap((cat) => SUBCATEGORIES[cat.value]);

  const exact = exactSubcategories
    .find((s) => s.slug === filterValue || s.value === filterValue);
  return exact ? [exact.slug] : [filterValue];
}

export function getMarketplaceBrandsByCategory(category: string): MarketplaceBrandMeta[] {
  if (category) return MARKETPLACE_BRANDS[category as ProductCategory] ?? [];

  const seen = new Set<string>();
  return PRODUCT_CATEGORIES.flatMap((cat) => MARKETPLACE_BRANDS[cat.value])
    .filter((brand) => {
      const key = brand.value.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export function getMarketplaceBrandLabel(value: string): string {
  const normalized = value.toLowerCase();
  const brand = PRODUCT_CATEGORIES
    .flatMap((cat) => MARKETPLACE_BRANDS[cat.value])
    .find((option) => option.value.toLowerCase() === normalized);

  return brand?.label ?? value;
}

/**
 * Returns the human-readable label for a product category value.
 * Returns the raw value unchanged if the category is not recognised.
 *
 * @param value - A product_category enum value
 * @returns Display label string
 *
 * @example
 *   getCategoryLabel('housekeeping_materials') // → 'Housekeeping Materials'
 */
export function getCategoryLabel(value: string): string {
  return (
    PRODUCT_CATEGORIES.find((c) => c.value === value)?.label ?? value
  );
}

/**
 * Returns the human-readable label for a subcategory slug within a given category.
 * Returns the raw slug unchanged if not found.
 *
 * @param categoryValue - A product_category enum value
 * @param subcategorySlug - The subcategory slug (e.g. 'garbage_bags_black')
 * @returns Display label string
 *
 * @example
 *   getSubcategoryLabel('housekeeping_materials', 'garbage_bags_black')
 *   // → 'Garbage Bags - Black'
 */
export function getSubcategoryLabel(
  categoryValue: string,
  subcategorySlug: string
): string {
  const grouped = categoryValue
    ? getMarketplaceSubcategoriesByCategory(categoryValue)
    : PRODUCT_CATEGORIES.flatMap((cat) => MARKETPLACE_SUBCATEGORY_FILTERS[cat.value]);
  const groupedLabel = grouped.find((s) => s.slug === subcategorySlug)?.label;
  if (groupedLabel) return groupedLabel;

  const subs = categoryValue
    ? getSubcategoriesByCategory(categoryValue)
    : PRODUCT_CATEGORIES.flatMap((cat) => SUBCATEGORIES[cat.value]);
  return subs.find((s) => s.slug === subcategorySlug)?.label ?? subcategorySlug;
}
