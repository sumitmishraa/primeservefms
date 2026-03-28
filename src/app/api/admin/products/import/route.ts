/**
 * POST /api/admin/products/import
 *
 * Accepts a multipart form with a single .xlsx file and bulk-upserts all
 * product rows into the products table.
 *
 * Logic per sheet:
 *   1. Find the header row (first row containing "Item Descriptions")
 *   2. Determine column indices from that header row
 *   3. Skip rows where column A (SL.No) is not a finite number — those are
 *      section-header rows like "BROOMS & CLOTH" that appear in the catalog
 *   4. Map each product row to our DB schema (unit enum, category enum, slug)
 *   5. Look up subcategory_id from the subcategories table by slug
 *   6. UPSERT on slug: update if slug exists, insert if not
 *   7. Additional columns handled: Image URL, Color, HSN Code, GST Rate, Description
 *
 * Returns:
 *   { imported, updated, skipped, errors: [{ row, name, reason }] }
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

/**
 * Validates a GST rate. Only 0, 5, 12, 18, and 28 are valid Indian GST slabs.
 * Returns 0 for any invalid value.
 *
 * @param raw - Raw parsed number from Excel
 * @returns Valid GST rate or 0
 */
function parseGstRate(raw: number): number {
  const valid = [0, 5, 12, 18, 28];
  return valid.includes(raw) ? raw : 0;
}

// ---------------------------------------------------------------------------
// Row error type used in the response
// ---------------------------------------------------------------------------

