/**
 * POST /api/admin/products/import
 *
 * Accepts a multipart form with a single .xlsx file and bulk-inserts all
 * product rows into the products table.
 *
 * Supports our specific Excel format:
 *   - "Housekeeping" sheet: headers at ROW 5 → SL.No | Item Descriptions | size/brand | units | Category | Sub-category | Image Urls
 *   - "Stationery" sheet:   headers at ROW 4 → SL.No | Item Descriptions | size/brand | Qty   | Category | Sub-category
 *
 * Logic per sheet:
 *   1. Find the header row (first row containing "Item Descriptions")
 *   2. Determine column indices from that header row
 *   3. Skip rows where column A (SL.No) is not a finite number — those are
 *      section-header rows like "BROOMS & CLOTH"
 *   4. Map each product row to our DB schema (unit enum, category enum, slug)
 *   5. INSERT new products; skip rows whose slug already exists in the DB
 *   6. Batch insert in chunks of 50 for reliability
 *
 * Returns:
 *   { data: { imported, skipped, errors: [{ row, name, reason }] }, error: null }
 *
 * Admin-only — returns 403 for non-admin sessions.
 */

import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Enums } from '@/types/database';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow up to 60 seconds for bulk imports

// ---------------------------------------------------------------------------
// Unit-of-measure mapping
// ---------------------------------------------------------------------------

