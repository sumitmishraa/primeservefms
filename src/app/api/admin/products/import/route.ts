/**
 * POST /api/admin/products/import
 *
 * Bulk import endpoint for Primeserve product catalog spreadsheets.
 *
 * Supported workbook formats (auto-detected per sheet):
 *
 *   1. "Diversey Price List 2025 Client" — single-sheet TASKI / Diversey list.
 *      Header row 4. Columns:
 *        A = ITEM CODE
 *        B = PRODUCT NAME
 *        C = GROUP        (Laundry / Kitchen / HSK / FC / OC / PC / IPM / DWP / Others / MWW / MWW CONC / BC)
 *        D = PACK SIZE    e.g. "(1 x 25kg)" "(2x5 lit)" "20*500ml"
 *        E = HSN Code
 *        F = CLP Rate 2025
 *        G = GST %        (workbook stores 0.18 / 0.28; we convert to 18 / 28)
 *      Every imported row goes under top-level category `cleaning_chemicals`.
 *      GROUP is mapped to a fine-grained cleaning_chemicals subcategory_slug
 *      via TASKI_GROUP_TO_SUBCATEGORY.
 *
 *   2. Legacy "Housekeeping" / "Stationery" workbook.
 *      Header row contains "Item Descriptions". Columns: SL.No,
 *      Item Descriptions, size/brand, units/Qty, Category, Sub-category,
 *      Image URLs. Existing UI for this format is unchanged.
 *
 * For both formats:
 *   - Section / note rows are skipped.
 *   - Slugs are deterministic (family-name + pack), with item code fallback
 *     so re-imports pick up the same row instead of creating duplicates.
 *   - Same-name + different-pack rows stay grouped via group_slug for the
 *     PDP variant picker.
 *   - Exact duplicates (same name + pack) within the workbook are skipped.
 *   - Duplicates against the existing DB are detected by the deterministic
 *     slug, so a re-upload is idempotent.
 *
 * Admin-only — returns 403 for any non-admin caller.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { createHash } from 'crypto';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';
import {
  TASKI_GROUP_TO_SUBCATEGORY,
  TASKI_DEFAULT_SUBCATEGORY,
} from '@/lib/constants/categories';
import type { Enums } from '@/types/database';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

interface RowError {
  row:    number;
  name:   string;
  reason: string;
}

/**
 * One staged operation produced by a sheet parser.
 *  - kind 'insert'      → fresh row to INSERT.
 *  - kind 'reactivate'  → existing soft-deleted row whose deterministic slug
 *                         matched. We UPDATE it back to is_active=true and
 *                         refresh price / hsn / gst / description in case the
 *                         workbook revised them.
 */
type StagedOp =
  | { kind: 'insert';     payload: ProductInsert }
  | { kind: 'reactivate'; id: string; payload: Partial<ProductInsert> };

interface ProductInsert {
  uploaded_by:       string;
  vendor_id:         null;
  name:              string;
  slug:              string;
  sku:               string | null;
  short_description: string;
  description:       string;
  category:          Enums<'product_category'>;
  subcategory_id:    string | null;
  subcategory_slug:  string | null;
  brand:             string | null;
  size_variant:      string | null;
  group_slug:        string | null;
  unit_of_measure:   Enums<'unit_of_measure'>;
  base_price:        number;
  moq:               number;
  stock_status:      Enums<'stock_status'>;
  is_approved:       boolean;
  is_active:         boolean;
  hsn_code:          string | null;
  gst_rate:          number;
  thumbnail_url:     string | null;
  images:            string[];
  specifications:    Record<string, string>;
  tags:              string[];
}

interface ImportContext {
  user:           { id: string };
  /** Active product slugs already present in the DB before this import started.
   *  A deterministic-slug match here means "this row is already live" and we skip. */
  dbSlugs:        Set<string>;
  /** Slug -> id for SOFT-DELETED rows. A match here means "this row was previously
   *  trashed" — we reactivate + refresh it instead of inserting a duplicate. */
  inactiveByslug: Map<string, string>;
  /** Slugs that have been added by this import run (used to break ties within the workbook). */
  batchSlugs:     Set<string>;
  subcats:        Array<{ id: string; slug: string; category: string }>;
  errors:         RowError[];
  /** Counter incremented every time a row is skipped because its slug already exists in dbSlugs. */
  skippedExisting: { count: number };
  /** Counter incremented every time a soft-deleted row was reactivated by this import. */
  reactivated:    { count: number };
  /** Crescent imports skip spreadsheet product rows that do not carry an image URL. */
  skippedNoImage:  { count: number };
}

// ---------------------------------------------------------------------------
// Generic helpers
// ---------------------------------------------------------------------------

/** Lowercase + strip non-alphanumeric → hyphen-joined token. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Underscore-form slug for subcategories (matches existing DB rows). */
function underscoreSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s*&\s*/g, '_and_')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Robust numeric parser — accepts numbers, comma-formatted strings
 * ("15,813"), strings padded with whitespace, and string with the rupee sign.
 * Returns NaN for anything that cannot be parsed.
 */
function parseNumeric(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[\s,₹]/g, '').trim();
    if (!cleaned) return NaN;
    const n = Number(cleaned);
    return isFinite(n) ? n : NaN;
  }
  return NaN;
}

/**
 * Workbook GST cells are 0.18 / 0.28. Convert to whole-percent (18 / 28).
 * Already-percent values (18, 28) pass through. Falls back to 18 when the
 * cell is empty or non-numeric.
 */
function normaliseGst(v: unknown): number {
  const n = parseNumeric(v);
  if (!isFinite(n)) return 18;
  if (n > 0 && n < 1) return Math.round(n * 100);
  return Math.round(n);
}

/**
 * Map a unit_of_measure-ish string to our enum.
 * Falls back to 'piece' when nothing matches.
 */
