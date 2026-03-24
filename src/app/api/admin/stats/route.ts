/**
 * GET /api/admin/stats
 *
 * Returns all data needed to render the admin dashboard home page:
 *   - Six headline stats (products, orders, pending orders, buyers, revenue, today)
 *   - Up to 5 pending orders (with buyer info and item count)
 *   - Last 10 orders for the activity feed
 *
 * Admin-only route — returns 403 for non-admin sessions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';

// ---------------------------------------------------------------------------
// Response shape types (exported so the client page can import them)
// ---------------------------------------------------------------------------

export interface AdminStats {
  total_products: number;
  total_orders: number;
  pending_orders: number;
  total_buyers: number;
  revenue_this_month: number;
  orders_today: number;
}

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

export interface AdminDashboardData {
  stats: AdminStats;
  pending_orders: PendingOrderRow[];
  recent_orders: RecentOrderRow[];
}

// ---------------------------------------------------------------------------
// Internal raw shapes from Supabase join queries
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

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

/**
 * Returns admin dashboard stats, pending orders, and recent activity.
 * Requires an authenticated admin session.
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

    // 2. Build date boundaries (UTC — Supabase timestamps are UTC)
    const now = new Date();
    const startOfMonth = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)
    ).toISOString();
    const startOfToday = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())
    ).toISOString();

    // 3. Parallel fetches — all run at the same time
    const [
      productsResult,
      ordersResult,
      pendingCountResult,
      buyersResult,
      revenueResult,
      todayResult,
      pendingListResult,
      recentResult,
    ] = await Promise.all([
      // Active product count
      supabase
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true),

      // Total order count
      supabase
        .from('orders')
        .select('*', { count: 'exact', head: true }),

      // Pending order count
      supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending'),

      // Registered buyer count
      supabase
        .from('users')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'buyer'),

      // Revenue this month (delivered orders only)
      supabase
        .from('orders')
        .select('total_amount')
        .eq('status', 'delivered')
        .gte('created_at', startOfMonth),

      // Orders placed today
      supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfToday),

      // Pending orders list (max 5) with buyer info + item count
      supabase
        .from('orders')
        .select(
          'id, order_number, total_amount, created_at, buyer:users!buyer_id(full_name, company_name), items:order_items(id)'
        )
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(5),

      // Recent orders (last 10) for the activity feed
      supabase
        .from('orders')
        .select(
          'id, order_number, status, total_amount, created_at, buyer:users!buyer_id(full_name, company_name)'
        )
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

    // 4. Compute revenue
    const revenueThisMonth = (revenueResult.data ?? []).reduce(
      (sum: number, row: { total_amount: number }) => sum + (row.total_amount ?? 0),
      0
    );

    // 5. Map pending orders
    const pendingOrders: PendingOrderRow[] = (
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

    // 6. Map recent orders for activity feed
    const recentOrders: RecentOrderRow[] = (
      (recentResult.data ?? []) as unknown as Omit<RawOrderWithBuyer, 'items'>[]
    ).map((order) => ({
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      total_amount: order.total_amount,
      buyer_name: order.buyer?.full_name ?? 'Unknown Buyer',
      buyer_company: order.buyer?.company_name ?? null,
      created_at: order.created_at,
    }));

    const data: AdminDashboardData = {
      stats: {
        total_products: productsResult.count ?? 0,
        total_orders: ordersResult.count ?? 0,
        pending_orders: pendingCountResult.count ?? 0,
        total_buyers: buyersResult.count ?? 0,
        revenue_this_month: revenueThisMonth,
        orders_today: todayResult.count ?? 0,
      },
      pending_orders: pendingOrders,
      recent_orders: recentOrders,
    };

    return NextResponse.json({ data, error: null });
  } catch (error) {
    console.error('[api/admin/stats GET]', error);
    return NextResponse.json(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
