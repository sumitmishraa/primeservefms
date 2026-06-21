/**
 * GET /api/orders/[id]
 * Returns a single order by ID. Buyer can only fetch their own orders.
 *
 * PATCH /api/orders/[id]
 * Admin-only: update order status.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ApiResponse } from '@/types';
import { isValidUUID, validateEnum } from '@/lib/security/validate';

interface RouteParams {
  params: Promise<{ id: string }>;
}

// ---------------------------------------------------------------------------
// GET — fetch single order
// ---------------------------------------------------------------------------

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'buyer') {
      return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    if (!isValidUUID(id)) {
      return NextResponse.json({ data: null, error: 'Order not found' }, { status: 404 });
    }

    const supabase = createAdminClient();

    const query = supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', id);

    // Buyers can only view their own orders; admins see all.
    // Vendors must use vendor-specific endpoints so they cannot enumerate
    // arbitrary order IDs and see buyer addresses or payment metadata.
    if (user.role === 'buyer') {
      query.eq('buyer_id', user.id);
    }

    const { data, error } = await query.single();

    if (error) {
      if (error.code === 'PGRST116') {
        return NextResponse.json({ data: null, error: 'Order not found' }, { status: 404 });
      }
      throw error;
    }

    return NextResponse.json({ data, error: null });
  } catch (error) {
    console.error('[api/orders/[id] GET]', error);
    return NextResponse.json(
      { data: null, error: 'Failed to fetch order' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH — admin updates order status
// ---------------------------------------------------------------------------

interface PatchOrderBody {
  status?: string;
  payment_status?: string;
  assigned_vendor_name?: string | null;
  assigned_vendor_phone?: string | null;
  admin_notes?: string | null;
  cancelled_reason?: string | null;
}

export async function PATCH(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    if (!isValidUUID(id)) {
      return NextResponse.json({ data: null, error: 'Order not found' }, { status: 404 });
    }

    const body = await request.json() as PatchOrderBody;

    // Allowed enum values — reject arbitrary strings
    const ALLOWED_ORDER_STATUSES = [
      'pending', 'approved', 'forwarded_to_vendor', 'dispatched', 'delivered', 'cancelled',
    ] as const;
    const ALLOWED_PAYMENT_STATUSES = ['pending', 'paid', 'failed', 'refunded'] as const;

    // Build update payload — only include provided fields
    const update: Record<string, unknown> = {};
    if (body.status !== undefined) {
      const validStatus = validateEnum(body.status, ALLOWED_ORDER_STATUSES);
      if (!validStatus) {
        return NextResponse.json({ data: null, error: 'Invalid status value' }, { status: 400 });
      }
      update.status = validStatus;
    }
    if (body.payment_status !== undefined) {
      const validPaymentStatus = validateEnum(body.payment_status, ALLOWED_PAYMENT_STATUSES);
      if (!validPaymentStatus) {
        return NextResponse.json({ data: null, error: 'Invalid payment_status value' }, { status: 400 });
      }
      update.payment_status = validPaymentStatus;
    }
    if (body.assigned_vendor_name !== undefined) update.assigned_vendor_name = body.assigned_vendor_name;
    if (body.assigned_vendor_phone !== undefined) update.assigned_vendor_phone = body.assigned_vendor_phone;
    if (body.admin_notes !== undefined) update.admin_notes = body.admin_notes;
    if (body.cancelled_reason !== undefined) update.cancelled_reason = body.cancelled_reason;

    // Set timestamp fields based on status transitions
    if (body.status === 'forwarded_to_vendor') update.forwarded_at = new Date().toISOString();
    if (body.status === 'dispatched') update.dispatched_at = new Date().toISOString();
    if (body.status === 'delivered') update.delivered_at = new Date().toISOString();

    if (Object.keys(update).length === 0) {
      return NextResponse.json({ data: null, error: 'No fields to update' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('orders')
      .update(update as never)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ data, error: null });
  } catch (error) {
    console.error('[api/orders/[id] PATCH]', error);
    return NextResponse.json(
      { data: null, error: 'Failed to update order' },
      { status: 500 }
    );
  }
}
