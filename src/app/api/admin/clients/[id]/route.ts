/**
 * GET    /api/admin/clients/[id]  — Full client detail with branches, recent orders, and stats.
 * PUT    /api/admin/clients/[id]  — Update client fields.
 * DELETE /api/admin/clients/[id]  — Soft-delete client (sets is_active = false).
 *
 * Admin-only. Returns 403 for non-admin sessions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';

// ---------------------------------------------------------------------------
// Response shape types (exported so client pages can import them)
// ---------------------------------------------------------------------------

export interface ClientDetailBranch {
  id: string;
  name: string;
  branch_code: string | null;
  area: string | null;
  address: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  is_active: boolean;
  total_orders: number;
  total_revenue: number;
  pending_amount: number;
  last_order_date: string | null;
}

export interface ClientDetailOrder {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  created_at: string;
  branch_name: string | null;
  buyer_name: string;
  items_count: number;
}

export interface ClientDetail {
  id: string;
  name: string;
  display_name: string;
  industry: string | null;
  logo_url: string | null;
  contact_person: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  city: string;
  gst_number: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  branches: ClientDetailBranch[];
  recent_orders: ClientDetailOrder[];
  stats: {
    total_orders: number;
    total_revenue: number;
    pending_amount: number;
    last_order_date: string | null;
    active_branches: number;
  };
}

// ---------------------------------------------------------------------------
// Internal raw shapes from Supabase join queries
// ---------------------------------------------------------------------------

interface RawOrderWithJoins {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  created_at: string;
  branch_id: string | null;
  buyer: { full_name: string } | null;
  items: { id: string }[];
}

interface RawBranchRow {
  id: string;
  name: string;
  branch_code: string | null;
  area: string | null;
  address: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  is_active: boolean;
}

interface RawClientRow {
  id: string;
  name: string;
  display_name: string;
  industry: string | null;
  logo_url: string | null;
  contact_person: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  address: string | null;
  city: string;
  gst_number: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface UpdateClientBody {
  name?: string;
  display_name?: string;
  industry?: string | null;
  contact_person?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  address?: string | null;
  city?: string;
  gst_number?: string | null;
  notes?: string | null;
}

// ---------------------------------------------------------------------------
// Route context type
// ---------------------------------------------------------------------------

interface RouteContext {
  params: Promise<{ id: string }>;
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

/**
 * GET /api/admin/clients/[id]
 *
 * Returns full client detail: profile, all branches (with stats),
 * last 10 orders, and aggregate stats.
 *
 * @param request - Incoming NextRequest
 * @param context - Route context containing the client id param
 * @returns ClientDetail object
 */
