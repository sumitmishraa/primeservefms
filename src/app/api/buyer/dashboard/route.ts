/**
 * GET /api/buyer/dashboard
 *
 * Returns KPIs, spend trend, order breakdown, outstanding credit and recent
 * orders for the logged-in buyer's assigned branch only.
 *
 * Query params:
 *   period: this_month | last_3_months | this_fy | custom  (default: this_month)
 *   start:  ISO date string  (only when period=custom)
 *   end:    ISO date string  (only when period=custom)
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ApiResponse } from '@/types';

// ─── Period helpers ──────────────────────────────────────────────────────────

function getPeriodBounds(period: string, start?: string, end?: string): { from: string; to: string } {
  const now = new Date();
  if (period === 'custom' && start && end) {
    return { from: new Date(start).toISOString(), to: new Date(end + 'T23:59:59').toISOString() };
  }
  if (period === 'last_3_months') {
    const from = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    return { from: from.toISOString(), to: now.toISOString() };
  }
  if (period === 'this_fy') {
    // Indian FY: April 1 – March 31
    const fyStart = now.getMonth() >= 3
      ? new Date(now.getFullYear(), 3, 1)       // Apr 1 this year
      : new Date(now.getFullYear() - 1, 3, 1);  // Apr 1 last year
    return { from: fyStart.toISOString(), to: now.toISOString() };
  }
  // default: this_month
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return { from: from.toISOString(), to: now.toISOString() };
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SpendPoint { month: string; amount: number }

export interface CreditRow {
  order_id: string;
  order_number: string;
  total_amount: number;
  delivered_at: string | null;
  due_date: string | null;
  days_overdue: number;
  bucket: 'overdue' | 'due_soon' | 'upcoming';
}

export interface DashboardData {
  // KPIs
  monthly_spend: number;
  outstanding_credit: number;
  due_soon: number;
  overdue: number;
  active_orders: number;
  delivered_orders: number;
  quote_requests: number;
  // Charts
  spend_trend: SpendPoint[];
  status_breakdown: Record<string, number>;
  // Tables
  recent_orders: {
    id: string; order_number: string; status: string;
    total_amount: number; created_at: string; item_count: number;
    payment_method: string;
  }[];
  credit_rows: CreditRow[];
  // Context
  branch_name: string | null;
  client_name: string | null;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<DashboardData>>> {
  try {
    const user = await verifyAuth(request);
    if (!user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') ?? 'this_month';
    const { from, to } = getPeriodBounds(
      period,
      searchParams.get('start') ?? undefined,
      searchParams.get('end') ?? undefined,
    );

    const supabase = createAdminClient();

    // ── Scoped order fetch ───────────────────────────────────────────────────
    // v1: assigned-branch-only scope.  Always filter by buyer_id; if the buyer
    // also has a branch_id add that filter so we never bleed cross-branch data.
    let ordersQuery = supabase
      .from('orders')
      .select('id, order_number, status, payment_status, payment_method, total_amount, delivered_at, created_at')
      .eq('buyer_id', user.id);

    if (user.branch_id) {
      ordersQuery = ordersQuery.eq('branch_id', user.branch_id);
    }

    const { data: allOrders, error: ordersErr } = await ordersQuery.order('created_at', { ascending: false });
    if (ordersErr) throw ordersErr;

    const orders = allOrders ?? [];

    // ── Order counts / KPIs ──────────────────────────────────────────────────
    const ACTIVE = new Set(['pending', 'approved', 'forwarded_to_vendor', 'dispatched']);
    const periodOrders = orders.filter(
      (o) => o.created_at >= from && o.created_at <= to && o.status !== 'cancelled',
    );

    const monthly_spend = periodOrders.reduce((s, o) => s + (o.total_amount ?? 0), 0);
    const active_orders = orders.filter((o) => ACTIVE.has(o.status)).length;
    const delivered_orders = orders.filter((o) => o.status === 'delivered').length;

    // ── Status breakdown (period) ────────────────────────────────────────────
    const status_breakdown: Record<string, number> = {};
    for (const o of periodOrders) {
      status_breakdown[o.status] = (status_breakdown[o.status] ?? 0) + 1;
    }

    // ── Spend trend (last 6 calendar months, always) ─────────────────────────
    const trendMonths: SpendPoint[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthFrom = d.toISOString();
      const monthTo = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59).toISOString();
      const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' });
      const amount = orders
        .filter((o) => o.created_at >= monthFrom && o.created_at <= monthTo && o.status !== 'cancelled')
        .reduce((s, o) => s + (o.total_amount ?? 0), 0);
      trendMonths.push({ month: label, amount: Math.round(amount) });
    }

    // ── Credit aging (all time — open credit orders) ──────────────────────────
    const creditOrders = orders.filter(
      (o) => o.payment_method === 'credit_45day' && o.payment_status === 'pending' && o.status !== 'cancelled',
    );
    const nowMs = Date.now();
    let outstanding_credit = 0;
    let due_soon = 0;
    let overdue = 0;
    const credit_rows: CreditRow[] = creditOrders.map((o) => {
      outstanding_credit += o.total_amount ?? 0;
      let due_date: string | null = null;
      let days_overdue = 0;
      let bucket: CreditRow['bucket'] = 'upcoming';
      if (o.delivered_at) {
        const dueMs = new Date(o.delivered_at).getTime() + 45 * 24 * 60 * 60 * 1000;
        due_date = new Date(dueMs).toISOString();
        const diffDays = Math.ceil((dueMs - nowMs) / (24 * 60 * 60 * 1000));
        if (diffDays < 0) {
          bucket = 'overdue';
          days_overdue = Math.abs(diffDays);
          overdue += o.total_amount ?? 0;
        } else if (diffDays <= 7) {
          bucket = 'due_soon';
          due_soon += o.total_amount ?? 0;
        }
      }
      return {
        order_id: o.id,
        order_number: o.order_number,
        total_amount: o.total_amount,
        delivered_at: o.delivered_at ?? null,
        due_date,
        days_overdue,
        bucket,
      };
    });

    // ── Quote request count ──────────────────────────────────────────────────
    const { count: quoteCount } = await supabase
      .from('quote_requests')
      .select('id', { count: 'exact', head: true })
      .eq('buyer_id', user.id);

    // ── Order items for recent orders ────────────────────────────────────────
    const recent5 = orders.slice(0, 5);
    const recentIds = recent5.map((o) => o.id);
    const { data: recentItems } = recentIds.length
      ? await supabase.from('order_items').select('order_id').in('order_id', recentIds)
      : { data: [] };

    const itemCountMap = new Map<string, number>();
    for (const item of recentItems ?? []) {
      itemCountMap.set(item.order_id, (itemCountMap.get(item.order_id) ?? 0) + 1);
    }

    // ── Branch / client names ────────────────────────────────────────────────
    const [clientRes, branchRes] = await Promise.all([
      user.client_id
        ? supabase.from('clients').select('name').eq('id', user.client_id).single()
        : Promise.resolve({ data: null }),
      user.branch_id
        ? supabase.from('branches').select('name').eq('id', user.branch_id).single()
        : Promise.resolve({ data: null }),
    ]);

    return NextResponse.json({
      data: {
        monthly_spend: Math.round(monthly_spend),
        outstanding_credit: Math.round(outstanding_credit),
        due_soon: Math.round(due_soon),
        overdue: Math.round(overdue),
        active_orders,
        delivered_orders,
        quote_requests: quoteCount ?? 0,
        spend_trend: trendMonths,
        status_breakdown,
        recent_orders: recent5.map((o) => ({
          id: o.id,
          order_number: o.order_number,
          status: o.status,
          total_amount: o.total_amount,
          created_at: o.created_at,
          item_count: itemCountMap.get(o.id) ?? 0,
          payment_method: o.payment_method,
        })),
        credit_rows,
        branch_name: (branchRes.data as { name: string } | null)?.name ?? null,
        client_name: (clientRes.data as { name: string } | null)?.name ?? null,
      },
      error: null,
    });
  } catch (err) {
    console.error('[api/buyer/dashboard GET]', err);
    return NextResponse.json({ data: null, error: 'Failed to load dashboard' }, { status: 500 });
  }
}
