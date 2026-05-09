/**
 * POST /api/buyer/quotes/preview
 *
 * Parses an uploaded Excel file and matches each requested product against
 * the live catalog using a multi-strategy approach:
 *   1. Full name ILIKE match
 *   2. Individual keyword ILIKE matches (skipping stop-words)
 *   3. Tag-array overlap search
 *
 * For each candidate set, the best match is chosen by scoring name overlap,
 * brand overlap, and tag overlap. Returns matched items with rate / GST /
 * per-line gross, plus unmatched items. No database writes occur.
 *
 * Excel columns (row 1 headers, case-insensitive):
 *   Product Name | Size / Description | Unit | Quantity | Preferred Brand
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
];

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'for', 'with', 'of', 'and', 'or', 'in', 'on',
  'at', 'to', 'by', 'is', 'are', 'it', 'as', 'be', 'ml', 'gm', 'kg',
  'ltr', 'lts', 'nos', 'pcs', 'pkt', 'pc',
]);

function normaliseHeader(h: unknown): string {
  return String(h ?? '').trim().toLowerCase();
}

/** Extract meaningful search keywords from a product name */
function extractKeywords(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/[()[\]/\\|#@%*+]/g, ' ')
    .split(/[\s,.\-_]+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w))
    .slice(0, 6);
}

interface CatalogProduct {
  id: string;
  name: string;
  brand: string | null;
  size_variant: string | null;
  base_price: number;
  gst_rate: number;
  tags: string[];
}

interface RequestedItem {
  name: string;
  description: string;
  qty: number;
  unit: string;
  brand: string;
}

/** Score a catalog product against the requested item — higher is better */
function scoreMatch(p: CatalogProduct, item: RequestedItem): number {
  let score = 0;
  const pName = p.name.toLowerCase();
  const reqName = item.name.toLowerCase();
  const reqBrand = item.brand.toLowerCase();

  // Name similarity
  if (pName === reqName) {
    score += 100;
  } else if (pName.includes(reqName) || reqName.includes(pName)) {
    score += 60;
  } else {
    const reqWords = new Set(reqName.split(/\s+/).filter((w) => w.length > 2));
    const pWords = pName.split(/\s+/).filter((w) => w.length > 2);
    const shared = pWords.filter((w) => reqWords.has(w)).length;
    score += shared * 15;
  }

  // Brand match
  if (reqBrand && p.brand) {
    const pBrand = p.brand.toLowerCase();
    if (pBrand === reqBrand) score += 30;
    else if (pBrand.includes(reqBrand) || reqBrand.includes(pBrand)) score += 15;
  }

  // Size / description hint
  if (item.description && p.size_variant) {
    const desc = item.description.toLowerCase();
    const sv = p.size_variant.toLowerCase();
    if (sv.includes(desc) || desc.includes(sv)) score += 10;
  }

  // Tag bonus
  if (Array.isArray(p.tags) && p.tags.length > 0) {
    const reqWords = reqName.split(/\s+/);
    const tagHit = p.tags.some((t) =>
      reqWords.some((w) => w.length > 2 && t.toLowerCase().includes(w)),
    );
    if (tagHit) score += 12;
  }

  return score;
}

/** Pick the highest-scoring product from a candidate list */
function pickBest(candidates: CatalogProduct[], item: RequestedItem): CatalogProduct {
  let best = candidates[0];
  let bestScore = scoreMatch(best, item);
  for (let i = 1; i < candidates.length; i++) {
    const s = scoreMatch(candidates[i], item);
    if (s > bestScore) { bestScore = s; best = candidates[i]; }
  }
  return best;
}