export async function GET(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
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

    const { id } = await context.params;
    const supabase = createAdminClient();

    // 2. Fetch client row
    const { data: clientRaw, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('id', id)
      .single();

    if (clientError || !clientRaw) {
      return NextResponse.json(
        { data: null, error: 'Client not found' },
        { status: 404 }
      );
    }
    const client = clientRaw as RawClientRow;

    // 3. Parallel fetch: branches + orders for this client
    const [branchesResult, ordersResult] = await Promise.all([
      supabase
        .from('branches')
        .select('id, name, branch_code, area, address, contact_person, contact_phone, is_active')
        .eq('client_id', id)
        .order('name', { ascending: true }),

      supabase
        .from('orders')
        .select(
          'id, order_number, status, total_amount, created_at, branch_id, buyer:users!buyer_id(full_name), items:order_items(id)'
        )
        .eq('client_id', id)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);

    const branches = (branchesResult.data ?? []) as RawBranchRow[];
    const allOrders = (ordersResult.data ?? []) as unknown as RawOrderWithJoins[];

    // 4. Build a lookup map: branch_id → branch name
    const branchNameById = new Map<string, string>();
    for (const b of branches) {
      branchNameById.set(b.id, b.name);
    }

    // 5. Compute per-branch stats by iterating all orders
    interface BranchStats {
      total_orders: number;
      total_revenue: number;
      pending_amount: number;
      last_order_date: string | null;
    }
    const branchStatsMap = new Map<string, BranchStats>();

    // Client-level accumulators
    let clientTotalOrders = 0;
    let clientTotalRevenue = 0;
    let clientPendingAmount = 0;
    let clientLastOrderDate: string | null = null;

    for (const order of allOrders) {
      clientTotalOrders++;
      if (order.status === 'delivered') clientTotalRevenue += order.total_amount ?? 0;
      if (!['delivered', 'cancelled'].includes(order.status)) {
        clientPendingAmount += order.total_amount ?? 0;
      }
      if (!clientLastOrderDate || order.created_at > clientLastOrderDate) {
        clientLastOrderDate = order.created_at;
      }

      // Branch-level
      if (order.branch_id) {
        const bs: BranchStats = branchStatsMap.get(order.branch_id) ?? {
          total_orders: 0,
          total_revenue: 0,
          pending_amount: 0,
          last_order_date: null,
        };
        bs.total_orders++;
        if (order.status === 'delivered') bs.total_revenue += order.total_amount ?? 0;
        if (!['delivered', 'cancelled'].includes(order.status)) {
          bs.pending_amount += order.total_amount ?? 0;
        }
        if (!bs.last_order_date || order.created_at > bs.last_order_date) {
          bs.last_order_date = order.created_at;
        }
        branchStatsMap.set(order.branch_id, bs);
      }
    }

    // 6. Shape branches output
    const branchesOut: ClientDetailBranch[] = branches.map((b) => {
      const bs = branchStatsMap.get(b.id);
      return {
        id: b.id,
        name: b.name,
        branch_code: b.branch_code,
        area: b.area,
        address: b.address,
        contact_person: b.contact_person,
        contact_phone: b.contact_phone,
        is_active: b.is_active,
        total_orders: bs?.total_orders ?? 0,
        total_revenue: bs?.total_revenue ?? 0,
        pending_amount: bs?.pending_amount ?? 0,
        last_order_date: bs?.last_order_date ?? null,
      };
    });

    // 7. Shape recent orders (top 10 from the 50 fetched)
    const recentOrders: ClientDetailOrder[] = allOrders.slice(0, 10).map((order) => ({
      id: order.id,
      order_number: order.order_number,
      status: order.status,
      total_amount: order.total_amount,
      created_at: order.created_at,
      branch_name: order.branch_id ? (branchNameById.get(order.branch_id) ?? null) : null,
      buyer_name: order.buyer?.full_name ?? 'Unknown Buyer',
      items_count: order.items?.length ?? 0,
    }));

    // 8. Assemble final response
    const detail: ClientDetail = {
      id: client.id,
      name: client.name,
      display_name: client.display_name,
      industry: client.industry,
      logo_url: client.logo_url,
      contact_person: client.contact_person,
      contact_email: client.contact_email,
      contact_phone: client.contact_phone,
      address: client.address,
      city: client.city,
      gst_number: client.gst_number,
      notes: client.notes,
      is_active: client.is_active,
      created_at: client.created_at,
      updated_at: client.updated_at,
      branches: branchesOut,
      recent_orders: recentOrders,
      stats: {
        total_orders: clientTotalOrders,
        total_revenue: clientTotalRevenue,
        pending_amount: clientPendingAmount,
        last_order_date: clientLastOrderDate,
        active_branches: branches.filter((b) => b.is_active).length,
      },
    };

    return NextResponse.json({ data: detail, error: null });
  } catch (error) {
    console.error('[api/admin/clients/[id] GET]', error);
    return NextResponse.json(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/admin/clients/[id]
 *
 * Updates client fields. All fields are optional — only provided fields are updated.
 *
 * @param request - Incoming NextRequest with JSON body
 * @param context - Route context containing the client id param
 * @returns Updated client row
 */
export async function PUT(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
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

    const { id } = await context.params;
    const body = (await request.json()) as Partial<UpdateClientBody>;
    const supabase = createAdminClient();

    // Build update object — only include fields that were provided
    const updatePayload: Partial<UpdateClientBody> = {};
    if (body.name !== undefined) updatePayload.name = body.name;
    if (body.display_name !== undefined) updatePayload.display_name = body.display_name;
    if (body.industry !== undefined) updatePayload.industry = body.industry;
    if (body.contact_person !== undefined) updatePayload.contact_person = body.contact_person;
    if (body.contact_email !== undefined) updatePayload.contact_email = body.contact_email;
    if (body.contact_phone !== undefined) updatePayload.contact_phone = body.contact_phone;
    if (body.address !== undefined) updatePayload.address = body.address;
    if (body.city !== undefined) updatePayload.city = body.city;
    if (body.gst_number !== undefined) updatePayload.gst_number = body.gst_number;
    if (body.notes !== undefined) updatePayload.notes = body.notes;

    const { data: updated, error: updateError } = await supabase
      .from('clients')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('[api/admin/clients/[id] PUT] update error:', updateError);
      return NextResponse.json(
        { data: null, error: 'Failed to update client' },
        { status: 500 }
      );
    }

    if (!updated) {
      return NextResponse.json(
        { data: null, error: 'Client not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: updated, error: null });
  } catch (error) {
    console.error('[api/admin/clients/[id] PUT]', error);
    return NextResponse.json(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/clients/[id]
 *
 * Soft-deletes a client by setting is_active = false.
 * Does NOT hard-delete — all data is preserved for historical orders.
 *
 * @param request - Incoming NextRequest
 * @param context - Route context containing the client id param
 * @returns { success: true }
 */
export async function DELETE(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
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

    const { id } = await context.params;
    const supabase = createAdminClient();

    const { error: updateError } = await supabase
      .from('clients')
      .update({ is_active: false })
      .eq('id', id);

    if (updateError) {
      console.error('[api/admin/clients/[id] DELETE] error:', updateError);
      return NextResponse.json(
        { data: null, error: 'Failed to deactivate client' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: { success: true }, error: null });
  } catch (error) {
    console.error('[api/admin/clients/[id] DELETE]', error);
    return NextResponse.json(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
