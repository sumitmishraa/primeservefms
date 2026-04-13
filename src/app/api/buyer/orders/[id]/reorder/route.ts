/**
 * GET /api/buyer/orders/[id]/reorder
 * Returns full Product[] for all items in the order so the client can re-add to cart.
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ApiResponse, Product } from '@/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<{ products: Product[]; quantities: Record<string, number> }>>> {
  try {
    const user = await verifyAuth(request);
    if (!user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const supabase = createAdminClient();

    // Verify ownership
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select('id')
      .eq('id', id)
      .eq('buyer_id', user.id)
      .single();

    if (orderError || !order) {
      return NextResponse.json({ data: null, error: 'Order not found' }, { status: 404 });
    }

    // Fetch order items separately (avoids Supabase relationship type issue)
    const { data: itemRows, error: itemsError } = await supabase
      .from('order_items')
      .select('product_id, quantity')
      .eq('order_id', id);

    if (itemsError) throw itemsError;

    const items = (itemRows ?? []) as { product_id: string; quantity: number }[];
    const productIds = items.map((i) => i.product_id);

    // Build quantity map for the client
    const quantities: Record<string, number> = {};
    for (const item of items) {
      quantities[item.product_id] = item.quantity;
    }

    // Fetch current product data (may be stale if products changed)
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('*')
      .in('id', productIds)
      .eq('is_active', true)
      .eq('is_approved', true);

    if (productsError) throw productsError;

    return NextResponse.json({
      data: { products: (products ?? []) as Product[], quantities },
      error: null,
    });
  } catch (error) {
    console.error('[api/buyer/orders/[id]/reorder GET]', error);
    return NextResponse.json({ data: null, error: 'Failed to fetch products' }, { status: 500 });
  }
}
