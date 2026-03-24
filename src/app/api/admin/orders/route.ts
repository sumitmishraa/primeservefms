/**
 * Admin orders list API — GET /api/admin/orders
 *
 * GET — Paginated list of all orders with buyer info joined.
 *       Filters: status, date_from, date_to, search (order number or buyer name/company),
 *                page, per_page
 *       Also returns status_counts for the tab badge numbers.
 *
 * Admin-only — returns 403 for non-admin sessions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Tables, Enums } from '@/types/database';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Exported types (consumed by the orders list page)
// ---------------------------------------------------------------------------

type OrderRow = Tables<'orders'>;
type UserRow  = Tables<'users'>;

export interface OrderWithBuyer extends OrderRow {
  buyer: Pick<UserRow, 'id' | 'full_name' | 'company_name' | 'email' | 'phone'> | null;
}

export interface OrdersListResponse {
  orders:        OrderWithBuyer[];
  total:         number;
  page:          number;
  per_page:      number;
  status_counts: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ACTIVE_STATUSES: Enums<'order_status'>[] = [
  'pending',
  'approved',
  'forwarded_to_vendor',
  'dispatched',
  'delivered',
  'cancelled',
];

// ---------------------------------------------------------------------------
// GET — list all orders
// ---------------------------------------------------------------------------

/**
 * Returns paginated orders list with buyer info merged.
 * Supports filters: status, date_from, date_to, search, page, per_page.
 * Also returns per-status counts so the frontend can show tab badges.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ data: null, error: 'Not authenticated' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return NextResponse.json({ data: null, error: 'Forbidden — admin access only' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') ?? '';
    const dateFrom     = searchParams.get('date_from') ?? '';
    const dateTo       = searchParams.get('date_to') ?? '';
    const search       = searchParams.get('search') ?? '';
    const page         = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10));
    const perPage      = Math.min(100, Math.max(1, parseInt(searchParams.get('per_page') ?? '20', 10)));
    const from         = (page - 1) * perPage;
    const to           = from + perPage - 1;

    const supabase = createAdminClient();

    // If searching, first find buyer IDs that match the search term
    let matchingBuyerIds: string[] = [];
    if (search) {
      const { data: matchingBuyers } = await supabase
        .from('users')
        .select('id')
        .or(`full_name.ilike.%${search}%,company_name.ilike.%${search}%`);
      matchingBuyerIds = (matchingBuyers ?? []).map((b) => b.id);
    }

    // Build main orders query
    let query = supabase
      .from('orders')
      .select('*', { count: 'exact' });

    // Status filter (only active statuses, ignore legacy ones)
    if (statusFilter && ACTIVE_STATUSES.includes(statusFilter as Enums<'order_status'>)) {
      query = query.eq('status', statusFilter as Enums<'order_status'>);
    }

    // Date range filter
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }
    if (dateTo) {
      // Include the full end day
      const endDate = new Date(dateTo);
      endDate.setDate(endDate.getDate() + 1);
      query = query.lt('created_at', endDate.toISOString());
    }

    // Search filter — order number OR buyer match
    if (search) {
      if (matchingBuyerIds.length > 0) {
        query = query.or(
          `order_number.ilike.%${search}%,buyer_id.in.(${matchingBuyerIds.join(',')})`
        );
      } else {
        query = query.ilike('order_number', `%${search}%`);
      }
    }

    const { data: orders, count, error } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('[api/admin/orders GET] Supabase error:', error.message);
      return NextResponse.json({ data: null, error: 'Failed to fetch orders' }, { status: 500 });
    }

    // Fetch buyer profiles for all orders on this page
    const buyerIds = [
      ...new Set((orders ?? []).map((o) => o.buyer_id).filter(Boolean)),
    ];
    const buyerMap: Record<
      string,
      Pick<UserRow, 'id' | 'full_name' | 'company_name' | 'email' | 'phone'>
    > = {};

    if (buyerIds.length > 0) {
      const { data: buyers } = await supabase
        .from('users')
        .select('id, full_name, company_name, email, phone')
        .in('id', buyerIds);

      for (const b of buyers ?? []) {
        buyerMap[b.id] = b;
      }
    }

    // Merge buyer into each order
    const enriched: OrderWithBuyer[] = (orders ?? []).map((o) => ({
      ...o,
      buyer: buyerMap[o.buyer_id] ?? null,
    }));

    // Fetch status counts in parallel for the tab badges
    const [statusCountResults, totalCountResult] = await Promise.all([
      Promise.all(
        ACTIVE_STATUSES.map((s) =>
          supabase
            .from('orders')
            .select('id', { count: 'exact', head: true })
            .eq('status', s)
        )
      ),
      supabase.from('orders').select('id', { count: 'exact', head: true }),
    ]);

    const status_counts: Record<string, number> = {
      all: totalCountResult.count ?? 0,
    };
    ACTIVE_STATUSES.forEach((s, i) => {
      status_counts[s] = statusCountResults[i].count ?? 0;
    });

    return NextResponse.json({
      data: {
        orders:        enriched,
        total:         count ?? 0,
        page,
        per_page:      perPage,
        status_counts,
      } as OrdersListResponse,
      error: null,
    });
  } catch (error) {
    console.error('[api/admin/orders GET]', error);
    return NextResponse.json({ data: null, error: 'Internal server error' }, { status: 500 });
  }
}