const LEGACY_UNIT_MAP: Record<string, Enums<'unit_of_measure'>> = {
  '1 no':    'piece', '1 nos':  'piece', 'nos':    'piece', 'no':     'piece',
  'piece':   'piece', 'pieces': 'piece',
  'ream':    'ream',
  '1 pkt':   'pkt', '1pkt':  'pkt', 'pkt':    'pkt', 'packet': 'pkt',
  '1 box':   'box', 'box':   'box',
  '1 kg':    'kg',  '1kg':   'kg',  'kg':     'kg',
  '1 can':   'can', '1can':  'can', 'can':    'can',
  '1 ltr':   'liter', '1 litre': 'liter', 'ltr':    'liter',
  'litre':   'liter', 'liter':   'liter',
  'set':     'set', '1 pair':  'pair', 'pair':   'pair',
  'bottle':  'bottle', 'tube':  'tube', 'roll':   'roll',
  'pack':    'pack', 'carton':  'carton',
};
function mapLegacyUnit(raw: string): Enums<'unit_of_measure'> {
  return LEGACY_UNIT_MAP[raw.trim().toLowerCase()] ?? 'piece';
}

/**
 * Pick a unit_of_measure that is a sensible default for a Diversey row,
 * derived from the pack-size text (e.g. "(2x5 lit)" → liter, "(1 x 25kg)" → kg).
 */
function packToUnit(pack: string): Enums<'unit_of_measure'> {
  const s = pack.toLowerCase();
  if (/\b(lit|ltr|litre|liter|ml)\b/.test(s)) return 'can';
  if (/\bkg\b/.test(s)) return 'pack';
  if (/\bbulb|unit|piece|nos?\b/.test(s)) return 'piece';
  if (/\bbottle\b/.test(s)) return 'bottle';
  return 'pack';
}

/**
 * Map a legacy "Category" column string to our product_category enum.
 * Used by the housekeeping/stationery workbook only.
 */
function mapLegacyCategory(raw: string): Enums<'product_category'> {
  const s = raw.toLowerCase().trim();
  if (s.includes('housekeeping'))                       return 'housekeeping_materials';
  if (s.includes('chemical') || s.includes('cleaning')) return 'cleaning_chemicals';
  if (s.includes('stationer'))                          return 'office_stationeries';
  if (s.includes('pantry'))                             return 'pantry_items';
  if (s.includes('facility') || s.includes('tool'))     return 'facility_and_tools';
  if (s.includes('printing') || s.includes('print'))    return 'printing_solution';
  return 'housekeeping_materials';
}

// ---------------------------------------------------------------------------
// Description generator (deterministic, no LLM)
// ---------------------------------------------------------------------------

/**
 * Generate a SEO-friendly short description for a cleaning-chemical row.
 * Optimised for Google Shopping and organic product searches.
 */
function buildShortDescription(
  name:        string,
  pack:        string | null,
  useCaseHint: string,
): string {
  const packSuffix = pack ? `, ${pack}` : '';
  return `Buy ${name}${packSuffix} online — professional ${useCaseHint} at bulk B2B prices with GST invoice. Fast 24–48 hr delivery across India.`;
}

/**
 * Generate a long SEO description for the product detail page.
 * Built deterministically — no AI runtime needed.
 * Structured to rank for: product name + B2B + bulk + GST + facility.
 */
function buildLongDescription(
  name:        string,
  pack:        string | null,
  useCaseHint: string,
  hsn:         string | null,
  gstRate:     number,
): string {
  const lines: string[] = [];
  const displayName = pack ? `${name} (${pack})` : name;

  lines.push(
    `${displayName} is a professional-grade ${useCaseHint} trusted by hotels, hospitals, ` +
    `corporate offices, restaurants, and large facility management teams across India. ` +
    `Ideal for high-frequency, high-volume B2B procurement.`,
  );
  lines.push(
    `Why businesses choose PrimeServe for ${name.toLowerCase()}:\n` +
    `• Competitive bulk pricing with volume-based discounts\n` +
    `• GST-compliant B2B invoice included with every order\n` +
    `• Fast 24–48 hour delivery to your registered branch address\n` +
    `• Securely packaged to ensure zero damage on arrival\n` +
    `• Reorder in one click from your buyer dashboard`,
  );
  if (pack) {
    lines.push(`Available pack size: ${pack}.`);
  }
  if (hsn) {
    lines.push(
      `HSN code: ${hsn} | GST rate: ${gstRate}% — fully compliant for input tax credit claims.`,
    );
  } else {
    lines.push(`GST rate: ${gstRate}% — compliant for input tax credit claims.`);
  }
  lines.push(
    `Order ${name} in bulk on PrimeServe — India's leading B2B marketplace for facility ` +
    `and housekeeping supplies. Pan-India delivery, transparent pricing, no hidden charges.`,
  );
  return lines.join('\n\n');
}

/**
 * Returns a short use-case phrase that is plugged into the description
 * templates above. Driven by the cleaning-chemical subcategory slug.
 */
function describeUseCase(subSlug: string): string {
  switch (subSlug) {
    case 'laundry_chemicals':                  return 'commercial laundry detergent and fabric care';
    case 'kitchen_hygiene_and_warewashing':    return 'kitchen hygiene, dishwashing, and warewashing';
    case 'housekeeping_and_general_cleaners':  return 'general-purpose housekeeping and surface cleaning';
    case 'floor_care_and_polish':              return 'floor cleaning, polish, and stripping';
    case 'washroom_and_odour_control':         return 'washroom hygiene and odour control';
    case 'personal_care_and_hand_hygiene':     return 'hand hygiene and personal care';
    case 'pest_control_and_fly_management':    return 'integrated pest and fly management';
    case 'dispensers_and_hygiene_accessories': return 'dispensers and hygiene accessories';
    case 'dishwashing_machines_and_equipment': return 'dishwashing machines and warewash equipment';
    default:                                   return 'industrial cleaning and sanitation';
  }
}

