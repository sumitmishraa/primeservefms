/**
 * GET  /api/admin/clients  — List all clients with computed order/branch stats.
 * POST /api/admin/clients  — Create a new client.
 *
 * Admin-only. Returns 403 for non-admin sessions.
 *
 * GET supports:
 *   ?search=   ILIKE filter on client name
 *   ?is_active= true | false  (default: true — only active clients)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Tables } from '@/types/database';

// ---------------------------------------------------------------------------
// Response shape types (exported so client pages can import them)
// ---------------------------------------------------------------------------

export interface ClientListItem {
  id: string;
  name: string;
  display_name: string;
  industry: string | null;
  contact_person: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  city: string;
  is_active: boolean;
  created_at: string;
  total_branches: number;
  total_orders: number;
  total_revenue: number;
  pending_amount: number;
  last_order_date: string | null;
}

// ---------------------------------------------------------------------------
// Internal aggregation helper types
// ---------------------------------------------------------------------------

interface OrderStatsAccumulator {
  total_orders: number;
  total_revenue: number;
  pending_amount: number;
  last_order_date: string | null;
}

interface RawOrderStat {
  client_id: string | null;
  status: string;
  total_amount: number;
  created_at: string;
}

interface RawBranchCount {
  client_id: string;
}

// ---------------------------------------------------------------------------
// POST body shape
// ---------------------------------------------------------------------------

interface CreateClientBody {
  name: string;
  display_name: string;
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
// Route handlers
// ---------------------------------------------------------------------------

/**
 * GET /api/admin/clients
 *
 * Returns all clients with computed stats (branch count, order totals, revenue).
 * Supports ?search= (ILIKE on name) and ?is_active=true/false.
 *
 * @param request - Incoming NextRequest
 * @returns JSON array of ClientListItem objects
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
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

    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') ?? '';
    const isActiveParam = searchParams.get('is_active');
    // Default: show only active clients
    const filterActive = isActiveParam === 'false' ? false : true;

    // 2. Fetch clients (with optional search and active filter)
    let clientQuery = supabase
      .from('clients')
      .select('id, name, display_name, industry, contact_person, contact_email, contact_phone, city, is_active, created_at')
      .eq('is_active', filterActive)
      .order('name', { ascending: true });

    if (search.trim()) {
      clientQuery = clientQuery.ilike('name', `%${search.trim()}%`);
    }

    const { data: clients, error: clientsError } = await clientQuery;
    if (clientsError) {
      console.error('[api/admin/clients GET] clients query error:', clientsError);
      return NextResponse.json(
        { data: null, error: 'Failed to fetch clients' },
        { status: 500 }
      );
    }

    if (!clients || clients.length === 0) {
      return NextResponse.json({ data: [], error: null });
    }

    // 3. Fetch active branch counts per client
    const { data: branchRows } = await supabase
      .from('branches')
      .select('client_id')
      .eq('is_active', true);

    // 4. Fetch all order stats (non-cancelled only is not needed — we aggregate per status)
    const { data: orderRows } = await supabase
      .from('orders')
      .select('client_id, status, total_amount, created_at')
      .not('client_id', 'is', null);

    // 5. Aggregate branch counts per client
    const branchCountByClient = new Map<string, number>();
    for (const row of (branchRows ?? []) as RawBranchCount[]) {
      branchCountByClient.set(
        row.client_id,
        (branchCountByClient.get(row.client_id) ?? 0) + 1
      );
    }

    // 6. Aggregate order stats per client
    const statsByClient = new Map<string, OrderStatsAccumulator>();
    for (const order of (orderRows ?? []) as RawOrderStat[]) {
      if (!order.client_id) continue;
      const s: OrderStatsAccumulator = statsByClient.get(order.client_id) ?? {
        total_orders: 0,
        total_revenue: 0,
        pending_amount: 0,
        last_order_date: null,
      };
      s.total_orders++;
      if (order.status === 'delivered') {
        s.total_revenue += order.total_amount ?? 0;
      }
      if (!['delivered', 'cancelled'].includes(order.status)) {
        s.pending_amount += order.total_amount ?? 0;
      }
      if (!s.last_order_date || order.created_at > s.last_order_date) {
        s.last_order_date = order.created_at;
      }
      statsByClient.set(order.client_id, s);
    }

    // 7. Merge everything into ClientListItem array
    const result: ClientListItem[] = (
      clients as Tables<'clients'>[]
    ).map((client) => {
      const stats = statsByClient.get(client.id);
      return {
        id: client.id,
        name: client.name,
        display_name: client.display_name,
        industry: client.industry,
        contact_person: client.contact_person,
        contact_email: client.contact_email,
        contact_phone: client.contact_phone,
        city: client.city,
        is_active: client.is_active,
        created_at: client.created_at,
        total_branches: branchCountByClient.get(client.id) ?? 0,
        total_orders: stats?.total_orders ?? 0,
        total_revenue: stats?.total_revenue ?? 0,
        pending_amount: stats?.pending_amount ?? 0,
        last_order_date: stats?.last_order_date ?? null,
      };
    });

    return NextResponse.json({ data: result, error: null });
  } catch (error) {
    console.error('[api/admin/clients GET]', error);
    return NextResponse.json(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/clients
 *
 * Creates a new client. `name` and `display_name` are required.
 *
 * @param request - Incoming NextRequest with JSON body
 * @returns Newly created client row
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
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

    // 2. Parse and validate body
    const body = (await request.json()) as Partial<CreateClientBody>;

    if (!body.name?.trim()) {
      return NextResponse.json(
        { data: null, error: 'name is required' },
        { status: 400 }
      );
    }
    if (!body.display_name?.trim()) {
      return NextResponse.json(
        { data: null, error: 'display_name is required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    // 3. Insert new client
    const { data: created, error: insertError } = await supabase
      .from('clients')
      .insert({
        name: body.name.trim(),
        display_name: body.display_name.trim(),
        industry: body.industry ?? null,
        contact_person: body.contact_person ?? null,
        contact_email: body.contact_email ?? null,
        contact_phone: body.contact_phone ?? null,
        address: body.address ?? null,
        city: body.city ?? 'Bangalore',
        gst_number: body.gst_number ?? null,
        notes: body.notes ?? null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('[api/admin/clients POST] insert error:', insertError);
      return NextResponse.json(
        { data: null, error: 'Failed to create client' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: created, error: null }, { status: 201 });
  } catch (error) {
    console.error('[api/admin/clients POST]', error);
    return NextResponse.json(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
