/**
 * Primeserve product category and subcategory constants.
 *
 * Derived from the real product catalog (394 products across 6 categories).
 * productCount values are from the actual Excel sheets:
 *   Housekeeping sheet  → 170 products (Housekeeping Materials + Chemicals)
 *   Stationery sheet    → 160 products
 *   Pantry              →   2 products
 *   Facility & Tools    →   6 products
 *   Printing Solution   →   0 products (roadmap placeholder)
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
  /** Approximate number of products in this category from the Excel catalog */
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

// ---------------------------------------------------------------------------
// 6 top-level product categories
// ---------------------------------------------------------------------------

/**
 * All 6 Primeserve product categories.
 * 'printing_solution' is a roadmap placeholder (0 products currently).
 * productCount is approximate — from the source Excel files.
 */
export const PRODUCT_CATEGORIES: ProductCategoryMeta[] = [
  {
    value: 'housekeeping_materials',
    label: 'Housekeeping Materials',
    description: 'Cleaning cloths, mops, brushes, garbage bags, dispensers, and all housekeeping tools',
    icon: 'Sparkles',
    productCount: 170,
  },
  {
    value: 'cleaning_chemicals',
    label: 'Cleaning Chemicals',
    description: 'Floor cleaners, toilet cleaners, hand wash, soaps, detergents, and disinfectants',
    icon: 'FlaskConical',
    productCount: 56,
  },
  {
    value: 'office_stationeries',
    label: 'Office Stationeries',
    description: 'Pens, files, staplers, tapes, notebooks, envelopes, and desk accessories',
    icon: 'PenTool',
    productCount: 160,
  },
  {
    value: 'pantry_items',
    label: 'Pantry Items',
    description: 'Disposable cups, plates, and pantry consumables',
    icon: 'Coffee',
    productCount: 2,
  },
  {
    value: 'facility_and_tools',
    label: 'Facility & Tools',
    description: 'Safety equipment, plumbing tools, and facility maintenance gear',
    icon: 'Wrench',
    productCount: 6,
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
    { value: 'bulk_cleaning_chemicals',     label: 'Bulk Cleaning Chemicals',    slug: 'bulk_cleaning_chemicals' },
    { value: 'branded_cleaning_liquids',    label: 'Branded Cleaning Liquids',   slug: 'branded_cleaning_liquids' },
    { value: 'soaps_and_detergent_powders', label: 'Soaps & Detergent Powders',  slug: 'soaps_and_detergent_powders' },
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
  const subs = getSubcategoriesByCategory(categoryValue);
  return subs.find((s) => s.slug === subcategorySlug)?.label ?? subcategorySlug;
}