function splitImageUrls(raw: string): string[] {
  return raw
    .split(/[,;\n]/)
    .map((u) => u.trim())
    .filter(Boolean);
}

function stableHash(text: string): string {
  return createHash('sha1').update(text).digest('hex').slice(0, 10);
}

function cleanWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

const COLOUR_ALIASES: Record<string, string> = {
  blue: 'Blue',
  red: 'Red',
  green: 'Green',
  yello: 'Yellow',
  yellow: 'Yellow',
  black: 'Black',
  orange: 'Orange',
  white: 'White',
  grey: 'Grey',
  gray: 'Grey',
  brown: 'Brown',
};

function extractColours(name: string): { name: string; colours: string[] } {
  const match = name.match(/\(([^)]*)\)?/);
  if (!match) return { name: cleanWhitespace(name), colours: [] };

  const colours = Array.from(
    new Set(
      match[1]
        .split(/[,/|]+/)
        .map((part) => part.trim().toLowerCase())
        .map((part) => COLOUR_ALIASES[part])
        .filter((part): part is string => Boolean(part)),
    ),
  );

  return {
    name: cleanWhitespace(name.replace(match[0], '')),
    colours,
  };
}

function familyNameFromProductName(name: string): string {
  return cleanWhitespace(
    name
      .replace(/\b(small|medium|big|large|regulars?|regular)\b/gi, '')
      .replace(/\s+/g, ' '),
  );
}

function variantLabelFromProductName(name: string): string {
  const match = name.match(/\b(small|medium|big|large|regulars?|regular)\b\s*$/i);
  return match ? cleanWhitespace(match[1]) : '';
}

// ---------------------------------------------------------------------------
// Crescent housekeeping / stationery workbook parser
// ---------------------------------------------------------------------------

function isCrescentSheet(rawRows: unknown[][]): boolean {
  const headerRow = rawRows.find((r) => Array.isArray(r) && r.some(
    (c) => typeof c === 'string' && c.toLowerCase().includes('item descriptions'),
  ));
  if (!headerRow) return false;

  const flat = headerRow
    .map((c) => (typeof c === 'string' ? c.toLowerCase() : ''))
    .join('|');

  return flat.includes('rate') && flat.includes('gst') && flat.includes('image');
}

function mapCrescentSection(
  sheetName: string,
  sectionRaw: string,
): { category: Enums<'product_category'>; subcategorySlug: string | null; useCase: string } {
  const sheet = sheetName.toLowerCase();
  const section = sectionRaw.toLowerCase();

  if (sheet.includes('stationer')) {
    if (section.includes('xerox') || section.includes('paper')) {
      return {
        category: 'office_stationeries',
        subcategorySlug: 'copier_and_printing_paper',
        useCase: 'office copier paper and printing stationery',
      };
    }
    if (section.includes('pen') || section.includes('pencil')) {
      return {
        category: 'office_stationeries',
        subcategorySlug: 'pens_pencils_and_markers',
        useCase: 'office writing instruments and markers',
      };
    }
    if (section.includes('note')) {
      return {
        category: 'office_stationeries',
        subcategorySlug: 'notebooks_and_writing_pads',
        useCase: 'office notebooks and writing pads',
      };
    }
    if (section.includes('punch') || section.includes('stapler')) {
      return {
        category: 'office_stationeries',
        subcategorySlug: 'staplers_and_punching_machines',
        useCase: 'staplers, punching machines, and desk stationery',
      };
    }
    if (section.includes('clip')) {
      return {
        category: 'office_stationeries',
        subcategorySlug: 'clips_pins_and_fasteners',
        useCase: 'office clips, pins, and fasteners',
      };
    }
    if (section.includes('post')) {
      return {
        category: 'office_stationeries',
        subcategorySlug: 'sticky_notes_and_postits',
        useCase: 'sticky notes and office reminders',
      };
    }
    if (section.includes('pack')) {
      return {
        category: 'office_stationeries',
        subcategorySlug: 'tapes_and_adhesives',
        useCase: 'packing tape and adhesive stationery',
      };
    }
    if (section.includes('file') || section.includes('folder')) {
      return {
        category: 'office_stationeries',
        subcategorySlug: 'files_and_folders',
        useCase: 'office files, folders, and document storage',
      };
    }
    if (section.includes('envelop')) {
      return {
        category: 'office_stationeries',
        subcategorySlug: 'envelopes_and_covers',
        useCase: 'office envelopes and document covers',
      };
    }
    return {
      category: 'office_stationeries',
      subcategorySlug: 'general_stationery',
      useCase: 'general office stationery procurement',
    };
  }

  if (section.includes('chemical') || section.includes('liquid')) {
    return {
      category: 'cleaning_chemicals',
      subcategorySlug: 'housekeeping_and_general_cleaners',
      useCase: 'housekeeping chemicals and cleaning liquids',
    };
  }
  if (section.includes('soap') || section.includes('powder')) {
    return {
      category: 'cleaning_chemicals',
      subcategorySlug: 'soaps_and_detergent_powders',
      useCase: 'soaps, detergent powders, and cleaning consumables',
    };
  }
  if (section.includes('paper')) {
    return {
      category: 'housekeeping_materials',
      subcategorySlug: 'paper_and_tissue_products',
      useCase: 'paper and tissue housekeeping supplies',
    };
  }
  if (section.includes('plastic')) {
    return {
      category: 'housekeeping_materials',
      subcategorySlug: 'plastic_ware_and_bins',
      useCase: 'plastic housekeeping ware and bins',
    };
  }
  if (section.includes('garbage') && section.includes('coul')) {
    return {
      category: 'housekeeping_materials',
      subcategorySlug: 'garbage_bags_colour_coded',
      useCase: 'colour-coded garbage bags for facility waste segregation',
    };
  }
  if (section.includes('garbage')) {
    return {
      category: 'housekeeping_materials',
      subcategorySlug: 'garbage_bags_black',
      useCase: 'garbage bags and waste management supplies',
    };
  }
  if (section.includes('mop')) {
    return {
      category: 'housekeeping_materials',
      subcategorySlug: 'mops_and_mop_refills',
      useCase: 'mops, mop cloths, and floor cleaning tools',
    };
  }
  if (section.includes('brush')) {
    return {
      category: 'housekeeping_materials',
      subcategorySlug: 'brushes_and_scrubbing_tools',
      useCase: 'brushes and scrubbing tools for facility upkeep',
    };
  }
  if (section.includes('fresh')) {
    return {
      category: 'housekeeping_materials',
      subcategorySlug: 'air_and_room_fresheners',
      useCase: 'air fresheners and room freshening supplies',
    };
  }
  if (section.includes('dispenser')) {
    return {
      category: 'housekeeping_materials',
      subcategorySlug: 'dispensers_and_hand_dryers',
      useCase: 'dispensers and hand-dryer accessories',
    };
  }

  return {
    category: 'housekeeping_materials',
    subcategorySlug: 'brooms_and_cleaning_cloths',
    useCase: 'brooms, cloths, and daily housekeeping materials',
  };
}

