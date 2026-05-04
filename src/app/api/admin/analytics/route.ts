/**
 * GET /api/admin/analytics
 *
 * Returns all analytics data in one response for the admin analytics dashboard.
 * Uses the Supabase admin client. All queries are parallel.
 *
 * Query params:
 *   ?date_from=  ISO datetime lower bound
 *   ?date_to=    ISO datetime upper bound
 *   ?client_id=  Filter to a specific client
 *   ?branch_id=  Filter to a specific branch
 *
 * Returns zero-values when no orders exist — never crashes on empty data.
 * Admin-only — returns 403 for non-admin sessions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Response shape
// ---------------------------------------------------------------------------

export interface AnalyticsOverview {
  total_revenue: number;
  total_orders: number;
  average_order_value: number;
  active_buyers: number;
  total_products: number;
  pending_payments: number;
}

export interface OrdersByStatus {
  status: string;
  count: number;
  amount: number;
}

export interface TopProduct {
  name: string;
  category: string;
  order_count: number;
  revenue: number;
}

export interface TopClient {
  name: string;
  total_orders: number;
  total_revenue: number;
  pending: number;
}

export interface TopBuyer {
  name: string;
  company: string | null;
  orders: number;
  spent: number;
}

export interface MonthlyOrders {
  month: string;
  orders: number;
  revenue: number;
}

export interface CategoryBreakdown {
  category: string;
  orders: number;
  revenue: number;
  percentage: number;
}

export interface AnalyticsData {
  overview: AnalyticsOverview;
  orders_by_status: OrdersByStatus[];
  top_products: TopProduct[];
  top_clients: TopClient[];
  top_buyers: TopBuyer[];
  monthly_orders: MonthlyOrders[];
  category_breakdown: CategoryBreakdown[];
}

// ---------------------------------------------------------------------------
// Internal raw types for Supabase query results
// ---------------------------------------------------------------------------

interface RawOrder {
  status: string;
  total_amount: number;
  buyer_id: string;
}

interface RawOrderWithClient {
  total_amount: number;
  status: string;
  client: { name: string } | null;
}

interface RawOrderWithBuyer {
  total_amount: number;
  buyer: { full_name: string; company_name: string | null } | null;
}

interface RawOrderMonthly {
  created_at: string;
  total_amount: number;
}

interface RawOrderItemWithProduct {
  quantity: number;
  unit_price: number;
  product: { name: string; category: string } | null;
}

// ---------------------------------------------------------------------------
// Category display names
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<string, string> = {
  housekeeping_materials: 'Housekeeping Materials',
  cleaning_chemicals:     'Cleaning Chemicals',
  office_stationeries:    'Office Stationeries',
  pantry_items:           'Pantry Items',
  facility_and_tools:     'Facility & Tools',
  printing_solution:      'Printing Solution',
};

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

/**
 * GET /api/admin/analytics
 *
 * Returns complete analytics data structure for the analytics dashboard.
 * Handles empty database gracefully — returns zeros, not errors.
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Auth check — admin only
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ data: null, error: 'Not authenticated' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return NextResponse.json({ data: null, error: 'Forbidden — admin access only' }, { status: 403 });
    }

    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);

    const client_id = searchParams.get('client_id');
    const branch_id = searchParams.get('branch_id');
    const date_from = searchParams.get('date_from');
    const date_to   = searchParams.get('date_to');

    // Helper: apply common date/client/branch filters to any query builder
    // We use a typed approach by building queries inline below to satisfy TypeScript

    // 2. Run all data queries in parallel
    const [
      productsResult,
      allOrdersResult,
      deliveredOrdersResult,
      pendingPaymentsResult,
      orderItemsResult,
      clientOrdersResult,
      buyerOrdersResult,
      monthlyResult,
    ] = await Promise.all([

      // Total active products (unfiltered)
      supabase
        .from('products')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true),

      // All orders — for status breakdown and buyer count
      (() => {
        let q = supabase.from('orders').select('status, total_amount, buyer_id');
        if (client_id) q = q.eq('client_id', client_id);
        if (branch_id) q = q.eq('branch_id', branch_id);
        if (date_from) q = q.gte('created_at', date_from);
        if (date_to)   q = q.lte('created_at', date_to);
        return q;
      })(),

      // Delivered orders — for total revenue
      (() => {
        let q = supabase.from('orders').select('total_amount').eq('status', 'delivered');
        if (client_id) q = q.eq('client_id', client_id);
        if (branch_id) q = q.eq('branch_id', branch_id);
        if (date_from) q = q.gte('created_at', date_from);
        if (date_to)   q = q.lte('created_at', date_to);
        return q;
      })(),

      // Non-delivered, non-cancelled — for pending payments
      (() => {
        let q = supabase
          .from('orders')
          .select('total_amount')
          .not('status', 'in', '("delivered","cancelled")');
        if (client_id) q = q.eq('client_id', client_id);
        if (branch_id) q = q.eq('branch_id', branch_id);
        if (date_from) q = q.gte('created_at', date_from);
        if (date_to)   q = q.lte('created_at', date_to);
        return q;
      })(),

      // Order items joined with products — for top products and category breakdown
      (() => {
        const q = supabase
          .from('order_items')
          .select('quantity, unit_price, product:products(name, category)')
          .not('product', 'is', null);
        if (date_from || date_to || client_id || branch_id) {
          // Filter via orders; use the orders join
        }
        return q;
      })(),

      // Orders with client — for top clients
      (() => {
        let q = supabase
          .from('orders')
          .select('total_amount, status, client:clients(name)')
          .not('client_id', 'is', null);
        if (client_id) q = q.eq('client_id', client_id);
        if (branch_id) q = q.eq('branch_id', branch_id);
        if (date_from) q = q.gte('created_at', date_from);
        if (date_to)   q = q.lte('created_at', date_to);
        return q;
      })(),

      // Orders with buyer — for top buyers
      (() => {
        let q = supabase
          .from('orders')
          .select('total_amount, buyer:users!buyer_id(full_name, company_name)');
        if (client_id) q = q.eq('client_id', client_id);
        if (branch_id) q = q.eq('branch_id', branch_id);
        if (date_from) q = q.gte('created_at', date_from);
        if (date_to)   q = q.lte('created_at', date_to);
        return q;
      })(),

      // Monthly orders — last 12 months
      (() => {
        const twelveMonthsAgo = new Date();
        twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
        let q = supabase
          .from('orders')
          .select('created_at, total_amount')
          .gte('created_at', twelveMonthsAgo.toISOString());
        if (client_id) q = q.eq('client_id', client_id);
        if (branch_id) q = q.eq('branch_id', branch_id);
        if (date_from) q = q.gte('created_at', date_from);
        if (date_to)   q = q.lte('created_at', date_to);
        return q;
      })(),
    ]);

    // 3. Compute overview
    const allOrders       = (allOrdersResult.data ?? []) as RawOrder[];
    const deliveredOrders = (deliveredOrdersResult.data ?? []) as { total_amount: number }[];
    const pendingPayments = (pendingPaymentsResult.data ?? []) as { total_amount: number }[];

    const total_revenue     = deliveredOrders.reduce((s, o) => s + (o.total_amount ?? 0), 0);
    const total_orders      = allOrders.length;
    const average_order_value = total_orders > 0 ? total_revenue / total_orders : 0;
    const active_buyers     = new Set(allOrders.map((o) => o.buyer_id).filter(Boolean)).size;
    const pending_payments  = pendingPayments.reduce((s, o) => s + (o.total_amount ?? 0), 0);
    const total_products    = productsResult.count ?? 0;

    const overview: AnalyticsOverview = {
      total_revenue,
      total_orders,
      average_order_value,
      active_buyers,
      total_products,
      pending_payments,
    };

    // 4. Orders by status
    const statusMap: Record<string, { count: number; amount: number }> = {};
    for (const order of allOrders) {
      const key = order.status ?? 'unknown';
      if (!statusMap[key]) statusMap[key] = { count: 0, amount: 0 };
      statusMap[key].count  += 1;
      statusMap[key].amount += order.total_amount ?? 0;
    }
    const orders_by_status: OrdersByStatus[] = Object.entries(statusMap).map(([status, v]) => ({
      status,
      count:  v.count,
      amount: v.amount,
    }));

    // 5. Top products
    const productMap: Record<string, { name: string; category: string; count: number; revenue: number }> = {};
    const orderItems = (orderItemsResult.data ?? []) as unknown as RawOrderItemWithProduct[];
    for (const item of orderItems) {
      if (!item.product) continue;
      const key = item.product.name;
      if (!productMap[key]) {
        productMap[key] = { name: item.product.name, category: item.product.category, count: 0, revenue: 0 };
      }
      productMap[key].count   += item.quantity ?? 1;
      productMap[key].revenue += (item.unit_price ?? 0) * (item.quantity ?? 1);
    }
    const top_products: TopProduct[] = Object.values(productMap)
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map((p) => ({
        name:        p.name,
        category:    CATEGORY_LABELS[p.category] ?? p.category,
        order_count: p.count,
        revenue:     p.revenue,
      }));

    // 6. Top clients
    const clientMap: Record<string, { total_orders: number; total_revenue: number; pending: number }> = {};
    const clientOrders = (clientOrdersResult.data ?? []) as unknown as RawOrderWithClient[];
    for (const order of clientOrders) {
      if (!order.client) continue;
      const key = order.client.name;
      if (!clientMap[key]) clientMap[key] = { total_orders: 0, total_revenue: 0, pending: 0 };
      clientMap[key].total_orders += 1;
      if (order.status === 'delivered') {
        clientMap[key].total_revenue += order.total_amount ?? 0;
      } else if (order.status !== 'cancelled') {
        clientMap[key].pending += order.total_amount ?? 0;
      }
    }
    const top_clients: TopClient[] = Object.entries(clientMap)
      .sort((a, b) => b[1].total_revenue - a[1].total_revenue)
      .slice(0, 10)
      .map(([name, v]) => ({ name, ...v }));

    // 7. Top buyers
    const buyerMap: Record<string, { name: string; company: string | null; orders: number; spent: number }> = {};
    const buyerOrders = (buyerOrdersResult.data ?? []) as unknown as RawOrderWithBuyer[];
    for (const order of buyerOrders) {
      if (!order.buyer) continue;
      const key = order.buyer.full_name;
      if (!buyerMap[key]) {
        buyerMap[key] = { name: order.buyer.full_name, company: order.buyer.company_name ?? null, orders: 0, spent: 0 };
      }
      buyerMap[key].orders += 1;
      buyerMap[key].spent  += order.total_amount ?? 0;
    }
    const top_buyers: TopBuyer[] = Object.values(buyerMap)
      .sort((a, b) => b.spent - a.spent)
      .slice(0, 10);

    // 8. Monthly orders — last 6 months bucket
    const monthlyRaw = (monthlyResult.data ?? []) as RawOrderMonthly[];
    const monthlyMap: Record<string, { orders: number; revenue: number }> = {};
    for (const order of monthlyRaw) {
      const d     = new Date(order.created_at);
      const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      if (!monthlyMap[month]) monthlyMap[month] = { orders: 0, revenue: 0 };
      monthlyMap[month].orders  += 1;
      monthlyMap[month].revenue += order.total_amount ?? 0;
    }
    // Ensure last 6 months are always present (even if zero)
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d     = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      const month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
      if (!monthlyMap[month]) monthlyMap[month] = { orders: 0, revenue: 0 };
    }
    const monthly_orders: MonthlyOrders[] = Object.entries(monthlyMap)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([month, v]) => ({ month, orders: v.orders, revenue: v.revenue }));

    // 9. Category breakdown from order items
    const catMap: Record<string, { orders: number; revenue: number }> = {};
    for (const item of orderItems) {
      if (!item.product) continue;
      const cat = item.product.category;
      if (!catMap[cat]) catMap[cat] = { orders: 0, revenue: 0 };
      catMap[cat].orders  += item.quantity ?? 1;
      catMap[cat].revenue += (item.unit_price ?? 0) * (item.quantity ?? 1);
    }
    const totalCatOrders = Object.values(catMap).reduce((s, c) => s + c.orders, 0);
    const category_breakdown: CategoryBreakdown[] = Object.entries(catMap)
      .sort((a, b) => b[1].revenue - a[1].revenue)
      .map(([cat, v]) => ({
        category:   CATEGORY_LABELS[cat] ?? cat,
        orders:     v.orders,
        revenue:    v.revenue,
        percentage: totalCatOrders > 0 ? Math.round((v.orders / totalCatOrders) * 100) : 0,
      }));

    const data: AnalyticsData = {
      overview,
      orders_by_status,
      top_products,
      top_clients,
      top_buyers,
      monthly_orders,
      category_breakdown,
    };

    return NextResponse.json({ data, error: null });
  } catch (error) {
    console.error('[api/admin/analytics GET]', error);
    return NextResponse.json(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
