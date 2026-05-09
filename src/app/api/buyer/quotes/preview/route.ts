/**
 * POST /api/buyer/quotes/preview
 *
 * Parses an uploaded Excel file (same format as /quotes/upload) and matches
 * each requested product against the live catalog. Returns matched items with
 * their current rate, GST%, and gross amount, plus a separate list of items
 * that are not yet in the catalog. No database writes occur.
 *
 * Body: multipart/form-data with one field:
 *   file — .xlsx or .xls file
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';

const MAX_SIZE_BYTES = 5 * 1024 * 1024;

const REQUIRED_HEADERS = [
  'product name',
  'size / description',
  'unit',
  'quantity',
  'preferred brand',
  'target price',
];

function normaliseHeader(h: unknown): string {
  return String(h ?? '').trim().toLowerCase();
}

export interface PreviewMatchedItem {
  requested_name: string;
  requested_qty: number;
  requested_unit: string;
  product_id: string;
  catalog_name: string;
  brand: string | null;
  base_price: number;
  gst_rate: number;
  gross_per_unit: number;
  gross_total: number;
}

export interface PreviewUnmatchedItem {
  requested_name: string;
  requested_qty: number;
  requested_unit: string;
}

export interface PreviewResult {
  matched: PreviewMatchedItem[];
  unmatched: PreviewUnmatchedItem[];
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<{ data: PreviewResult | null; error: string | null }>> {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    const form = await request.formData();
    const file = form.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ data: null, error: 'Excel file is required' }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
      return NextResponse.json(
        { data: null, error: 'Only .xlsx and .xls files are accepted' },
        { status: 400 },
      );
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { data: null, error: 'File size must be under 5 MB' },
        { status: 400 },
      );
    }

    // ── Parse Excel ──────────────────────────────────────────────────────────
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json(
        { data: null, error: 'Excel file appears to be empty' },
        { status: 400 },
      );
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });

    if (rows.length < 2) {
      return NextResponse.json(
        { data: null, error: 'Excel file must have a header row and at least one data row' },
        { status: 400 },
      );
    }

    // ── Validate headers ─────────────────────────────────────────────────────
    const headerRow = (rows[0] as unknown[]).map(normaliseHeader);
    const missingHeaders = REQUIRED_HEADERS.filter((h) => !headerRow.includes(h));
    if (missingHeaders.length > 0) {
      return NextResponse.json(
        {
          data: null,
          error:
            `Missing required columns: ${missingHeaders.map((h) => `"${h}"`).join(', ')}. ` +
            'Expected: Product Name, Size / Description, Unit, Quantity, Preferred Brand, Target Price',
        },
        { status: 400 },
      );
    }

    const idx: Record<string, number> = {};
    for (const required of REQUIRED_HEADERS) {
      idx[required] = headerRow.indexOf(required);
    }

    // ── Extract requested items ──────────────────────────────────────────────
    const requestedItems: Array<{ name: string; qty: number; unit: string }> = [];
    for (let rowNum = 1; rowNum < rows.length; rowNum++) {
      const row = rows[rowNum] as unknown[];
      const name = String(row[idx['product name']] ?? '').trim();
      if (!name) continue;
      const qtyRaw = row[idx['quantity']];
      const qty =
        typeof qtyRaw === 'number' ? qtyRaw : parseInt(String(qtyRaw), 10) || 1;
      const unit = String(row[idx['unit']] ?? 'piece').trim() || 'piece';
      requestedItems.push({ name, qty, unit });
    }

    if (requestedItems.length === 0) {
      return NextResponse.json(
        { data: null, error: 'No valid product rows found in the Excel file' },
        { status: 400 },
      );
    }

    // ── Match each item against the product catalog ──────────────────────────
    const supabase = createAdminClient();
    const matched: PreviewMatchedItem[] = [];
    const unmatched: PreviewUnmatchedItem[] = [];

    for (const item of requestedItems) {
      const { data: products } = await supabase
        .from('products')
        .select('id, name, brand, base_price, gst_rate')
        .eq('is_active', true)
        .eq('is_approved', true)
        .gt('base_price', 0)
        .ilike('name', `%${item.name}%`)
        .order('total_orders', { ascending: false })
        .limit(1);

      if (products && products.length > 0) {
        const p = products[0] as {
          id: string;
          name: string;
          brand: string | null;
          base_price: number;
          gst_rate: number;
        };
        const gstRate = p.gst_rate ?? 0;
        const basePrice = p.base_price ?? 0;
        const grossPerUnit = basePrice * (1 + gstRate / 100);
        matched.push({
          requested_name: item.name,
          requested_qty: item.qty,
          requested_unit: item.unit,
          product_id: p.id,
          catalog_name: p.name,
          brand: p.brand,
          base_price: basePrice,
          gst_rate: gstRate,
          gross_per_unit: grossPerUnit,
          gross_total: grossPerUnit * item.qty,
        });
      } else {
        unmatched.push({
          requested_name: item.name,
          requested_qty: item.qty,
          requested_unit: item.unit,
        });
      }
    }

    return NextResponse.json({ data: { matched, unmatched }, error: null });
  } catch (error) {
    console.error('[api/buyer/quotes/preview POST]', error);
    return NextResponse.json(
      { data: null, error: 'Failed to process Excel file' },
      { status: 500 },
    );
  }
}