function parseCrescentSheet(
  sheetName: string,
  rawRows:   unknown[][],
  ctx:       ImportContext,
): StagedOp[] {
  const headerRowIndex = rawRows.findIndex(
    (r) => Array.isArray(r) && r.some(
      (c) => typeof c === 'string' && c.toLowerCase().includes('item descriptions'),
    ),
  );
  if (headerRowIndex === -1) return [];

  const headerRow = rawRows[headerRowIndex] as unknown[];
  const findCol = (predicate: (h: string) => boolean): number =>
    headerRow.findIndex((h) => typeof h === 'string' && predicate(h.toLowerCase()));

  const colIdx = {
    slNo:   findCol((h) => h.includes('sl')),
    name:   findCol((h) => h.includes('item descriptions')),
    brand:  findCol((h) => h.includes('brand')),
    qty:    findCol((h) => h.includes('qty') || h.includes('unit')),
    rate:   findCol((h) => h.includes('rate')),
    gst:    findCol((h) => h.includes('gst')),
    image:  findCol((h) => h.includes('image') || h.includes('url')),
  };

  if (colIdx.name === -1 || colIdx.rate === -1 || colIdx.image === -1) return [];

  interface CrescentRow {
    absRow: number;
    slNo: string;
    name: string;
    familyName: string;
    size: string;
    unit: string;
    rate: number;
    gstRate: number;
    images: string[];
    colours: string[];
    category: Enums<'product_category'>;
    subcategorySlug: string | null;
    subcategoryId: string | null;
    useCase: string;
    groupKey: string;
  }

  const staged: CrescentRow[] = [];
  const rowsByGroup = new Map<string, CrescentRow[]>();
  let currentSection = '';

  for (let i = headerRowIndex + 1; i < rawRows.length; i++) {
    const row = rawRows[i];
    if (!Array.isArray(row)) continue;

    const absRow = i + 1;
    const slValue = colIdx.slNo !== -1 ? row[colIdx.slNo] : row[0];
    const nameRaw = row[colIdx.name];

    if (typeof slValue === 'string' && slValue.trim() && !nameRaw) {
      currentSection = slValue.trim();
      continue;
    }
    if (typeof slValue !== 'number' || !isFinite(slValue)) continue;

    const rawName = typeof nameRaw === 'string' ? nameRaw.trim() : String(nameRaw ?? '').trim();
    if (!rawName) continue;

    const imageRaw = colIdx.image !== -1 && row[colIdx.image] != null
      ? String(row[colIdx.image]).trim()
      : '';
    const images = imageRaw ? splitImageUrls(imageRaw) : [];
    if (images.length === 0) {
      ctx.skippedNoImage.count++;
      continue;
    }

    const rate = parseNumeric(row[colIdx.rate]);
    if (!isFinite(rate) || rate <= 0) {
      ctx.errors.push({ row: absRow, name: rawName, reason: 'Missing or non-numeric rate' });
      continue;
    }

    const { name: cleanedName, colours } = extractColours(rawName);
    const sizeRaw = colIdx.brand !== -1 && row[colIdx.brand] != null
      ? cleanWhitespace(String(row[colIdx.brand]))
      : '';
    const size = sizeRaw || variantLabelFromProductName(cleanedName);
    const unitRaw = colIdx.qty !== -1 && row[colIdx.qty] != null
      ? cleanWhitespace(String(row[colIdx.qty]))
      : '';
    const meta = mapCrescentSection(sheetName, currentSection);
    const subcategoryId = meta.subcategorySlug
      ? ctx.subcats.find((s) => s.slug === meta.subcategorySlug && s.category === meta.category)?.id ?? null
      : null;
    const familyName = familyNameFromProductName(cleanedName) || cleanedName;
    const imageKey = images[0].trim().toLowerCase();
    const groupKey = `${slugify(familyName)}:${stableHash(imageKey)}`;

    const stagedRow: CrescentRow = {
      absRow,
      slNo: String(slValue),
      name: cleanedName || rawName,
      familyName,
      size,
      unit: unitRaw,
      rate,
      gstRate: normaliseGst(row[colIdx.gst]),
      images,
      colours,
      category: meta.category,
      subcategorySlug: meta.subcategorySlug,
      subcategoryId,
      useCase: meta.useCase,
      groupKey,
    };

    staged.push(stagedRow);
    const groupRows = rowsByGroup.get(groupKey) ?? [];
    groupRows.push(stagedRow);
    rowsByGroup.set(groupKey, groupRows);
  }

  const productOps: StagedOp[] = [];
  const importKeys = new Set<string>();

  for (const s of staged) {
    const groupRows = rowsByGroup.get(s.groupKey) ?? [s];
    const variantTotal = groupRows.reduce(
      (total, row) => total + Math.max(1, row.colours.length),
      0,
    );
    const groupSlug = variantTotal > 1 ? `crescent-${s.groupKey}` : null;
    const colours = s.colours.length > 0 ? s.colours : [null];

    for (const colour of colours) {
      const sizeParts = [s.size, colour].filter(Boolean);
      const sizeVariant = sizeParts.length > 0 ? sizeParts.join(' / ') : null;
      const slugParts = [
        s.familyName,
        s.size,
        colour,
        sheetName,
        s.slNo,
      ].filter(Boolean);
      let baseSlug = slugify(slugParts.join(' '));
      if (!baseSlug) baseSlug = `crescent-product-${s.slNo}`;

      const fileKey = `${baseSlug}|${s.images[0]}`;
      if (importKeys.has(fileKey)) continue;
      importKeys.add(fileKey);

      if (ctx.dbSlugs.has(baseSlug)) {
        ctx.skippedExisting.count++;
        continue;
      }

      const reactivateId = ctx.inactiveByslug.get(baseSlug);
      let slug = baseSlug;
      if (!reactivateId) {
        let suffix = 1;
        while (ctx.batchSlugs.has(slug) || ctx.dbSlugs.has(slug) || ctx.inactiveByslug.has(slug)) {
          slug = `${baseSlug}-${++suffix}`;
        }
        ctx.batchSlugs.add(slug);
      }

      const specs: Record<string, string> = {};
      if (s.size) specs.Size = s.size;
      if (colour) specs.Colour = colour;
      if (s.unit) specs.Unit = s.unit;

      const short = buildShortDescription(s.familyName, sizeVariant, s.useCase);
      const long = buildLongDescription(s.familyName, sizeVariant, s.useCase, null, s.gstRate);
      const sku = `CRESCENT-${sheetName.replace(/[^a-z0-9]+/gi, '').toUpperCase()}-${s.slNo}`
        + (colour ? `-${colour.toUpperCase()}` : '');

      const payload: ProductInsert = {
        uploaded_by:       ctx.user.id,
        vendor_id:         null,
        name:              s.familyName,
        slug,
        sku,
        short_description: short,
        description:       long,
        category:          s.category,
        subcategory_id:    s.subcategoryId,
        subcategory_slug:  s.subcategorySlug,
        brand:             null,
        size_variant:      sizeVariant,
        group_slug:        groupSlug,
        unit_of_measure:   mapLegacyUnit(s.unit),
        base_price:        s.rate,
        moq:               1,
        stock_status:      'in_stock',
        is_approved:       true,
        is_active:         true,
        hsn_code:          null,
        gst_rate:          s.gstRate,
        thumbnail_url:     s.images[0],
        images:            s.images,
        specifications:    specs,
        tags:              ['crescent'],
      };

      if (reactivateId) {
        const { slug: _slug, uploaded_by: _u, vendor_id: _v, ...refresh } = payload;
        void _slug; void _u; void _v;
        productOps.push({
          kind: 'reactivate',
          id: reactivateId,
          payload: { ...refresh, is_active: true },
        });
      } else {
        productOps.push({ kind: 'insert', payload });
      }
    }
  }

  console.log(
    '[IMPORT] Crescent sheet',
    sheetName,
    '->',
    productOps.length,
    'rows, skipped no-image:',
    ctx.skippedNoImage.count,
  );
  return productOps;
}

