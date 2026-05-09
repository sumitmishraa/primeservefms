/**
 * GET /api/admin/quotes — Paginated list of all quote requests with buyer info
 * Admin-only.
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';

export interface AdminQuoteItem {
  product_name: string;
  description: string;
  unit: string;
  quantity: number;
  preferred_brand: string;
  target_price: number;
  notes: string;
}

export interface AdminQuote {
  id: string;
  title: string;
  status: 'submitted' | 'under_review' | 'quoted' | 'accepted' | 'rejected';
  items: AdminQuoteItem[];
  notes: string | null;
  document_url: string | null;
  admin_notes: string | null;
  quoted_amount: number | null;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
  buyer: {
    id: string;
    full_name: string;
    company_name: string | null;
    email: string | null;
    phone: string | null;
  } | null;
}

export interface AdminQuotesResponse {
  quotes: AdminQuote[];
  total: number;
  page: number;
  per_page: number;
  status_counts: Record<string, number>;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await verifyAuth(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const status   = searchParams.get('status') ?? '';
    const search   = searchParams.get('search') ?? '';
    const page     = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const perPage  = Math.min(100, Math.max(1, parseInt(searchParams.get('per_page') ?? '25', 10)));
    const from     = (page - 1) * perPage;

    const supabase = createAdminClient();

    // Fetch all for status_counts, then page
    let query = supabase
      .from('quote_requests')
      .select('id, title, status, items, notes, document_url, admin_notes, quoted_amount, valid_until, created_at, updated_at, buyer_id');

    if (status && status !== 'all') {
      query = query.eq('status', status as 'submitted' | 'under_review' | 'quoted' | 'accepted' | 'rejected');
    }

    const { data: allRows, error: allErr } = await query.order('created_at', { ascending: false });
    if (allErr) throw allErr;

    const rows = allRows ?? [];

    // Count by status
    const status_counts: Record<string, number> = { all: rows.length };
    for (const r of rows) {
      status_counts[r.status] = (status_counts[r.status] ?? 0) + 1;
    }

    // Get buyer IDs for this page
    const pageRows = rows.slice(from, from + perPage);
    const buyerIds = [...new Set(pageRows.map((r: { buyer_id: string }) => r.buyer_id))];

    let buyerMap = new Map<string, AdminQuote['buyer']>();
    if (buyerIds.length > 0) {
      const { data: buyers } = await supabase
        .from('users')
        .select('id, full_name, company_name, email, phone')
        .in('id', buyerIds);
      buyerMap = new Map(
        (buyers ?? []).map((b: { id: string; full_name: string; company_name: string | null; email: string | null; phone: string | null }) => [b.id, b])
      );
    }

    // Filter by search (buyer name / company / title) — client-side on page slice + nearby
    let filtered = pageRows as Array<typeof rows[0]>;
    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = (rows as Array<typeof rows[0]>).filter((r) => {
        const buyer = buyerMap.get(r.buyer_id);
        return (
          r.title?.toLowerCase().includes(q) ||
          buyer?.full_name?.toLowerCase().includes(q) ||
          buyer?.company_name?.toLowerCase().includes(q) ||
          buyer?.email?.toLowerCase().includes(q)
        );
      });
    }

    const quotes: AdminQuote[] = filtered.map((r) => ({
      id: r.id,
      title: r.title,
      status: r.status,
      items: (r.items ?? []) as unknown as AdminQuoteItem[],
      notes: r.notes,
      document_url: r.document_url,
      admin_notes: r.admin_notes,
      quoted_amount: r.quoted_amount,
      valid_until: r.valid_until,
      created_at: r.created_at,
      updated_at: r.updated_at,
      buyer: buyerMap.get(r.buyer_id) ?? null,
    }));

    return NextResponse.json({
      data: {
        quotes,
        total: search.trim() ? filtered.length : rows.length,
        page,
        per_page: perPage,
        status_counts,
      } as AdminQuotesResponse,
      error: null,
    });
  } catch (error) {
    console.error('[api/admin/quotes GET]', error);
    return NextResponse.json({ data: null, error: 'Failed to fetch quotes' }, { status: 500 });
  }
}
