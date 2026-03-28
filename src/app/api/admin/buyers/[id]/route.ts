/**
 * PATCH /api/admin/buyers/[id]
 *
 * Updates a buyer's client_id and/or branch_id assignment.
 * Pass null for either field to unassign.
 *
 * Admin-only — returns 403 for non-admin sessions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

interface AssignBody {
  client_id?: string | null;
  branch_id?: string | null;
}

/**
 * PATCH /api/admin/buyers/[id]
 *
 * Assigns or unassigns a buyer from a client and/or branch.
 *
 * @param request - Incoming NextRequest with JSON body { client_id, branch_id }
 * @param params - Route params containing the buyer user id
 * @returns Updated user row
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
    const body = (await request.json()) as AssignBody;

    const supabase = createAdminClient();

    // Build update payload — only include fields that were passed
    const updatePayload: { client_id?: string | null; branch_id?: string | null } = {};
    if ('client_id' in body) updatePayload.client_id = body.client_id ?? null;
    if ('branch_id' in body) updatePayload.branch_id = body.branch_id ?? null;

    if (Object.keys(updatePayload).length === 0) {
      return NextResponse.json({ data: null, error: 'No fields to update' }, { status: 400 });
    }

    const { data: updated, error: dbError } = await supabase
      .from('users')
      .update(updatePayload)
      .eq('id', id)
      .eq('role', 'buyer')
      .select('id, full_name, client_id, branch_id')
      .single();

    if (dbError) {
      console.error('[api/admin/buyers/[id] PATCH] error:', dbError.message);
      return NextResponse.json({ data: null, error: 'Failed to update buyer' }, { status: 500 });
    }

    return NextResponse.json({ data: updated, error: null });
  } catch (error) {
    console.error('[api/admin/buyers/[id] PATCH]', error);
    return NextResponse.json({ data: null, error: 'Internal server error' }, { status: 500 });
  }
}
