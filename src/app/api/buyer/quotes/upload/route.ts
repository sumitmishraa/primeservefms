/**
 * POST /api/buyer/quotes/upload
 *
 * Accepts a multipart form with:
 *   - title: string
 *   - file: .xlsx or .xls Excel file
 *
 * Parses the Excel file using the xlsx library, validates headers, stores
 * parsed structured items, and saves the source file URL for audit.
 *
 * Expected headers (row 1):
 *   Product Name | Size / Description | Unit | Quantity | Preferred Brand | Target Price
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ApiResponse } from '@/types';
import type { QuoteItem } from '../route';

const BUCKET = 'quote-documents';
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

// The exact header columns we expect (trimmed, case-insensitive comparison)
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

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<{ id: string }>>> {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    const form = await request.formData();
    const title = (form.get('title') as string | null)?.trim();
    const file = form.get('file') as File | null;

    if (!title) {
      return NextResponse.json({ data: null, error: 'Quote title is required' }, { status: 400 });
    }
    if (!file) {
      return NextResponse.json({ data: null, error: 'Excel file is required' }, { status: 400 });
    }

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (ext !== 'xlsx' && ext !== 'xls') {
      return NextResponse.json({ data: null, error: 'Only .xlsx and .xls files are accepted' }, { status: 400 });
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json({ data: null, error: 'File size must be under 5 MB' }, { status: 400 });
    }

    // ── Parse Excel ──────────────────────────────────────────────────────────
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    if (!sheetName) {
      return NextResponse.json({ data: null, error: 'Excel file appears to be empty' }, { status: 400 });
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { header: 1, defval: '' }) as unknown[][];

    if (rows.length < 2) {
      return NextResponse.json({ data: null, error: 'Excel file must have a header row and at least one data row' }, { status: 400 });
    }

    // ── Validate headers ─────────────────────────────────────────────────────
    const headerRow = (rows[0] as unknown[]).map(normaliseHeader);
    const missingHeaders = REQUIRED_HEADERS.filter((h) => !headerRow.includes(h));
    if (missingHeaders.length > 0) {
      return NextResponse.json({
        data: null,
        error: `Missing required columns: ${missingHeaders.map((h) => `"${h}"`).join(', ')}. ` +
          'Expected: Product Name, Size / Description, Unit, Quantity, Preferred Brand, Target Price',
      }, { status: 400 });
    }

    // Header index map
    const idx: Record<string, number> = {};
    for (const required of REQUIRED_HEADERS) {
      idx[required] = headerRow.indexOf(required);
    }

    // ── Parse data rows ──────────────────────────────────────────────────────
    const items: QuoteItem[] = [];
    for (let rowNum = 1; rowNum < rows.length; rowNum++) {
      const row = rows[rowNum] as unknown[];
      const productName = String(row[idx['product name']] ?? '').trim();
      if (!productName) continue; // skip blank rows

      const qtyRaw = row[idx['quantity']];
      const quantity = typeof qtyRaw === 'number' ? qtyRaw : parseInt(String(qtyRaw), 10);
      if (!quantity || quantity <= 0) {
        return NextResponse.json({
          data: null,
          error: `Row ${rowNum + 1}: Quantity must be a positive number for "${productName}"`,
        }, { status: 400 });
      }

      const tpRaw = row[idx['target price']];
      const target_price = typeof tpRaw === 'number' ? tpRaw : parseFloat(String(tpRaw)) || 0;

      items.push({
        product_name: productName,
        description: String(row[idx['size / description']] ?? '').trim(),
        unit: String(row[idx['unit']] ?? 'piece').trim() || 'piece',
        quantity,
        preferred_brand: String(row[idx['preferred brand']] ?? '').trim(),
        target_price,
        notes: '',
      });
    }

    if (items.length === 0) {
      return NextResponse.json({ data: null, error: 'No valid product rows found in the Excel file' }, { status: 400 });
    }

    const supabase = createAdminClient();

    // ── Upload source file to Supabase Storage ───────────────────────────────
    await supabase.storage.createBucket(BUCKET, { public: false, fileSizeLimit: MAX_SIZE_BYTES });

    const fileName = `${user.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, fileBuffer, {
        contentType: file.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: false,
      });

    if (uploadError) {
      console.error('[api/buyer/quotes/upload] storage upload error', uploadError);
      return NextResponse.json({ data: null, error: 'Failed to upload file. Please try again.' }, { status: 500 });
    }

    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(uploadData.path);

    // ── Insert quote request with parsed items + source URL ──────────────────
    const { data, error: insertError } = await supabase
      .from('quote_requests')
      .insert({
        buyer_id: user.id,
        title,
        items: items as unknown as Record<string, unknown>[],
        status: 'submitted' as const,
        document_url: publicUrl,
        notes: null,
      } as never)
      .select('id')
      .single();

    if (insertError) throw insertError;

    return NextResponse.json({ data: { id: (data as { id: string }).id }, error: null }, { status: 201 });
  } catch (error) {
    console.error('[api/buyer/quotes/upload POST]', error);
    return NextResponse.json({ data: null, error: 'Failed to submit quote request' }, { status: 500 });
  }
}