// ---------------------------------------------------------------------------
// Diversey workbook parser
// ---------------------------------------------------------------------------

/**
 * Returns true when a sheet looks like the Diversey / TASKI 2025 price list.
 *
 * Detection: row 4 (index 3) must have "ITEM CODE" in column A AND contain
 * both "group" and "pack" columns. We intentionally do NOT require the exact
 * price-column label ("CLP Rate 2025" vs "Rate") since that varies by section.
 */
function isDiverseySheet(rawRows: unknown[][]): boolean {
  const r4 = rawRows[3];
  if (!Array.isArray(r4)) return false;
  const colA = typeof r4[0] === 'string' ? r4[0].toLowerCase().trim() : '';
  if (colA !== 'item code') return false;
  const flat = r4
    .map((c) => (typeof c === 'string' ? c.toLowerCase() : ''))
    .join('|');
  // Must have a price-like column ("rate" or "clp") AND group AND pack
  return (flat.includes('rate') || flat.includes('clp')) &&
    flat.includes('group') &&
    flat.includes('pack');
}

/**
 * Builds product inserts from the Diversey "Price List 2025" sheet.
 * Mutates ctx.errors with row-level problems but never throws.
 */
function parseDiverseySheet(
  rawRows: unknown[][],
  ctx:     ImportContext,
): StagedOp[] {
  // Header is row 4 (index 3); data starts at row 5 (index 4).
  const headerRow = Array.isArray(rawRows[3]) ? rawRows[3] : [];
  const imageCols = headerRow
    .map((h, idx) => ({
      idx,
      label: typeof h === 'string' ? h.toLowerCase() : '',
    }))
    .filter(({ label }) => (
      label.includes('image') ||
      label.includes('photo') ||
      label.includes('picture') ||
      label.includes('url')
    ))
    .map(({ idx }) => idx);
  const dataRows = rawRows.slice(4);

  // De-dupe storage.
  const importKeys = new Set<string>();         // name+pack key — within-file dedupe
  const groupCount = new Map<string, number>(); // group_slug → row count, for variant detection
  const products: StagedOp[] = [];

  // Pre-fetch existing subcategories once and look them up by slug only.
  const subcatBySlug = new Map<string, string>();
  for (const s of ctx.subcats) {
    if (s.category === 'cleaning_chemicals') subcatBySlug.set(s.slug, s.id);
  }

  // -------- pass 1 — parse rows, record group counts --------------------
  interface StagedRow {
    insert:        Omit<ProductInsert, 'group_slug'>;
    familySlug:    string;
    rowNumber:     number;
    /** non-null when this row should reactivate an existing soft-deleted product */
    reactivateId?: string;
  }
  const staged: StagedRow[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];
    if (!Array.isArray(row)) continue;

    const absRow = i + 5; // 1-based excel row number

    const itemCodeRaw = row[0];
    const nameRaw     = row[1];
    const groupRaw    = row[2];
    const packRaw     = row[3];
    const hsnRaw      = row[4];
    const rateRaw     = row[5];
    const gstRaw      = row[6];

    const name = typeof nameRaw === 'string' ? nameRaw.trim() : String(nameRaw ?? '').trim();
    if (!name) continue;

    // Skip repeated section-header rows — col A is "ITEM CODE" (any casing/spacing).
    if (typeof itemCodeRaw === 'string' && itemCodeRaw.trim().toUpperCase() === 'ITEM CODE') continue;

    // Skip footer / note / terms rows (col A starts with "Note", "Terms", "GST Extra", etc.).
    if (typeof itemCodeRaw === 'string' &&
        /^(note|terms|gst extra|payment|delivery|sku)/i.test(itemCodeRaw.trim())) continue;
    if (/^(note|terms)/i.test(name)) continue;

    const rate = parseNumeric(rateRaw);
    if (!isFinite(rate) || rate <= 0) {
      // Either a section header ("LAUNDRY - LIQUIDS") or a row with no price.
      // Section headers rarely have HSN/group filled in either.
      if (groupRaw || hsnRaw) {
        ctx.errors.push({ row: absRow, name, reason: 'Missing or non-numeric rate' });
      }
      continue;
    }

    const pack    = typeof packRaw === 'string' ? packRaw.trim()
                  : packRaw != null              ? String(packRaw).trim() : '';
    const groupS  = typeof groupRaw === 'string' ? groupRaw.trim() : '';
    const hsn     = hsnRaw == null || hsnRaw === '' ? null : String(hsnRaw).trim();
    const gstRate = normaliseGst(gstRaw);
    const itemCode = itemCodeRaw == null || itemCodeRaw === '' ? null : String(itemCodeRaw).trim();
    const images = imageCols.flatMap((col) => {
      const raw = row[col];
      return raw == null || raw === '' ? [] : splitImageUrls(String(raw));
    });

    // Within-file exact-duplicate detection (name + pack).
    const fileKey = `${name.toLowerCase()}|${pack.toLowerCase()}`;
    if (importKeys.has(fileKey)) continue;
    importKeys.add(fileKey);

    // Subcategory mapping.
    const subSlug = TASKI_GROUP_TO_SUBCATEGORY[groupS.toLowerCase()] ?? TASKI_DEFAULT_SUBCATEGORY;
    const subId   = subcatBySlug.get(subSlug) ?? null;

    // Family slug (used for both group_slug and the deterministic product slug).
    const familySlug = slugify(name);

    // Deterministic product slug — family + pack. Adds item code as fallback
    // so collisions inside the same family stay unique.
    let baseSlug = familySlug;
    if (pack) baseSlug += '-' + slugify(pack);
    if (!baseSlug) baseSlug = 'product';
    if (itemCode) baseSlug += '-' + slugify(itemCode);

    // If this exact slug matches an active row, the workbook entry is already
    // imported — skip silently for idempotent re-imports.
    if (ctx.dbSlugs.has(baseSlug)) {
      ctx.skippedExisting.count++;
      continue;
    }

    // If this exact slug matches a soft-deleted row, reactivate + refresh it
    // instead of inserting a duplicate.
    const reactivateId = ctx.inactiveByslug.get(baseSlug);
    let slug = baseSlug;
    if (!reactivateId) {
      // Within-batch tie-break (e.g. two pack sizes that collapse to the same
      // slug after normalisation but with different item codes).
      let suffix = 1;
      while (ctx.batchSlugs.has(slug) || ctx.dbSlugs.has(slug) || ctx.inactiveByslug.has(slug)) {
        slug = `${baseSlug}-${++suffix}`;
      }
      ctx.batchSlugs.add(slug);
    }

    const useCase = describeUseCase(subSlug);
    const short   = buildShortDescription(name, pack || null, useCase);
    const long    = buildLongDescription(name, pack || null, useCase, hsn, gstRate);

    const insert: Omit<ProductInsert, 'group_slug'> = {
      uploaded_by:       ctx.user.id,
      vendor_id:         null,
      name,
      slug,
      sku:               itemCode,
      short_description: short,
      description:       long,
      category:          'cleaning_chemicals',
      subcategory_id:    subId,
      subcategory_slug:  subSlug,
      brand:             null,
      size_variant:      pack || null,
      unit_of_measure:   packToUnit(pack),
      base_price:        rate,
      moq:               1,
      stock_status:      'in_stock',
      is_approved:       true,
      is_active:         true,
      hsn_code:          hsn,
      gst_rate:          gstRate,
      thumbnail_url:     images[0] ?? null,
      images,
      specifications:    pack ? { 'Pack Size': pack } : {},
      tags:              [],
    };

    staged.push({ insert, familySlug, rowNumber: absRow, reactivateId });
    groupCount.set(familySlug, (groupCount.get(familySlug) ?? 0) + 1);
  }

  // -------- pass 2 — attach group_slug only to families with >1 pack ----
  for (const s of staged) {
    const isVariantFamily = (groupCount.get(s.familySlug) ?? 0) > 1;
    const payload: ProductInsert = {
      ...s.insert,
      group_slug: isVariantFamily ? s.familySlug : null,
    };
    if (s.reactivateId) {
      // For reactivation, drop fields that should not change on a re-import:
      // slug (DB identity), uploaded_by (original importer), vendor_id (admin-managed).
      const { slug: _slug, uploaded_by: _u, vendor_id: _v, ...refresh } = payload;
      void _slug; void _u; void _v;
      products.push({
        kind: 'reactivate',
        id: s.reactivateId,
        payload: { ...refresh, is_active: true },
      });
    } else {
      products.push({ kind: 'insert', payload });
    }
  }

  return products;
}