interface RowError {
  row:    number;
  name:   string;
  reason: string;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

/**
 * Processes an uploaded .xlsx file and bulk-upserts products into Supabase.
 * New products are inserted; products whose slug already exists are updated.
 * Returns a summary of inserted, updated, and errored rows.
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

    const subcats      = subcatsResult.data ?? [];
    const existingSlugs = new Set((existingResult.data ?? []).map((p) => p.slug));

    // Accumulators
    let totalInserted = 0;
    let totalUpdated  = 0;
    const allErrors: RowError[] = [];

    // 5. Process each sheet
    for (const sheetName of workbook.SheetNames) {
      const sheet   = workbook.Sheets[sheetName];
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
        // Enhanced columns
        imageUrl:    headerRow.findIndex((h) => typeof h === 'string' && (
          h.toLowerCase().includes('image url') ||
          h.toLowerCase() === 'image_url' ||
          h.toLowerCase() === 'image urls'
        )),
        color:       headerRow.findIndex((h) => typeof h === 'string' && h.toLowerCase() === 'color'),
        hsnCode:     headerRow.findIndex((h) => typeof h === 'string' && (
          h.toLowerCase() === 'hsn code' || h.toLowerCase() === 'hsn_code'
        )),
        gstRate:     headerRow.findIndex((h) => typeof h === 'string' && (
          h.toLowerCase() === 'gst rate' || h.toLowerCase() === 'gst_rate'
        )),
        description: headerRow.findIndex((h) => typeof h === 'string' && h.toLowerCase() === 'description'),
      };

      const dataRows = rawRows.slice(headerRowIndex + 1);

      const productRowCount = dataRows.filter((row) => {
        const slValue = Array.isArray(row) ? row[colIdx.slNo === -1 ? 0 : colIdx.slNo] : undefined;
        return typeof slValue === 'number' && isFinite(slValue);
      }).length;

      console.log('[IMPORT] Processing sheet:', sheetName, '— found', productRowCount, 'product rows');

      // Rows to insert/update for this sheet
      const toInsert: Array<{
        uploaded_by:      string;
        name:             string;
        slug:             string;
        category:         Enums<'product_category'>;
        subcategory_id:   string | null;
        subcategory_slug: string | null;
        brand:            string | null;
        size_variant:     string | null;
        unit_of_measure:  Enums<'unit_of_measure'>;
        base_price:       number;
        moq:              number;
        stock_status:     Enums<'stock_status'>;
        is_approved:      boolean;
        is_active:        boolean;
        thumbnail_url:    string | null;
        images:           string[];
        specifications:   Record<string, string>;
        hsn_code:         string | null;
        gst_rate:         number;
        description:      string | null;
      }> = [];

      const toUpdate: Array<typeof toInsert[number]> = [];

      // Track slugs processed in this batch to avoid within-file duplicates
      const batchSlugs = new Set<string>();

      dataRows.forEach((rawRow, index) => {
        const row          = rawRow as unknown[];
        const absoluteRow  = headerRowIndex + 2 + index; // 1-based Excel row number

        if (!Array.isArray(row)) return;

        const slNoCol = colIdx.slNo === -1 ? 0 : colIdx.slNo;
        const slValue = row[slNoCol];

        // Skip section-header rows — non-numeric SL.No
        if (typeof slValue !== 'number' || !isFinite(slValue)) return;

        // Extract name
        const nameRaw = colIdx.name !== -1 ? row[colIdx.name] : undefined;
        const name    = typeof nameRaw === 'string' ? nameRaw.trim() : '';
        if (!name) {
          allErrors.push({ row: absoluteRow, name: '', reason: 'Empty product name' });
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
            row:    absoluteRow,
            name,
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
        const matchedSubcat   = subcategorySlug
          ? subcats.find((s) => s.slug === subcategorySlug)
          : null;
        const subcategoryId   = matchedSubcat?.id ?? null;

        // Image URL (enhanced)
        const imageUrlRaw =
          colIdx.imageUrl !== -1 && row[colIdx.imageUrl] != null
            ? String(row[colIdx.imageUrl]).trim()
            : '';
        const thumbnailUrl = imageUrlRaw || null;
        const images: string[] = imageUrlRaw ? [imageUrlRaw] : [];

        // Color → specifications (enhanced)
        const colorRaw =
          colIdx.color !== -1 && row[colIdx.color] != null
            ? String(row[colIdx.color]).trim()
            : '';
        const specifications: Record<string, string> = colorRaw ? { color: colorRaw } : {};

        // HSN Code (enhanced)
        const hsnRaw =
          colIdx.hsnCode !== -1 && row[colIdx.hsnCode] != null
            ? String(row[colIdx.hsnCode]).trim()
            : '';
        const hsnCode = hsnRaw || null;

        // GST Rate (enhanced) — validate against Indian GST slabs
        const gstRaw =
          colIdx.gstRate !== -1 && row[colIdx.gstRate] != null
            ? parseFloat(String(row[colIdx.gstRate]))
            : 0;
        const gstRate = parseGstRate(isNaN(gstRaw) ? 0 : gstRaw);

        // Description (enhanced)
        const descriptionRaw =
          colIdx.description !== -1 && row[colIdx.description] != null
            ? String(row[colIdx.description]).trim()
            : '';
        const description = descriptionRaw || null;

        // Slug — generate from name
        const slug = nameToSlug(name);

        // Skip within-batch duplicates
        if (batchSlugs.has(slug)) return;
        batchSlugs.add(slug);

        const record = {
          uploaded_by:      user.id,
          name,
          slug,
          category,
          subcategory_id:   subcategoryId,
          subcategory_slug: subcategorySlug,
          brand,
          size_variant:     sizeVariant,
          unit_of_measure:  unitOfMeasure,
          base_price:       0,         // admin sets prices after import
          moq:              1,
          stock_status:     'in_stock' as Enums<'stock_status'>,
          is_approved:      true,
          is_active:        true,
          thumbnail_url:    thumbnailUrl,
          images,
          specifications,
          hsn_code:         hsnCode,
          gst_rate:         gstRate,
          description,
        };

        // Route to insert or update list based on whether slug already exists
        if (existingSlugs.has(slug)) {
          toUpdate.push(record);
        } else {
          existingSlugs.add(slug); // reserve for dedup across sheets
          toInsert.push(record);
        }
      });

      // -----------------------------------------------------------------------
      // Batch INSERT new products (chunked at 500 rows)
      // -----------------------------------------------------------------------
      const CHUNK = 500;
      let sheetInserted = 0;

      for (let i = 0; i < toInsert.length; i += CHUNK) {
        const chunk = toInsert.slice(i, i + CHUNK);
        const { error: insertError } = await supabase.from('products').insert(chunk);
        if (insertError) {
          console.error('[IMPORT] Batch insert error on sheet:', sheetName, insertError.message);
          chunk.forEach((p) => {
            allErrors.push({
              row:    0,
              name:   p.name,
              reason: `DB insert failed: ${insertError.message}`,
            });
          });
        } else {
          sheetInserted += chunk.length;
        }
      }

      // -----------------------------------------------------------------------
      // Batch UPDATE existing products (one upsert call per chunk)
      // We use upsert with onConflict:'slug' so existing rows are updated.
      // -----------------------------------------------------------------------
      let sheetUpdated = 0;

      for (let i = 0; i < toUpdate.length; i += CHUNK) {
        const chunk = toUpdate.slice(i, i + CHUNK);
        const { error: upsertError } = await supabase
          .from('products')
          .upsert(chunk, { onConflict: 'slug', ignoreDuplicates: false });
        if (upsertError) {
          console.error('[IMPORT] Batch upsert error on sheet:', sheetName, upsertError.message);
          chunk.forEach((p) => {
            allErrors.push({
              row:    0,
              name:   p.name,
              reason: `DB update failed: ${upsertError.message}`,
            });
          });
        } else {
          sheetUpdated += chunk.length;
        }
      }

      console.log(
        '[IMPORT] Sheet', sheetName,
        '→ inserted:', sheetInserted,
        'updated:',  sheetUpdated,
      );
      totalInserted += sheetInserted;
      totalUpdated  += sheetUpdated;
    }

    return NextResponse.json({
      data: {
        imported: totalInserted,
        updated:  totalUpdated,
        skipped:  0,          // skipping is no longer done — we upsert instead
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
