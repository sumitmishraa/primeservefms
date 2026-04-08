/**
 * GET /api/admin/dashboard
 *
 * Returns all data needed to render the admin dashboard home page with
 * optional filtering by client, branch, date range, and order status.
 *
 * Accepts query params:
 *   ?client_id=   Filter orders/buyers to a specific client
 *   ?branch_id=   Filter orders/buyers to a specific branch
 *   ?date_from=   ISO datetime lower bound on created_at
 *   ?date_to=     ISO datetime upper bound on created_at
 *   ?status=      Filter orders by exact status
 *
 * Admin-only route — returns 403 for non-admin sessions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';

// ---------------------------------------------------------------------------
// Re-use the PendingOrderRow and RecentOrderRow shapes from the stats route
// (re-defined here so this file is self-contained and importable independently)
// ---------------------------------------------------------------------------

export interface PendingOrderRow {
  id: string;
  order_number: string;
  buyer_name: string;
  buyer_company: string | null;
  items_count: number;
  total_amount: number;
  created_at: string;
}

export interface RecentOrderRow {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  buyer_name: string;
  buyer_company: string | null;
  created_at: string;
}

export interface LowStockProduct {
  id: string;
  name: string;
  category: string;
  stock_status: string;
  slug: string;
}

export interface DashboardData {
  total_products: number;
  total_orders: number;
  pending_orders: number;
  registered_buyers: number;
  revenue: number;
  orders_today: number;
  pending_orders_list: PendingOrderRow[];
  recent_activity: RecentOrderRow[];
  low_stock_products: LowStockProduct[];
}

// ---------------------------------------------------------------------------
// Order status enum (matches the database column constraint)
// ---------------------------------------------------------------------------

type OrderStatus =
  | 'pending'
  | 'approved'
  | 'forwarded_to_vendor'
  | 'dispatched'
  | 'delivered'
  | 'cancelled'
  | 'confirmed'
  | 'processing'
  | 'shipped';

const VALID_ORDER_STATUSES = new Set<string>([
  'pending', 'approved', 'forwarded_to_vendor', 'dispatched',
  'delivered', 'cancelled', 'confirmed', 'processing', 'shipped',
]);

// ---------------------------------------------------------------------------
// Internal raw shape for Supabase join queries
// ---------------------------------------------------------------------------

interface RawOrderWithBuyer {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  created_at: string;
  buyer: { full_name: string; company_name: string | null } | null;
  items: { id: string }[];
}

interface RawRecentOrder {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  created_at: string;
  buyer: { full_name: string; company_name: string | null } | null;
}

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

/**
 * GET /api/admin/dashboard
 *
 * Returns filtered dashboard stats, pending orders list, and recent activity.
 * total_products is always unfiltered (global catalogue count).
 *
 * @param request - Incoming NextRequest with optional query params
 * @returns DashboardData object
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Auth + role check
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

    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);

    const client_id = searchParams.get('client_id');
    const branch_id = searchParams.get('branch_id');
    const date_from = searchParams.get('date_from');
    const date_to = searchParams.get('date_to');
    const rawStatus = searchParams.get('status');
    // Validate against known enum values so we can safely pass it to typed Supabase queries
    const statusFilter: OrderStatus | null =
      rawStatus && VALID_ORDER_STATUSES.has(rawStatus)
        ? (rawStatus as OrderStatus)
        : null;

    // 2. Start of today (UTC) for the orders_today count
    const now = new Date();
    const startOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    ).toISOString();

    // 3. Build filtered count queries — filters inlined so TypeScript can track types

    // Total orders (all statuses, all filters)
    let totalOrdersQuery = supabase
      .from('orders')
      .select('*', { count: 'exact', head: true });
    if (client_id) totalOrdersQuery = totalOrdersQuery.eq('client_id', client_id);
    if (branch_id) totalOrdersQuery = totalOrdersQuery.eq('branch_id', branch_id);
    if (date_from) totalOrdersQuery = totalOrdersQuery.gte('created_at', date_from);
    if (date_to)   totalOrdersQuery = totalOrdersQuery.lte('created_at', date_to);
    if (statusFilter) totalOrdersQuery = totalOrdersQuery.eq('status', statusFilter);

    // Pending count — client/branch/date only, status hardcoded to 'pending'
    let pendingOrdersCountQuery = supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'pending');
    if (client_id) pendingOrdersCountQuery = pendingOrdersCountQuery.eq('client_id', client_id);
    if (branch_id) pendingOrdersCountQuery = pendingOrdersCountQuery.eq('branch_id', branch_id);
    if (date_from) pendingOrdersCountQuery = pendingOrdersCountQuery.gte('created_at', date_from);
    if (date_to)   pendingOrdersCountQuery = pendingOrdersCountQuery.lte('created_at', date_to);

    // Orders today — always uses startOfToday as lower bound
    let ordersTodayQuery = supabase
      .from('orders')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', startOfToday);
    if (client_id)    ordersTodayQuery = ordersTodayQuery.eq('client_id', client_id);
    if (branch_id)    ordersTodayQuery = ordersTodayQuery.eq('branch_id', branch_id);
    if (date_to)      ordersTodayQuery = ordersTodayQuery.lte('created_at', date_to);
    if (statusFilter) ordersTodayQuery = ordersTodayQuery.eq('status', statusFilter);

    // Revenue — delivered orders only, client/branch/date filters applied
    let revenueQuery = supabase
      .from('orders')
      .select('total_amount')
      .eq('status', 'delivered');
    if (client_id) revenueQuery = revenueQuery.eq('client_id', client_id);
    if (branch_id) revenueQuery = revenueQuery.eq('branch_id', branch_id);
    if (date_from) revenueQuery = revenueQuery.gte('created_at', date_from);
    if (date_to)   revenueQuery = revenueQuery.lte('created_at', date_to);

    // Registered buyers — filter by client/branch if provided
    let buyersQuery = supabase
      .from('users')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'buyer');
    if (client_id) buyersQuery = buyersQuery.eq('client_id', client_id);
    if (branch_id) buyersQuery = buyersQuery.eq('branch_id', branch_id);

    // Pending orders list (top 5) — status hardcoded to 'pending'
    let pendingListQuery = supabase
      .from('orders')
      .select(
        'id, order_number, total_amount, created_at, buyer:users!buyer_id(full_name, company_name), items:order_items(id)'
      )
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
      .limit(5);
    if (client_id) pendingListQuery = pendingListQuery.eq('client_id', client_id);
    if (branch_id) pendingListQuery = pendingListQuery.eq('branch_id', branch_id);
    if (date_from) pendingListQuery = pendingListQuery.gte('created_at', date_from);
    if (date_to)   pendingListQuery = pendingListQuery.lte('created_at', date_to);

    // Recent activity (last 10 orders, all filters)
    let recentQuery = supabase
      .from('orders')
      .select(
        'id, order_number, status, total_amount, created_at, buyer:users!buyer_id(full_name, company_name)'
      )
      .order('created_at', { ascending: false })
      .limit(10);
    if (client_id)    recentQuery = recentQuery.eq('client_id', client_id);
    if (branch_id)    recentQuery = recentQuery.eq('branch_id', branch_id);
    if (date_from)    recentQuery = recentQuery.gte('created_at', date_from);
    if (date_to)      recentQuery = recentQuery.lte('created_at', date_to);
    if (statusFilter) recentQuery = recentQuery.eq('status', statusFilter);

    // 4. Run all queries in parallel
    const [
      productsResult,
      totalOrdersResult,
      pendingOrdersCountResult,
      ordersTodayResult,
      revenueResult,
      buyersResult,
      pendingListResult,
      recentResult,
      lowStockResult,
    ] = await Promise.all([
      // Products are always the global unfiltered count
      supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true),
      totalOrdersQuery,
      pendingOrdersCountQuery,
      ordersTodayQuery,
      revenueQuery,
      buyersQuery,
      pendingListQuery,
      recentQuery,
      // Low/out-of-stock products — always unfiltered, top 10
      supabase
        .from('products')
        .select('id, name, category, stock_status, slug')
        .eq('is_active', true)
        .in('stock_status', ['out_of_stock', 'low_stock'])
        .order('stock_status', { ascending: true })
        .limit(10),
    ]);

    // 5. Compute revenue from delivered order rows
    const revenue = (revenueResult.data ?? []).reduce(
      (sum: number, row: { total_amount: number }) => sum + (row.total_amount ?? 0),
      0
    );

    // 6. Map pending orders list
    const pendingOrdersList: PendingOrderRow[] = (
      (pendingListResult.data ?? []) as unknown as RawOrderWithBuyer[]
    ).map((order) => ({
      id: order.id,
      order_number: order.order_number,
      buyer_name: order.buyer?.full_name ?? 'Unknown Buyer',
      buyer_company: order.buyer?.company_name ?? null,
      items_count: order.items?.length ?? 0,
      total_amount: order.total_amount,
      created_at: order.created_at,
    }));

    // 7. Map recent activity feed
    const recentActivity: RecentOrderRow[] = (
      (recentResult.data ?? []) as unknown as RawRecentOrder[]
    ).map((order) => ({
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      total_amount: order.total_amount,
      buyer_name: order.buyer?.full_name ?? 'Unknown Buyer',
      buyer_company: order.buyer?.company_name ?? null,
      created_at: order.created_at,
    }));

    const lowStockProducts: LowStockProduct[] = (
      (lowStockResult.data ?? []) as LowStockProduct[]
    );

    const data: DashboardData = {
      total_products: productsResult.count ?? 0,
      total_orders: totalOrdersResult.count ?? 0,
      pending_orders: pendingOrdersCountResult.count ?? 0,
      registered_buyers: buyersResult.count ?? 0,
      revenue,
      orders_today: ordersTodayResult.count ?? 0,
      pending_orders_list: pendingOrdersList,
      recent_activity: recentActivity,
      low_stock_products: lowStockProducts,
    };

    return NextResponse.json({ data, error: null });
  } catch (error) {
    console.error('[api/admin/dashboard GET]', error);
    return NextResponse.json(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