// ---------------------------------------------------------------------------
// Legacy housekeeping / stationery workbook parser
// ---------------------------------------------------------------------------

/**
 * Builds product inserts from the legacy 2-sheet Primeserve workbook.
 * Slug is now deterministic (no random suffix) so re-uploads dedupe cleanly.
 */
function parseLegacySheet(
  sheetName: string,
  rawRows:   unknown[][],
  ctx:       ImportContext,
): StagedOp[] {
  const headerRowIndex = rawRows.findIndex(
    (r) => Array.isArray(r) && r.some(
      (c) => typeof c === 'string' && c.toLowerCase().includes('item descriptions'),
    ),
  );
  if (headerRowIndex === -1) return [];

  const headerRow = rawRows[headerRowIndex] as unknown[];
  const findCol = (predicate: (h: string) => boolean): number =>
    headerRow.findIndex((h) => typeof h === 'string' && predicate(h.toLowerCase()));

  const colIdx = {
    slNo:        findCol((h) => h.includes('sl')),
    name:        findCol((h) => h.includes('item descriptions')),
    sizeBrand:   findCol((h) => h.includes('size') || h.includes('brand')),
    unit:        findCol((h) => h.includes('unit') || h.includes('qty')),
    category:    findCol((h) => h.includes('category') && !h.includes('sub')),
    subcategory: findCol((h) => h.includes('sub')),
    imageUrl:    findCol((h) => h.includes('image') || h.includes('url')),
  };

  const dataRows = rawRows.slice(headerRowIndex + 1);
  const slNoCol  = colIdx.slNo === -1 ? 0 : colIdx.slNo;
  const products: StagedOp[] = [];

  dataRows.forEach((rawRow, idx) => {
    const row = rawRow as unknown[];
    const absRow = headerRowIndex + 2 + idx;
    if (!Array.isArray(row)) return;

    // Skip section-header rows — non-numeric SL.No.
    const slValue = row[slNoCol];
    if (typeof slValue !== 'number' || !isFinite(slValue)) return;

    const nameRaw = colIdx.name !== -1 ? row[colIdx.name] : undefined;
    const name = typeof nameRaw === 'string' ? nameRaw.trim() : String(nameRaw ?? '').trim();
    if (!name) {
      ctx.errors.push({ row: absRow, name: '', reason: 'Empty product name' });
      return;
    }

    const sizeBrandRaw = colIdx.sizeBrand !== -1 && row[colIdx.sizeBrand] != null
      ? String(row[colIdx.sizeBrand]).trim() : '';
    const unitRaw = colIdx.unit !== -1 && row[colIdx.unit] != null
      ? String(row[colIdx.unit]).trim() : '';
    const categoryRaw = colIdx.category !== -1 && row[colIdx.category] != null
      ? String(row[colIdx.category]).trim() : '';
    const subcategoryRaw = colIdx.subcategory !== -1 && row[colIdx.subcategory] != null
      ? String(row[colIdx.subcategory]).trim() : '';
    const imageUrlRaw = colIdx.imageUrl !== -1 && row[colIdx.imageUrl] != null
      ? String(row[colIdx.imageUrl]).trim() : '';

    const category = mapLegacyCategory(categoryRaw);
    const subcategorySlug = subcategoryRaw ? underscoreSlug(subcategoryRaw) : null;
    const subcatId = subcategorySlug
      ? ctx.subcats.find((s) => s.slug === subcategorySlug && s.category === category)?.id ?? null
      : null;

    const images: string[] = imageUrlRaw ? splitImageUrls(imageUrlRaw) : [];

    // Deterministic slug
    let baseSlug = slugify(name);
    if (sizeBrandRaw) baseSlug += '-' + slugify(sizeBrandRaw);
    if (!baseSlug) baseSlug = 'product';

    if (ctx.dbSlugs.has(baseSlug)) {
      ctx.skippedExisting.count++;
      return;
    }

    const reactivateId = ctx.inactiveByslug.get(baseSlug);
    let slug = baseSlug;
    if (!reactivateId) {
      let suffix = 1;
      while (ctx.batchSlugs.has(slug) || ctx.dbSlugs.has(slug) || ctx.inactiveByslug.has(slug)) {
        slug = `${baseSlug}-${++suffix}`;
      }
      ctx.batchSlugs.add(slug);
    }

    const payload: ProductInsert = {
      uploaded_by:       ctx.user.id,
      vendor_id:         null,
      name,
      slug,
      sku:               null,
      short_description: name,
      description:       buildLongDescription(name, sizeBrandRaw || null,
                           describeUseCase(subcategorySlug ?? ''), null, 18),
      category,
      subcategory_id:    subcatId,
      subcategory_slug:  subcategorySlug,
      brand:             null,
      size_variant:      sizeBrandRaw || null,
      group_slug:        null,
      unit_of_measure:   mapLegacyUnit(unitRaw),
      base_price:        0,
      moq:               1,
      stock_status:      'in_stock',
      is_approved:       true,
      is_active:         true,
      hsn_code:          null,
      gst_rate:          18,
      thumbnail_url:     images[0] ?? null,
      images,
      specifications:    {},
      tags:              [],
    };
    if (reactivateId) {
      const { slug: _slug, uploaded_by: _u, vendor_id: _v, ...refresh } = payload;
      void _slug; void _u; void _v;
      products.push({ kind: 'reactivate', id: reactivateId, payload: { ...refresh, is_active: true } });
    } else {
      products.push({ kind: 'insert', payload });
    }
  });

  console.log('[IMPORT] Legacy sheet', sheetName, '→', products.length, 'rows');
  return products;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

/**
 * Parses an uploaded workbook and bulk-inserts products into Supabase.
 * Returns counts of inserted, skipped, and per-row errors.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Auth
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ data: null, error: 'Not authenticated' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return NextResponse.json({ data: null, error: 'Forbidden — admin access only' }, { status: 403 });
    }

    // 2. Multipart form
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json({ data: null, error: 'No file provided' }, { status: 400 });
    }
    const fileObj = file as File;
    if (!fileObj.name.endsWith('.xlsx')) {
      return NextResponse.json({ data: null, error: 'Only .xlsx files are supported' }, { status: 400 });
    }

    // 3. Read workbook
    const buffer = Buffer.from(await fileObj.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    console.log('[IMPORT] Sheets in workbook:', workbook.SheetNames);

    const supabase = createAdminClient();

    // Pre-fetch existing slugs (split by activity) and subcategories.
    // Active rows  → "this is already imported, skip".
    // Inactive rows → "this was previously soft-deleted, reactivate it".
    const [{ data: existing }, { data: subcatRows }] = await Promise.all([
      supabase.from('products').select('id, slug, is_active'),
      supabase.from('subcategories').select('id, slug, category'),
    ]);

    const dbSlugs        = new Set<string>();
    const inactiveByslug = new Map<string, string>();
    for (const p of (existing ?? []) as Array<{ id: string; slug: string; is_active: boolean }>) {
      if (p.is_active) dbSlugs.add(p.slug);
      else             inactiveByslug.set(p.slug, p.id);
    }

    const ctx: ImportContext = {
      user:            { id: user.id },
      dbSlugs,
      inactiveByslug,
      batchSlugs:      new Set<string>(),
      subcats:         (subcatRows ?? []) as Array<{ id: string; slug: string; category: string }>,
      errors:          [],
      skippedExisting: { count: 0 },
      reactivated:     { count: 0 },
      skippedNoImage:   { count: 0 },
    };

    // 4. Parse each sheet using the appropriate parser.
    const ops: StagedOp[] = [];

    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });

      const sheetOps = isDiverseySheet(rawRows)
        ? parseDiverseySheet(rawRows, ctx)
        : isCrescentSheet(rawRows)
          ? parseCrescentSheet(sheetName, rawRows, ctx)
          : parseLegacySheet(sheetName, rawRows, ctx);

      ops.push(...sheetOps);
    }

    const inserts      = ops.filter((o): o is Extract<StagedOp, { kind: 'insert' }>     => o.kind === 'insert');
    const reactivates  = ops.filter((o): o is Extract<StagedOp, { kind: 'reactivate' }> => o.kind === 'reactivate');

    console.log('[IMPORT] Inserts queued:', inserts.length, 'Reactivations queued:', reactivates.length);

    let inserted = 0;

    // 5a. Batch INSERT new rows (chunks of 50).
    const CHUNK = 50;
    for (let i = 0; i < inserts.length; i += CHUNK) {
      const chunk = inserts.slice(i, i + CHUNK).map((o) => o.payload);
      const { error: bulkErr } = await supabase.from('products').insert(chunk);
      if (!bulkErr) {
        inserted += chunk.length;
        continue;
      }
      console.error('[IMPORT] Bulk insert error:', bulkErr.message);

      // Fallback: insert row-by-row to isolate the offender(s).
      for (const product of chunk) {
        const { error: singleErr } = await supabase.from('products').insert(product);
        if (!singleErr) {
          inserted++;
        } else if (singleErr.message.includes('duplicate') || singleErr.message.includes('unique')) {
          ctx.skippedExisting.count++;
        } else {
          ctx.errors.push({
            row:    0,
            name:   product.name,
            reason: `DB insert failed: ${singleErr.message}`,
          });
        }
      }
    }

    // 5b. Reactivate previously soft-deleted rows one-by-one (small N — fine).
    for (const op of reactivates) {
      const { error: updErr } = await supabase
        .from('products')
        .update(op.payload)
        .eq('id', op.id);
      if (updErr) {
        ctx.errors.push({
          row:    0,
          name:   op.payload.name ?? '(unknown)',
          reason: `Reactivate failed: ${updErr.message}`,
        });
      } else {
        ctx.reactivated.count++;
      }
    }

    console.log(
      '[IMPORT] Done. Inserted:', inserted,
      'Reactivated:', ctx.reactivated.count,
      'Skipped:', ctx.skippedExisting.count,
      'Errors:', ctx.errors.length,
    );

    const total = inserted + ctx.reactivated.count;
    return NextResponse.json({
      data: {
        imported: total,
        skipped:  ctx.skippedExisting.count,
        skipped_without_images: ctx.skippedNoImage.count,
        errors:   ctx.errors,
        message:  `Imported ${inserted} new products`
          + (ctx.reactivated.count > 0 ? `, reactivated ${ctx.reactivated.count}` : ''),
      },
      error: null,
    });
  } catch (error) {
    console.error('[api/admin/products/import POST]', error);
    return NextResponse.json(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
