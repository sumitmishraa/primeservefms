/**
 * POST /api/buyer/quotes/preview
 *
 * Parses an uploaded Excel file and matches each requested product against
 * the live catalog using the two-layer matching engine:
 *
 *   Layer 1 — In-memory keyword + synonym scoring (1 DB query, instant)
 *   Layer 2 — OpenAI GPT-4o-mini fallback for items Layer 1 misses
 *             Results are cached in product_aliases for free future matches.
 *
 * Returns matched items with live pricing + unmatched items.
 * No permanent DB writes occur here (alias caching is the only side-effect).
 *
 * Excel columns (row 1 headers, case-insensitive):
 *   Product Name | Size / Description | Unit | Quantity | Preferred Brand
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 30;

import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';
import { matchItems } from '@/lib/matching/matcher';
import type { RequestedItem } from '@/lib/matching/matcher';

const MAX_SIZE_BYTES = 5 * 1024 * 1024;

const REQUIRED_HEADERS = [
  'product name',
  'size / description',
  'unit',
  'quantity',
  'preferred brand',
];

function normaliseHeader(h: unknown): string {
  return String(h ?? '').trim().toLowerCase();
}

// ---------------------------------------------------------------------------
// Response types (exported so the UI can type-check against them)
// ---------------------------------------------------------------------------

export interface PreviewMatchedItem {
  requested_name:  string;
  requested_qty:   number;
  requested_unit:  string;
  product_id:      string;
  catalog_name:    string;
  brand:           string | null;
  size_variant:    string | null;
  base_price:      number;
  gst_rate:        number;
  gross_per_unit:  number;
  gross_total:     number;
  match_strategy:  'alias' | 'keyword' | 'ai';
}

export interface PreviewUnmatchedItem {
  requested_name: string;
  requested_qty:  number;
  requested_unit: string;
}

export interface PreviewResult {
  matched:   PreviewMatchedItem[];
  unmatched: PreviewUnmatchedItem[];
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

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

    // ── Parse Excel ────────────────────────────────────────────────────────
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const workbook   = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName  = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json({ data: null, error: 'Excel file is empty' }, { status: 400 });
    }

    const sheet = workbook.Sheets[sheetName];
    const rows  = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });

    if (rows.length < 2) {
      return NextResponse.json(
        { data: null, error: 'Excel must have a header row and at least one data row' },
        { status: 400 },
      );
    }

    // ── Validate headers ───────────────────────────────────────────────────
    const headerRow = (rows[0] as unknown[]).map(normaliseHeader);
    const missing   = REQUIRED_HEADERS.filter((h) => !headerRow.includes(h));
    if (missing.length > 0) {
      return NextResponse.json(
        {
          data: null,
          error:
            `Missing columns: ${missing.map((h) => `"${h}"`).join(', ')}. ` +
            'Expected: Product Name | Size / Description | Unit | Quantity | Preferred Brand',
        },
        { status: 400 },
      );
    }

    const idx: Record<string, number> = {};
    for (const h of REQUIRED_HEADERS) idx[h] = headerRow.indexOf(h);

    // ── Extract requested items ────────────────────────────────────────────
    const requestedItems: RequestedItem[] = [];
    for (let r = 1; r < rows.length; r++) {
      const row  = rows[r] as unknown[];
      const name = String(row[idx['product name']] ?? '').trim();
      if (!name) continue;
      const qtyRaw = row[idx['quantity']];
      const qty    = typeof qtyRaw === 'number' ? qtyRaw : (parseInt(String(qtyRaw), 10) || 1);
      requestedItems.push({
        name,
        description: String(row[idx['size / description']] ?? '').trim(),
        qty:  Math.max(1, qty),
        unit: String(row[idx['unit']] ?? 'piece').trim() || 'piece',
        brand: String(row[idx['preferred brand']] ?? '').trim(),
      });
    }

    if (requestedItems.length === 0) {
      return NextResponse.json({ data: null, error: 'No product rows found in the file' }, { status: 400 });
    }

    // ── Run matching engine ────────────────────────────────────────────────
    const supabase    = createAdminClient();
    const matchResults = await matchItems(requestedItems, supabase);

    // ── Build response ─────────────────────────────────────────────────────
    const matched:   PreviewMatchedItem[]   = [];
    const unmatched: PreviewUnmatchedItem[] = [];

    for (const result of matchResults) {
      if (result.product && result.strategy !== 'unmatched') {
        const gst      = result.product.gst_rate ?? 0;
        const rate     = result.product.base_price ?? 0;
        const grossUnit = rate * (1 + gst / 100);
        matched.push({
          requested_name:  result.item.name,
          requested_qty:   result.item.qty,
          requested_unit:  result.item.unit,
          product_id:      result.product.id,
          catalog_name:    result.product.name,
          brand:           result.product.brand,
          size_variant:    result.product.size_variant,
          base_price:      rate,
          gst_rate:        gst,
          gross_per_unit:  grossUnit,
          gross_total:     grossUnit * result.item.qty,
          match_strategy:  result.strategy as 'alias' | 'keyword' | 'ai',
        });
      } else {
        unmatched.push({
          requested_name: result.item.name,
          requested_qty:  result.item.qty,
          requested_unit: result.item.unit,
        });
      }
    }

    return NextResponse.json({ data: { matched, unmatched }, error: null });
  } catch (error) {
    console.error('[api/buyer/quotes/preview POST]', error);
    return NextResponse.json({ data: null, error: 'Failed to process file' }, { status: 500 });
  }
}
