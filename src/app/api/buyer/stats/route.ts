/**
 * GET /api/buyer/stats
 * Dashboard stats for the logged-in buyer.
 * Returns: active orders count, this-month total, all-time total,
 *          recent 3 orders, top 5 frequently ordered products.
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ApiResponse } from '@/types';

interface ProductFrequency {
  product_id: string;
  product_name: string;
  times_ordered: number;
  total_qty: number;
  last_ordered: string;
}

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const user = await verifyAuth(request);
    if (!user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

    const supabase = createAdminClient();

    const { data: orders, error } = await supabase
      .from('orders')
      .select('id, order_number, status, total_amount, created_at, order_items(product_id, product_name, quantity)')
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const all = orders ?? [];
    const ACTIVE_STATUSES = new Set(['pending', 'approved', 'forwarded_to_vendor', 'dispatched']);

    // Month boundaries
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

    const activeCount = all.filter((o) => ACTIVE_STATUSES.has(o.status)).length;
    const monthTotal = all
      .filter((o) => o.created_at >= monthStart)
      .reduce((s, o) => s + (o.total_amount ?? 0), 0);

    // Aggregate product frequencies across ALL orders
    const freqMap = new Map<string, ProductFrequency>();
    for (const order of all) {
      const items = order.order_items as { product_id: string; product_name: string; quantity: number }[];
      for (const item of items ?? []) {
        const existing = freqMap.get(item.product_id);
        if (existing) {
          existing.times_ordered += 1;
          existing.total_qty += item.quantity;
          if (order.created_at > existing.last_ordered) existing.last_ordered = order.created_at;
        } else {
          freqMap.set(item.product_id, {
            product_id: item.product_id,
            product_name: item.product_name,
            times_ordered: 1,
            total_qty: item.quantity,
            last_ordered: order.created_at,
          });
        }
      }
    }

    const topProducts = Array.from(freqMap.values())
      .sort((a, b) => b.times_ordered - a.times_ordered)
      .slice(0, 5);

    return NextResponse.json({
      data: {
        active_orders: activeCount,
        total_this_month: monthTotal,
        total_orders: all.length,
        recent_orders: all.slice(0, 3).map((o) => ({
          id: o.id,
          order_number: o.order_number,
          status: o.status,
          total_amount: o.total_amount,
          created_at: o.created_at,
          item_count: (o.order_items as unknown[]).length,
        })),
        top_products: topProducts,
      },
      error: null,
    });
  } catch (error) {
    console.error('[api/buyer/stats GET]', error);
    return NextResponse.json({ data: null, error: 'Failed to fetch stats' }, { status: 500 });
  }
}
