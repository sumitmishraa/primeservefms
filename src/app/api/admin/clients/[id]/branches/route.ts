/**
 * GET  /api/admin/clients/[id]/branches  — List all branches for a client with order stats.
 * POST /api/admin/clients/[id]/branches  — Create a new branch under a client.
 *
 * Admin-only. Returns 403 for non-admin sessions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Tables } from '@/types/database';

// ---------------------------------------------------------------------------
// Response shape types
// ---------------------------------------------------------------------------

export interface BranchListItem {
  id: string;
  client_id: string;
  name: string;
  branch_code: string | null;
  area: string | null;
  address: string | null;
  city: string;
  pincode: string | null;
  contact_person: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  total_orders: number;
  total_revenue: number;
  pending_amount: number;
}

// ---------------------------------------------------------------------------
// Internal helper types
// ---------------------------------------------------------------------------

interface RawOrderStat {
  branch_id: string | null;
  status: string;
  total_amount: number;
}

interface BranchStatsAccumulator {
  total_orders: number;
  total_revenue: number;
  pending_amount: number;
}

// ---------------------------------------------------------------------------
// POST body shape
// ---------------------------------------------------------------------------

interface CreateBranchBody {
  name: string;
  branch_code?: string | null;
  area?: string | null;
  address?: string | null;
  city?: string;
  pincode?: string | null;
  contact_person?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
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
 * GET /api/admin/clients/[id]/branches
 *
 * Returns all branches for a given client, each enriched with order stats
 * (total orders placed, total revenue, pending amount).
 *
 * @param request - Incoming NextRequest
 * @param context - Route context containing the client id param
 * @returns JSON array of BranchListItem objects
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

    const { id: clientId } = await context.params;
    const supabase = createAdminClient();

    // 2. Verify client exists
    const { data: clientExists, error: clientCheckError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .single();

    if (clientCheckError || !clientExists) {
      return NextResponse.json(
        { data: null, error: 'Client not found' },
        { status: 404 }
      );
    }

    // 3. Fetch branches and orders in parallel
    const [branchesResult, ordersResult] = await Promise.all([
      supabase
        .from('branches')
        .select('*')
        .eq('client_id', clientId)
        .order('name', { ascending: true }),

      supabase
        .from('orders')
        .select('branch_id, status, total_amount')
        .eq('client_id', clientId)
        .not('branch_id', 'is', null),
    ]);

    const branches = (branchesResult.data ?? []) as Tables<'branches'>[];

    // 4. Aggregate order stats per branch
    const statsMap = new Map<string, BranchStatsAccumulator>();
    for (const order of (ordersResult.data ?? []) as RawOrderStat[]) {
      if (!order.branch_id) continue;
      const s: BranchStatsAccumulator = statsMap.get(order.branch_id) ?? {
        total_orders: 0,
        total_revenue: 0,
        pending_amount: 0,
      };
      s.total_orders++;
      if (order.status === 'delivered') s.total_revenue += order.total_amount ?? 0;
      if (!['delivered', 'cancelled'].includes(order.status)) {
        s.pending_amount += order.total_amount ?? 0;
      }
      statsMap.set(order.branch_id, s);
    }

    // 5. Merge branches with stats
    const result: BranchListItem[] = branches.map((branch) => {
      const stats = statsMap.get(branch.id);
      return {
        id: branch.id,
        client_id: branch.client_id,
        name: branch.name,
        branch_code: branch.branch_code,
        area: branch.area,
        address: branch.address,
        city: branch.city,
        pincode: branch.pincode,
        contact_person: branch.contact_person,
        contact_phone: branch.contact_phone,
        contact_email: branch.contact_email,
        notes: branch.notes,
        is_active: branch.is_active,
        created_at: branch.created_at,
        total_orders: stats?.total_orders ?? 0,
        total_revenue: stats?.total_revenue ?? 0,
        pending_amount: stats?.pending_amount ?? 0,
      };
    });

    return NextResponse.json({ data: result, error: null });
  } catch (error) {
    console.error('[api/admin/clients/[id]/branches GET]', error);
    return NextResponse.json(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/clients/[id]/branches
 *
 * Creates a new branch under the specified client. `name` is required.
 *
 * @param request - Incoming NextRequest with JSON body
 * @param context - Route context containing the client id param
 * @returns Newly created branch row
 */
export async function POST(
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

    const { id: clientId } = await context.params;
    const supabase = createAdminClient();

    // 2. Verify client exists
    const { data: clientExists, error: clientCheckError } = await supabase
      .from('clients')
      .select('id')
      .eq('id', clientId)
      .single();

    if (clientCheckError || !clientExists) {
      return NextResponse.json(
        { data: null, error: 'Client not found' },
        { status: 404 }
      );
    }

    // 3. Parse and validate body
    const body = (await request.json()) as Partial<CreateBranchBody>;

    if (!body.name?.trim()) {
      return NextResponse.json(
        { data: null, error: 'name is required' },
        { status: 400 }
      );
    }

    // 4. Insert new branch
    const { data: created, error: insertError } = await supabase
      .from('branches')
      .insert({
        client_id: clientId,
        name: body.name.trim(),
        branch_code: body.branch_code ?? null,
        area: body.area ?? null,
        address: body.address ?? null,
        city: body.city ?? 'Bangalore',
        pincode: body.pincode ?? null,
        contact_person: body.contact_person ?? null,
        contact_phone: body.contact_phone ?? null,
        contact_email: body.contact_email ?? null,
        notes: body.notes ?? null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[api/admin/clients/[id]/branches POST] insert error:', insertError);
      return NextResponse.json(
        { data: null, error: 'Failed to create branch' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: created, error: null }, { status: 201 });
  } catch (error) {
    console.error('[api/admin/clients/[id]/branches POST]', error);
    return NextResponse.json(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
