/**
 * POST /api/admin/products/import
 *
 * Accepts a multipart form with a single .xlsx file and bulk-imports all
 * product rows into the products table.
 *
 * Logic per sheet:
 *   1. Find the header row (first row containing "Item Descriptions")
 *   2. Determine column indices from that header row
 *   3. Skip rows where column A (SL.No) is not a finite number — those are
 *      section-header rows like "BROOMS & CLOTH" that appear in the catalog
 *   4. Map each product row to our DB schema (unit enum, category enum, slug)
 *   5. Look up subcategory_id from the subcategories table by slug
 *   6. Skip products whose generated slug already exists (duplicate check)
 *   7. Batch-insert all new products; capture per-row errors
 *
 * Returns: { imported, skipped, errors: [{ row, reason }] }
 *
 * Admin-only — returns 403 for non-admin sessions.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Enums } from '@/types/database';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Unit-of-measure mapping
// ---------------------------------------------------------------------------

const UNIT_MAP: Record<string, Enums<'unit_of_measure'>> = {
  '1 no':   'piece',
  'nos':    'piece',
  'no':     'piece',
  'ream':   'ream',
  '1 pkt':  'pkt',
  'pkt':    'pkt',
  '1 box':  'box',
  'box':    'box',
  '1 kg':   'kg',
  'kg':     'kg',
  '1 can':  'can',
  'can':    'can',
  '1 ltr':  'liter',
  'ltr':    'liter',
  'litre':  'liter',
  'liter':  'liter',
  'set':    'set',
  '1 pair': 'pair',
  'pair':   'pair',
  'bottle': 'bottle',
  'tube':   'tube',
  'roll':   'roll',
  'pack':   'pack',
  'carton': 'carton',
};

/**
 * Maps a raw Excel unit string to the unit_of_measure enum.
 * Falls back to 'piece' for unrecognised values.
 *
 * @param raw - Raw string from the Excel "units" or "Qty" column
 * @returns Matched unit_of_measure enum value
 */
function mapUnit(raw: string): Enums<'unit_of_measure'> {
  return UNIT_MAP[raw.trim().toLowerCase()] ?? 'piece';
}

// ---------------------------------------------------------------------------
// Category mapping
// ---------------------------------------------------------------------------

/**
 * Maps a raw Excel category string to the product_category enum.
 * Returns null when no match is found (row will be skipped with an error).
 *
 * @param raw - Raw string from the Excel "Category" column
 * @returns Matched product_category enum value or null
 */
function mapCategory(raw: string): Enums<'product_category'> | null {
  const s = raw.toLowerCase().trim();
  if (s.includes('housekeeping'))              return 'housekeeping_materials';
  if (s.includes('chemical'))                  return 'cleaning_chemicals';
  if (s.includes('stationer'))                 return 'office_stationeries';
  if (s.includes('pantry'))                    return 'pantry_items';
  if (s.includes('facility') || s.includes('tool')) return 'facility_and_tools';
  if (s.includes('printing') || s.includes('print')) return 'printing_solution';
  if (s.includes('cleaning'))                  return 'cleaning_chemicals';
  return null;
}

// ---------------------------------------------------------------------------
// Slug helpers
// ---------------------------------------------------------------------------

/**
 * Converts a product name to a URL-safe slug.
 * e.g. "Garbage Bag 30x40" → "garbage-bag-30x40"
 *
 * @param name - Product name string
 * @returns Lowercase hyphenated slug
 */
function nameToSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/**
 * Converts a subcategory display name from Excel to a slug that matches
 * the slugs seeded in the subcategories table.
 * e.g. "Brooms & Cleaning Cloths" → "brooms_and_cleaning_cloths"
 *
 * @param text - Subcategory text from Excel
 * @returns Underscore-separated lowercase slug
 */
function subcategoryToSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s*&\s*/g, '_and_')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Returns true when the size/brand cell looks like a size or variant spec
 * (i.e. contains a digit or common measurement units).
 * Returns false when it looks like a brand name.
 *
 * @param value - Raw string from the Excel "size/brand" column
 * @returns Whether the value represents a size/variant
 */
function isSizeVariant(value: string): boolean {
  return /\d/.test(value);
}

