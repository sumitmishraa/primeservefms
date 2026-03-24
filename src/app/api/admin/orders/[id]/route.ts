/**
 * Admin single-order API — /api/admin/orders/[id]
 *
 * GET  — Full order detail: order row + all order_items + buyer profile.
 *         Admin-only.
 *
 * PATCH — Update order fields. Admin-only.
 *         Allowed updates: status, assigned_vendor_name, assigned_vendor_phone, admin_notes.
 *         Enforces valid status transitions.
 *         Auto-sets forwarded_at / dispatched_at / delivered_at timestamps.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Tables, Enums } from '@/types/database';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type OrderRow    = Tables<'orders'>;
type OrderStatus = Enums<'order_status'>;

export interface OrderDetail extends OrderRow {
  items: Tables<'order_items'>[];
  buyer: Pick<
    Tables<'users'>,
    'id' | 'full_name' | 'company_name' | 'email' | 'phone'
  > | null;
}

// ---------------------------------------------------------------------------
// Status transition rules
// ---------------------------------------------------------------------------

/**
 * Defines which statuses each status can transition to.
 * delivered and cancelled are terminal — no further transitions allowed.
 */
const VALID_TRANSITIONS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  pending:             ['approved', 'cancelled'],
  approved:            ['forwarded_to_vendor', 'cancelled'],
  forwarded_to_vendor: ['dispatched', 'cancelled'],
  dispatched:          ['delivered', 'cancelled'],
};

/**
 * Returns true if transitioning from `current` to `next` is allowed.
 */
function isValidTransition(current: OrderStatus, next: OrderStatus): boolean {
  const allowed = VALID_TRANSITIONS[current];
  if (!allowed) return false; // terminal status — no transitions
  return allowed.includes(next);
}

/**
 * Returns the timestamp field to auto-set for a given target status.
 * Returns null if no auto-timestamp applies.
 */
function getTimestampField(
  status: OrderStatus
): 'forwarded_at' | 'dispatched_at' | 'delivered_at' | null {
  if (status === 'forwarded_to_vendor') return 'forwarded_at';
  if (status === 'dispatched')          return 'dispatched_at';
  if (status === 'delivered')           return 'delivered_at';
  return null;
}

// ---------------------------------------------------------------------------
// GET — single order with full detail
// ---------------------------------------------------------------------------

/**
 * Returns one order with all items and the buyer's profile merged.
 *
 * @param _request - Incoming request
 * @param params   - Route params containing `id` (order UUID)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ data: null, error: 'Not authenticated' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return NextResponse.json({ data: null, error: 'Forbidden — admin access only' }, { status: 403 });
    }

    const { id } = await params;
    const supabase = createAdminClient();

    // Fetch order, items, and buyer in parallel
    const [orderResult, itemsResult] = await Promise.all([
      supabase.from('orders').select('*').eq('id', id).single(),
      supabase.from('order_items').select('*').eq('order_id', id).order('created_at', { ascending: true }),
    ]);

    if (orderResult.error || !orderResult.data) {
      return NextResponse.json({ data: null, error: 'Order not found' }, { status: 404 });
    }

    const order = orderResult.data;

    // Fetch buyer profile
    const { data: buyer } = await supabase
      .from('users')
      .select('id, full_name, company_name, email, phone')
      .eq('id', order.buyer_id)
      .single();

    const detail: OrderDetail = {
      ...order,
      items:  itemsResult.data ?? [],
      buyer:  buyer ?? null,
    };

    return NextResponse.json({ data: detail, error: null });
  } catch (error) {
    console.error('[api/admin/orders/[id] GET]', error);
    return NextResponse.json({ data: null, error: 'Internal server error' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PATCH — update order (status + vendor assignment + admin notes)
// ---------------------------------------------------------------------------

interface PatchBody {
  status?:                 OrderStatus;
  assigned_vendor_name?:   string | null;
  assigned_vendor_phone?:  string | null;
  admin_notes?:            string | null;
  cancelled_reason?:       string | null;
}

/**
 * Updates allowed order fields. Enforces status transition rules.
 * Auto-sets forwarded_at / dispatched_at / delivered_at when status changes.
 *
 * @param request - Incoming request with JSON body
 * @param params  - Route params containing `id` (order UUID)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ data: null, error: 'Not authenticated' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return NextResponse.json({ data: null, error: 'Forbidden — admin access only' }, { status: 403 });
    }

    const { id } = await params;
    const body = (await request.json()) as PatchBody;

    const supabase = createAdminClient();

    // Fetch current order to validate the transition
    const { data: existing, error: fetchError } = await supabase
      .from('orders')
      .select('id, status')
      .eq('id', id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ data: null, error: 'Order not found' }, { status: 404 });
    }

    // Build the update payload — typed to match the Insert shape (Json-compatible)
    const updates: Record<string, unknown> = {};

    // Handle status transition
    if (body.status !== undefined && body.status !== existing.status) {
      if (!isValidTransition(existing.status, body.status)) {
        return NextResponse.json(
          {
            data: null,
            error: `Invalid status transition: ${existing.status} → ${body.status}`,
          },
          { status: 400 }
        );
      }
      updates.status = body.status;

      // Auto-set timestamp
      const tsField = getTimestampField(body.status);
      if (tsField) {
        (updates as Record<string, unknown>)[tsField] = new Date().toISOString();
      }
    }

    // Vendor assignment fields
    if (body.assigned_vendor_name !== undefined) {
      updates.assigned_vendor_name = body.assigned_vendor_name;
    }
    if (body.assigned_vendor_phone !== undefined) {
      updates.assigned_vendor_phone = body.assigned_vendor_phone;
    }

    // Admin notes
    if (body.admin_notes !== undefined) {
      updates.admin_notes = body.admin_notes;
    }

    // Cancellation reason
    if (body.cancelled_reason !== undefined) {
      updates.cancelled_reason = body.cancelled_reason;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ data: null, error: 'No valid fields to update' }, { status: 400 });
    }

    const { data: updated, error: updateError } = await supabase
      .from('orders')
      .update(updates)
      .eq('id', id)
      .select('*')
      .single();

    if (updateError || !updated) {
      console.error('[api/admin/orders/[id] PATCH] Supabase error:', updateError?.message);
      return NextResponse.json({ data: null, error: 'Failed to update order' }, { status: 500 });
    }

    return NextResponse.json({ data: updated, error: null });
  } catch (error) {
    console.error('[api/admin/orders/[id] PATCH]', error);
    return NextResponse.json({ data: null, error: 'Internal server error' }, { status: 500 });
  }
}