export interface PreviewMatchedItem {
  requested_name: string;
  requested_qty: number;
  requested_unit: string;
  product_id: string;
  catalog_name: string;
  brand: string | null;
  size_variant: string | null;
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

const SELECT_COLS =
  'id, name, brand, size_variant, base_price, gst_rate, tags, total_orders' as const;

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
      return NextResponse.json({ data: null, error: 'Excel file is empty' }, { status: 400 });
    }

    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: '' });

    if (rows.length < 2) {
      return NextResponse.json(
        { data: null, error: 'Excel must have a header row and at least one data row' },
        { status: 400 },
      );
    }

    // ── Validate headers ─────────────────────────────────────────────────────
    const headerRow = (rows[0] as unknown[]).map(normaliseHeader);
    const missing = REQUIRED_HEADERS.filter((h) => !headerRow.includes(h));
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

    // ── Extract requested items from rows ────────────────────────────────────
    const requestedItems: RequestedItem[] = [];
    for (let r = 1; r < rows.length; r++) {
      const row = rows[r] as unknown[];
      const name = String(row[idx['product name']] ?? '').trim();
      if (!name) continue;
      const qtyRaw = row[idx['quantity']];
      const qty = typeof qtyRaw === 'number' ? qtyRaw : (parseInt(String(qtyRaw), 10) || 1);
      requestedItems.push({
        name,
        description: String(row[idx['size / description']] ?? '').trim(),
        qty: Math.max(1, qty),
        unit: String(row[idx['unit']] ?? 'piece').trim() || 'piece',
        brand: String(row[idx['preferred brand']] ?? '').trim(),
      });
    }

    if (requestedItems.length === 0) {
      return NextResponse.json({ data: null, error: 'No product rows found' }, { status: 400 });
    }

    // ── Match each item against catalog with multi-strategy search ───────────
    const supabase = createAdminClient();
    const matched: PreviewMatchedItem[] = [];
    const unmatched: PreviewUnmatchedItem[] = [];

    for (const item of requestedItems) {
      const base = supabase
        .from('products')
        .select(SELECT_COLS)
        .eq('is_active', true)
        .eq('is_approved', true)
        .gt('base_price', 0);

      let found: CatalogProduct | null = null;

      // ── Strategy 1: full name match ───────────────────────────────────────
      {
        const { data } = await base.ilike('name', `%${item.name}%`)
          .order('total_orders', { ascending: false })
          .limit(5);
        if (data && data.length > 0) {
          found = pickBest(data as CatalogProduct[], item);
        }
      }

      // ── Strategy 2: try each meaningful keyword ───────────────────────────
      if (!found) {
        const keywords = extractKeywords(item.name);
        for (const kw of keywords) {
          const { data } = await base.ilike('name', `%${kw}%`)
            .order('total_orders', { ascending: false })
            .limit(8);
          if (data && data.length > 0) {
            found = pickBest(data as CatalogProduct[], item);
            break;
          }
        }
      }

      // ── Strategy 3: tag overlap with keywords ─────────────────────────────
      if (!found) {
        const keywords = extractKeywords(item.name);
        for (const kw of keywords) {
          // Supabase array contains: tags @> ARRAY[kw]
          const { data } = await supabase
            .from('products')
            .select(SELECT_COLS)
            .eq('is_active', true)
            .eq('is_approved', true)
            .gt('base_price', 0)
            .contains('tags', [kw])
            .order('total_orders', { ascending: false })
            .limit(5);
          if (data && data.length > 0) {
            found = pickBest(data as CatalogProduct[], item);
            break;
          }
        }
      }

      // ── Strategy 4: brand-name as keyword fallback ────────────────────────
      if (!found && item.brand) {
        const { data } = await base.ilike('name', `%${item.brand}%`)
          .order('total_orders', { ascending: false })
          .limit(5);
        if (data && data.length > 0) {
          found = pickBest(data as CatalogProduct[], item);
        }
      }

      if (found) {
        const gst = found.gst_rate ?? 0;
        const rate = found.base_price ?? 0;
        const grossUnit = rate * (1 + gst / 100);
        matched.push({
          requested_name: item.name,
          requested_qty: item.qty,
          requested_unit: item.unit,
          product_id: found.id,
          catalog_name: found.name,
          brand: found.brand,
          size_variant: found.size_variant,
          base_price: rate,
          gst_rate: gst,
          gross_per_unit: grossUnit,
          gross_total: grossUnit * item.qty,
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
    return NextResponse.json({ data: null, error: 'Failed to process file' }, { status: 500 });
  }
}