// ---------------------------------------------------------------------------
// Row error type used in the response
// ---------------------------------------------------------------------------

interface RowError {
  row: number;
  reason: string;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

/**
 * Processes an uploaded .xlsx file and bulk-inserts products into Supabase.
 * Returns a summary of imported, skipped, and errored rows.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Auth check — admin only
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json(
        { data: null, error: 'Not authenticated' },
        { status: 401 }
      );
    }
    if (user.role !== 'admin') {
      return NextResponse.json(
        { data: null, error: 'Forbidden — admin access only' },
        { status: 403 }
      );
    }

    // 2. Parse multipart form
    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || typeof file === 'string') {
      return NextResponse.json(
        { data: null, error: 'No file provided' },
        { status: 400 }
      );
    }

    const fileObj = file as File;
    if (!fileObj.name.endsWith('.xlsx')) {
      return NextResponse.json(
        { data: null, error: 'Only .xlsx files are supported' },
        { status: 400 }
      );
    }

    // 3. Read the Excel workbook
    const arrayBuffer = await fileObj.arrayBuffer();
    const workbook = XLSX.read(new Uint8Array(arrayBuffer), { type: 'array' });

    const supabase = createAdminClient();

    // 4. Pre-fetch subcategories and existing slugs (done once, not per sheet)
    const [subcatsResult, existingResult] = await Promise.all([
      supabase.from('subcategories').select('id, slug, category'),
      supabase.from('products').select('slug'),
    ]);

    const subcats = subcatsResult.data ?? [];
    const existingSlugs = new Set((existingResult.data ?? []).map((p) => p.slug));

    // Accumulators
    let totalImported = 0;
    let totalSkipped = 0;
    const allErrors: RowError[] = [];

    // 5. Process each sheet
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1 });

      // Find the header row
      const headerRowIndex = rawRows.findIndex(
        (row) =>
          Array.isArray(row) &&
          row.some(
            (cell) =>
              typeof cell === 'string' &&
              cell.toLowerCase().includes('item descriptions')
          )
      );
      if (headerRowIndex === -1) {
        console.log('[IMPORT] No header row found in sheet:', sheetName, '— skipping');
        continue;
      }

      const headerRow = rawRows[headerRowIndex] as unknown[];

      // Locate column indices by header text
      const colIdx = {
        slNo:        headerRow.findIndex((h) => typeof h === 'string' && h.toLowerCase().includes('sl')),
        name:        headerRow.findIndex((h) => typeof h === 'string' && h.toLowerCase().includes('item descriptions')),
        sizeBrand:   headerRow.findIndex((h) => typeof h === 'string' && (h.toLowerCase().includes('size') || h.toLowerCase().includes('brand'))),
        unit:        headerRow.findIndex((h) => typeof h === 'string' && (h.toLowerCase().includes('unit') || h.toLowerCase() === 'qty')),
        category:    headerRow.findIndex((h) => typeof h === 'string' && h.toLowerCase() === 'category'),
        subcategory: headerRow.findIndex((h) => typeof h === 'string' && h.toLowerCase().includes('sub')),
      };

      const dataRows = rawRows.slice(headerRowIndex + 1);

      // Count product rows (numeric SL.No) for logging
      const productRowCount = dataRows.filter((row) => {
        const slValue = Array.isArray(row) ? row[colIdx.slNo === -1 ? 0 : colIdx.slNo] : undefined;
        return typeof slValue === 'number' && isFinite(slValue);
      }).length;

      console.log('[IMPORT] Processing sheet:', sheetName, '— found', productRowCount, 'product rows');

      // Rows to insert for this sheet
      const toInsert: Array<{
        uploaded_by: string;
        name: string;
        slug: string;
        category: Enums<'product_category'>;
        subcategory_id: string | null;
        subcategory_slug: string | null;
        brand: string | null;
        size_variant: string | null;
        unit_of_measure: Enums<'unit_of_measure'>;
        base_price: number;
        moq: number;
        stock_status: Enums<'stock_status'>;
        is_approved: boolean;
        is_active: boolean;
      }> = [];

      let sheetSkipped = 0;
      let sheetImported = 0;

      dataRows.forEach((rawRow, index) => {
        const row = rawRow as unknown[];
        const absoluteRow = headerRowIndex + 2 + index; // 1-based row number in Excel

        // Guard: row must be an array
        if (!Array.isArray(row)) return;

        // Get SL.No from column A (index 0) or from the detected column
        const slNoCol = colIdx.slNo === -1 ? 0 : colIdx.slNo;
        const slValue = row[slNoCol];

        // Skip section-header rows — they have non-numeric SL.No
        if (typeof slValue !== 'number' || !isFinite(slValue)) {
          return; // silently skip section headers
        }

        // Extract name
        const nameRaw = colIdx.name !== -1 ? row[colIdx.name] : undefined;
        const name = typeof nameRaw === 'string' ? nameRaw.trim() : '';
        if (!name) {
          allErrors.push({ row: absoluteRow, reason: 'Empty product name' });
          return;
        }

        // Size/Brand
        const sizeBrandRaw =
          colIdx.sizeBrand !== -1 && row[colIdx.sizeBrand] != null
            ? String(row[colIdx.sizeBrand]).trim()
            : '';
        const brand       = sizeBrandRaw && !isSizeVariant(sizeBrandRaw) ? sizeBrandRaw : null;
        const sizeVariant = sizeBrandRaw && isSizeVariant(sizeBrandRaw)  ? sizeBrandRaw : null;

        // Unit
        const unitRaw = colIdx.unit !== -1 && row[colIdx.unit] != null
          ? String(row[colIdx.unit]).trim()
          : '';
        const unitOfMeasure = mapUnit(unitRaw);

        // Category
        const categoryRaw =
          colIdx.category !== -1 && row[colIdx.category] != null
            ? String(row[colIdx.category]).trim()
            : '';
        const category = mapCategory(categoryRaw);
        if (!category) {
          allErrors.push({
            row: absoluteRow,
            reason: `Unrecognised category: "${categoryRaw}"`,
          });
          return;
        }

        // Subcategory
        const subcategoryRaw =
          colIdx.subcategory !== -1 && row[colIdx.subcategory] != null
            ? String(row[colIdx.subcategory]).trim()
            : '';
        const subcategorySlug = subcategoryRaw ? subcategoryToSlug(subcategoryRaw) : null;
        const matchedSubcat = subcategorySlug
          ? subcats.find((s) => s.slug === subcategorySlug)
          : null;
        const subcategoryId = matchedSubcat?.id ?? null;

        // Slug — skip if already exists (duplicate)
        const slug = nameToSlug(name);
        if (existingSlugs.has(slug)) {
          sheetSkipped++;
          return;
        }
        // Reserve slug so we don't insert duplicates within the same batch
        existingSlugs.add(slug);

        toInsert.push({
          uploaded_by:    user.id,
          name,
          slug,
          category,
          subcategory_id:   subcategoryId,
          subcategory_slug: subcategorySlug,
          brand,
          size_variant:   sizeVariant,
          unit_of_measure: unitOfMeasure,
          base_price:     0,     // admin sets prices later
          moq:            1,
          stock_status:   'in_stock',
          is_approved:    true,
          is_active:      true,
        });
        sheetImported++;
      });

      // Batch insert for this sheet (chunked at 500 rows to stay within limits)
      const CHUNK = 500;
      for (let i = 0; i < toInsert.length; i += CHUNK) {
        const chunk = toInsert.slice(i, i + CHUNK);
        const { error: insertError } = await supabase.from('products').insert(chunk);
        if (insertError) {
          console.error('[IMPORT] Batch insert error on sheet:', sheetName, insertError.message);
          // Mark all rows in this chunk as errored
          chunk.forEach((p) => {
            allErrors.push({ row: 0, reason: `DB insert failed for "${p.name}": ${insertError.message}` });
          });
          sheetImported -= chunk.length;
        }
      }

      console.log('[IMPORT] Sheet', sheetName, '→ imported:', sheetImported, 'skipped:', sheetSkipped);
      totalImported += sheetImported;
      totalSkipped  += sheetSkipped;
    }

    return NextResponse.json({
      data: {
        imported: totalImported,
        skipped:  totalSkipped,
        errors:   allErrors,
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