const UNIT_MAP: Record<string, Enums<'unit_of_measure'>> = {
  '1 no':   'piece',
  '1 nos':  'piece',
  'nos':    'piece',
  'no':     'piece',
  'piece':  'piece',
  'pieces': 'piece',
  'ream':   'ream',
  '1 pkt':  'pkt',
  '1pkt':   'pkt',
  'pkt':    'pkt',
  'packet': 'pkt',
  '1 box':  'box',
  'box':    'box',
  '1 kg':   'kg',
  '1kg':    'kg',
  'kg':     'kg',
  '1 can':  'can',
  '1can':   'can',
  'can':    'can',
  '1 ltr':  'liter',
  '1 litre':'liter',
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
 * Falls back to 'housekeeping_materials' when no match is found.
 *
 * @param raw - Raw string from the Excel "Category" column
 * @returns Matched product_category enum value
 */
function mapCategory(raw: string): Enums<'product_category'> {
  const s = raw.toLowerCase().trim();
  if (s.includes('housekeeping'))                   return 'housekeeping_materials';
  if (s.includes('chemical') || s.includes('cleaning')) return 'cleaning_chemicals';
  if (s.includes('stationer'))                      return 'office_stationeries';
  if (s.includes('pantry'))                         return 'pantry_items';
  if (s.includes('facility') || s.includes('tool')) return 'facility_and_tools';
  if (s.includes('printing') || s.includes('print')) return 'printing_solution';
  // Default — admin can re-categorise later
  return 'housekeeping_materials';
}

// ---------------------------------------------------------------------------
// Slug helpers
// ---------------------------------------------------------------------------

/**
 * Converts a product name to a URL-safe slug.
 * Appends a random 4-char suffix to minimise collision across 394 products.
 * e.g. "Garbage Bag 30x40" → "garbage-bag-30x40-a3f7"
 *
 * @param name - Product name string
 * @returns Lowercase hyphenated slug with random suffix
 */
function nameToSlug(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const suffix = Math.random().toString(36).slice(2, 6);
  return `${base}-${suffix}`;
}

/**
 * Converts a subcategory display name from Excel to a slug.
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

// ---------------------------------------------------------------------------
// Description generator
// ---------------------------------------------------------------------------

/**
 * Generates a standard B2B product description from name and category.
 *
 * @param name     - Product name
 * @param category - Mapped product_category value
 * @param variant  - Optional size/variant string
 * @returns Ready-to-use description string
 */
function generateDescription(
  name: string,
  category: Enums<'product_category'>,
  variant: string | null
): string {
  const label = variant ? `${name} (${variant})` : name;
  const categoryLabels: Record<Enums<'product_category'>, string> = {
    housekeeping_materials: 'housekeeping and facility upkeep',
    cleaning_chemicals:     'industrial cleaning and sanitation',
    pantry_items:           'pantry and refreshment services',
    office_stationeries:    'office administration and stationery',
    facility_and_tools:     'facility maintenance and tools',
    printing_solution:      'printing and document solutions',
  };
  const use = categoryLabels[category] ?? 'commercial and institutional use';
  return (
    `Premium quality ${label} for ${use}. ` +
    `Ideal for hotels, offices, hospitals, and restaurants. ` +
    `Available for bulk orders with competitive B2B pricing.`
  );
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
 * Processes an uploaded .xlsx file and bulk-inserts products into Supabase.
 * Existing products (matched by slug) are skipped, not overwritten.
 * Returns a summary of inserted, skipped, and errored rows.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    console.log('[IMPORT] Step 1: Request received');

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
    console.log('[IMPORT] Step 2: File received, name:', fileObj.name, 'size:', fileObj.size);

    if (!fileObj.name.endsWith('.xlsx')) {
      return NextResponse.json(
        { data: null, error: 'Only .xlsx files are supported' },
        { status: 400 }
      );
    }

    // 3. Read the Excel workbook
    const arrayBuffer = await fileObj.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    console.log('[IMPORT] Step 3: File buffer read, length:', buffer.length);

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    console.log('[IMPORT] Step 4: Workbook parsed, sheets:', workbook.SheetNames);

    const supabase = createAdminClient();

    // Pre-fetch existing slugs to skip duplicates
    const existingResult = await supabase.from('products').select('slug');
    const existingSlugs = new Set((existingResult.data ?? []).map((p) => p.slug));

    // Pre-fetch subcategories for ID lookup
    const subcatsResult = await supabase.from('subcategories').select('id, slug');
    const subcats = subcatsResult.data ?? [];

    // Accumulators
    let totalInserted = 0;
    let totalSkipped  = 0;
    const allErrors: RowError[] = [];

    // 5. Process each sheet
    for (const sheetName of workbook.SheetNames) {
      const sheet   = workbook.Sheets[sheetName];
      const rawRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });

      // Find the header row — first row containing "Item Descriptions"
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

      // Locate column indices by header text — use .includes() for resilience
      const colIdx = {
        slNo:        headerRow.findIndex((h) => typeof h === 'string' && h.toLowerCase().includes('sl')),
        name:        headerRow.findIndex((h) => typeof h === 'string' && h.toLowerCase().includes('item descriptions')),
        sizeBrand:   headerRow.findIndex((h) => typeof h === 'string' && (
          h.toLowerCase().includes('size') || h.toLowerCase().includes('brand')
        )),
        unit:        headerRow.findIndex((h) => typeof h === 'string' && (
          h.toLowerCase().includes('unit') ||
          h.toLowerCase().includes('qty') ||
          h.toLowerCase() === 'qty'
        )),
        category:    headerRow.findIndex((h) => typeof h === 'string' && h.toLowerCase().includes('category') && !h.toLowerCase().includes('sub')),
        subcategory: headerRow.findIndex((h) => typeof h === 'string' && h.toLowerCase().includes('sub')),
        imageUrl:    headerRow.findIndex((h) => typeof h === 'string' && (
          h.toLowerCase().includes('image') || h.toLowerCase().includes('url')
        )),
      };

      console.log('[IMPORT] Sheet:', sheetName, 'column indices:', colIdx);

      const dataRows = rawRows.slice(headerRowIndex + 1);

      // Count product rows (numeric SL.No)
      const slNoCol = colIdx.slNo === -1 ? 0 : colIdx.slNo;
      const productRows = dataRows.filter((row) => {
        const slValue = Array.isArray(row) ? row[slNoCol] : undefined;
        return typeof slValue === 'number' && isFinite(slValue);
      });
      console.log('[IMPORT] Step 5: Found', productRows.length, 'product rows in sheet:', sheetName);

      // Rows to insert for this sheet
      const toInsert: Array<{
        uploaded_by:      string;
        name:             string;
        slug:             string;
        short_description:string;
        description:      string;
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
        gst_rate:         number;
        tags:             string[];
      }> = [];

      // Track slugs within this batch to avoid within-file duplicates
      const batchSlugs = new Set<string>();

      dataRows.forEach((rawRow, index) => {
        const row         = rawRow as unknown[];
        const absoluteRow = headerRowIndex + 2 + index; // 1-based Excel row

        if (!Array.isArray(row)) return;

        const slValue = row[slNoCol];

        // Skip section-header rows — non-numeric SL.No
        if (typeof slValue !== 'number' || !isFinite(slValue)) return;

        // Product name
        const nameRaw = colIdx.name !== -1 ? row[colIdx.name] : undefined;
        const name    = typeof nameRaw === 'string' ? nameRaw.trim() : String(nameRaw ?? '').trim();
        if (!name) {
          allErrors.push({ row: absoluteRow, name: '', reason: 'Empty product name' });
          return;
        }

        // Size/Brand — store as size_variant (we don't separate brand in this Excel)
        const sizeBrandRaw =
          colIdx.sizeBrand !== -1 && row[colIdx.sizeBrand] != null
            ? String(row[colIdx.sizeBrand]).trim()
            : '';
        const sizeVariant = sizeBrandRaw || null;

        // Unit of measure
        const unitRaw = colIdx.unit !== -1 && row[colIdx.unit] != null
          ? String(row[colIdx.unit]).trim()
          : '';
        const unitOfMeasure = mapUnit(unitRaw);

        // Category — always has a value (defaults to housekeeping_materials)
        const categoryRaw =
          colIdx.category !== -1 && row[colIdx.category] != null
            ? String(row[colIdx.category]).trim()
            : '';
        const category = mapCategory(categoryRaw);

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

        // Image URLs — split by comma, trim each
        const imageUrlRaw =
          colIdx.imageUrl !== -1 && row[colIdx.imageUrl] != null
            ? String(row[colIdx.imageUrl]).trim()
            : '';
        const images: string[] = imageUrlRaw
          ? imageUrlRaw.split(',').map((u) => u.trim()).filter(Boolean)
          : [];
        const thumbnailUrl = images[0] ?? null;

        // Auto-generate slug (with suffix for uniqueness across 394 products)
        let slug = nameToSlug(name);
        // Ensure uniqueness — re-roll suffix if collision
        while (existingSlugs.has(slug) || batchSlugs.has(slug)) {
          slug = nameToSlug(name);
        }

        // Skip if we somehow still can't get a unique slug
        if (batchSlugs.has(slug)) {
          totalSkipped++;
          return;
        }
        batchSlugs.add(slug);

        // Description — auto-generate
        const description      = generateDescription(name, category, sizeVariant);
        const shortDescription = name;

        toInsert.push({
          uploaded_by:      user.id,
          name,
          slug,
          short_description: shortDescription,
          description,
          category,
          subcategory_id:   subcategoryId,
          subcategory_slug: subcategorySlug,
          brand:            null, // Excel mixes size + brand into one column — stored as size_variant
          size_variant:     sizeVariant,
          unit_of_measure:  unitOfMeasure,
          base_price:       0,   // Admin sets prices after import
          moq:              1,
          stock_status:     'in_stock',
          is_approved:      true,
          is_active:        true,
          thumbnail_url:    thumbnailUrl,
          images,
          specifications:   {},
          gst_rate:         18,
          tags:             [],
        });
      });

      // -----------------------------------------------------------------------
      // Batch INSERT in chunks of 50
      // -----------------------------------------------------------------------
      const CHUNK = 50;
      let sheetInserted = 0;
      let sheetSkipped  = 0;

      for (let i = 0; i < toInsert.length; i += CHUNK) {
        const chunk = toInsert.slice(i, i + CHUNK);

        const { error: insertError } = await supabase.from('products').insert(chunk);

        if (insertError) {
          console.error('[IMPORT] Batch insert error on sheet:', sheetName, insertError.message);

          // If it's a unique-constraint error, try row-by-row to isolate the duplicate
          if (insertError.message.includes('duplicate') || insertError.message.includes('unique')) {
            for (const product of chunk) {
              const { error: singleError } = await supabase.from('products').insert(product);
              if (singleError) {
                if (singleError.message.includes('duplicate') || singleError.message.includes('unique')) {
                  sheetSkipped++;
                } else {
                  allErrors.push({
                    row:    0,
                    name:   product.name,
                    reason: `DB error: ${singleError.message}`,
                  });
                }
              } else {
                sheetInserted++;
              }
            }
          } else {
            chunk.forEach((p) => {
              allErrors.push({
                row:    0,
                name:   p.name,
                reason: `DB insert failed: ${insertError.message}`,
              });
            });
          }
        } else {
          sheetInserted += chunk.length;
        }
      }

      console.log(
        '[IMPORT] Step 6: Inserted', sheetInserted,
        'products from sheet:', sheetName,
        '| skipped:', sheetSkipped,
      );

      totalInserted += sheetInserted;
      totalSkipped  += sheetSkipped;
    }

    console.log('[IMPORT] Done — total inserted:', totalInserted, 'skipped:', totalSkipped, 'errors:', allErrors.length);

    return NextResponse.json({
      data: {
        imported: totalInserted,
        skipped:  totalSkipped,
        errors:   allErrors,
        message:  `Successfully imported ${totalInserted} products`,
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
