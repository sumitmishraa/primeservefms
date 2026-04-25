/**
 * GET /api/buyer/orders
 * Buyer's own orders with preview info and optional status filter.
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ApiResponse } from '@/types';
import type { Enums } from '@/types/database';

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const user = await verifyAuth(request);
    if (!user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as Enums<'order_status'> | null;
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1'));
    const perPage = Math.min(50, parseInt(searchParams.get('per_page') ?? '20'));

    const supabase = createAdminClient();

    // Fetch orders without join to avoid Supabase relationship type error
    let query = supabase
      .from('orders')
      .select('id, order_number, status, payment_status, payment_method, subtotal, gst_amount, shipping_amount, total_amount, created_at, notes', { count: 'exact' })
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false });

    if (status) query = query.eq('status', status);

    const { data: orders, error, count } = await query
      .range((page - 1) * perPage, page * perPage - 1);

    if (error) throw error;

    if (!orders || orders.length === 0) {
      return NextResponse.json({ data: { orders: [], total: 0, page, per_page: perPage }, error: null });
    }

    // Fetch order_items for these orders separately
    const orderIds = orders.map((o) => o.id);
    const { data: allItems, error: itemsError } = await supabase
      .from('order_items')
      .select('order_id, id, product_name, quantity')
      .in('order_id', orderIds);

    if (itemsError) throw itemsError;

    // Group items by order_id
    const itemsByOrder = new Map<string, { id: string; product_name: string; quantity: number }[]>();
    for (const item of allItems ?? []) {
      const list = itemsByOrder.get(item.order_id) ?? [];
      list.push({ id: item.id, product_name: item.product_name, quantity: item.quantity });
      itemsByOrder.set(item.order_id, list);
    }

    // Merge items into orders
    const ordersWithItems = orders.map((o) => ({
      ...o,
      order_items: itemsByOrder.get(o.id) ?? [],
    }));

    return NextResponse.json({
      data: { orders: ordersWithItems, total: count ?? 0, page, per_page: perPage },
      error: null,
    });
  } catch (error) {
    console.error('[api/buyer/orders GET]', error);
    return NextResponse.json({ data: null, error: 'Failed to fetch orders' }, { status: 500 });
  }
}
