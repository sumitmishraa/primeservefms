/**
 * GET  /api/buyer/clients/[clientId]/branches
 * POST /api/buyer/clients/[clientId]/branches
 *
 * Buyer-facing branch management.
 * GET:  Returns active branches for the client (buyer must have access).
 * POST: Creates a new branch immediately under the client.
 *
 * Security: buyer must appear in user_clients for this clientId (or have
 * users.client_id matching) before any operation is allowed.
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ApiResponse } from '@/types';

interface RouteContext {
  params: Promise<{ clientId: string }>;
}

export interface BranchWithStats {
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
  is_active: boolean;
  created_at: string;
  active_orders: number;
  monthly_spend: number;
}

/** Verify the buyer has access to the given clientId */
async function checkClientAccess(userId: string, userClientId: string | null, clientId: string): Promise<boolean> {
  if (userClientId === clientId) return true;
  const supabase = createAdminClient();
  const { data } = await supabase
    .from('user_clients')
    .select('id')
    .eq('user_id', userId)
    .eq('client_id', clientId)
    .maybeSingle();
  return !!data;
}

export async function GET(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse<ApiResponse<BranchWithStats[]>>> {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    const { clientId } = await context.params;

    const hasAccess = await checkClientAccess(user.id, user.client_id, clientId);
    if (!hasAccess) {
      return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });
    }

    const supabase = createAdminClient();

    const [branchesResult, ordersResult] = await Promise.all([
      supabase
        .from('branches')
        .select('id, client_id, name, branch_code, area, address, city, pincode, contact_person, contact_phone, contact_email, is_active, created_at')
        .eq('client_id', clientId)
        .eq('is_active', true)
        .order('name', { ascending: true }),

      supabase
        .from('orders')
        .select('branch_id, status, total_amount, created_at')
        .eq('client_id', clientId)
        .not('branch_id', 'is', null),
    ]);

    if (branchesResult.error) throw branchesResult.error;

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const ACTIVE = new Set(['pending', 'approved', 'forwarded_to_vendor', 'dispatched']);

    const activeMap = new Map<string, number>();
    const spendMap = new Map<string, number>();

    for (const order of ordersResult.data ?? []) {
      if (!order.branch_id) continue;
      if (ACTIVE.has(order.status)) {
        activeMap.set(order.branch_id, (activeMap.get(order.branch_id) ?? 0) + 1);
      }
      if (order.created_at >= monthStart && order.status !== 'cancelled') {
        spendMap.set(order.branch_id, (spendMap.get(order.branch_id) ?? 0) + (order.total_amount ?? 0));
      }
    }

    const result: BranchWithStats[] = (branchesResult.data ?? []).map((b) => ({
      id: b.id,
      client_id: b.client_id,
      name: b.name,
      branch_code: b.branch_code,
      area: b.area,
      address: b.address,
      city: b.city,
      pincode: b.pincode,
      contact_person: b.contact_person,
      contact_phone: b.contact_phone,
      contact_email: b.contact_email,
      is_active: b.is_active,
      created_at: b.created_at,
      active_orders: activeMap.get(b.id) ?? 0,
      monthly_spend: Math.round(spendMap.get(b.id) ?? 0),
    }));

    return NextResponse.json({ data: result, error: null });
  } catch (error) {
    console.error('[api/buyer/clients/[clientId]/branches GET]', error);
    return NextResponse.json({ data: null, error: 'Failed to fetch branches' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  context: RouteContext,
): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    const { clientId } = await context.params;

    const hasAccess = await checkClientAccess(user.id, user.client_id, clientId);
    if (!hasAccess) {
      return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });
    }

    const body = (await request.json()) as {
      name?: string;
      address?: string;
      city?: string;
      area?: string;
      pincode?: string;
      contact_person?: string;
      contact_phone?: string;
      contact_email?: string;
    };

    if (!body.name?.trim()) {
      return NextResponse.json({ data: null, error: 'Branch name is required' }, { status: 400 });
    }
    if (!body.city?.trim()) {
      return NextResponse.json({ data: null, error: 'City is required' }, { status: 400 });
    }

    const supabase = createAdminClient();

    const { data: created, error: insertErr } = await supabase
      .from('branches')
      .insert({
        client_id: clientId,
        name: body.name.trim(),
        address: body.address?.trim() ?? null,
        city: body.city.trim(),
        area: body.area?.trim() ?? null,
        pincode: body.pincode?.trim() ?? null,
        contact_person: body.contact_person?.trim() ?? null,
        contact_phone: body.contact_phone?.trim() ?? null,
        contact_email: body.contact_email?.trim() ?? null,
      })
      .select()
      .single();

    if (insertErr) {
      console.error('[api/buyer/clients/[clientId]/branches POST] insert:', insertErr);
      return NextResponse.json({ data: null, error: 'Failed to create branch' }, { status: 500 });
    }

    return NextResponse.json({ data: created, error: null }, { status: 201 });
  } catch (error) {
    console.error('[api/buyer/clients/[clientId]/branches POST]', error);
    return NextResponse.json({ data: null, error: 'Internal server error' }, { status: 500 });
  }
}
