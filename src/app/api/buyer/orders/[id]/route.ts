/**
 * GET /api/buyer/orders/[id]
 * Single order detail — verifies buyer_id ownership.
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ApiResponse } from '@/types';

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const user = await verifyAuth(request);
    if (!user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', id)
      .eq('buyer_id', user.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ data: null, error: 'Order not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ data, error: null });
  } catch (error) {
    console.error('[api/buyer/orders/[id] GET]', error);
    return NextResponse.json({ data: null, error: 'Failed to fetch order' }, { status: 500 });
  }
}
