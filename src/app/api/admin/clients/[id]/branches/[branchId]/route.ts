/**
 * PUT    /api/admin/clients/[id]/branches/[branchId]  — Update branch fields.
 * DELETE /api/admin/clients/[id]/branches/[branchId]  — Soft-delete branch (is_active = false).
 *
 * Admin-only. Returns 403 for non-admin sessions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';

// ---------------------------------------------------------------------------
// Body shape
// ---------------------------------------------------------------------------

interface UpdateBranchBody {
  name?: string;
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
  params: Promise<{ id: string; branchId: string }>;
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------

/**
 * PUT /api/admin/clients/[id]/branches/[branchId]
 *
 * Updates one or more fields on a branch. All fields are optional.
 * The branch must belong to the specified client (enforced by checking both IDs).
 *
 * @param request - Incoming NextRequest with JSON body
 * @param context - Route context containing client id and branchId params
 * @returns Updated branch row
 */
export async function PUT(
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

    const { id: clientId, branchId } = await context.params;
    const body = (await request.json()) as Partial<UpdateBranchBody>;
    const supabase = createAdminClient();

    // 2. Build update object — only include fields that were explicitly provided
    const updatePayload: Partial<UpdateBranchBody> = {};
    if (body.name !== undefined) updatePayload.name = body.name;
    if (body.branch_code !== undefined) updatePayload.branch_code = body.branch_code;
    if (body.area !== undefined) updatePayload.area = body.area;
    if (body.address !== undefined) updatePayload.address = body.address;
    if (body.city !== undefined) updatePayload.city = body.city;
    if (body.pincode !== undefined) updatePayload.pincode = body.pincode;
    if (body.contact_person !== undefined) updatePayload.contact_person = body.contact_person;
    if (body.contact_phone !== undefined) updatePayload.contact_phone = body.contact_phone;
    if (body.contact_email !== undefined) updatePayload.contact_email = body.contact_email;
    if (body.notes !== undefined) updatePayload.notes = body.notes;

    // 3. Update — both client_id and branchId must match for security
    const { data: updated, error: updateError } = await supabase
      .from('branches')
      .update(updatePayload)
      .eq('id', branchId)
      .eq('client_id', clientId)
      .select()
      .single();

    if (updateError) {
      console.error('[api/admin/clients/[id]/branches/[branchId] PUT] error:', updateError);
      return NextResponse.json(
        { data: null, error: 'Failed to update branch' },
        { status: 500 }
      );
    }

    if (!updated) {
      return NextResponse.json(
        { data: null, error: 'Branch not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: updated, error: null });
  } catch (error) {
    console.error('[api/admin/clients/[id]/branches/[branchId] PUT]', error);
    return NextResponse.json(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/admin/clients/[id]/branches/[branchId]
 *
 * Soft-deletes a branch by setting is_active = false.
 * The branch must belong to the specified client.
 *
 * @param request - Incoming NextRequest
 * @param context - Route context containing client id and branchId params
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

    const { id: clientId, branchId } = await context.params;
    const supabase = createAdminClient();

    const { error: updateError } = await supabase
      .from('branches')
      .update({ is_active: false })
      .eq('id', branchId)
      .eq('client_id', clientId);

    if (updateError) {
      console.error('[api/admin/clients/[id]/branches/[branchId] DELETE] error:', updateError);
      return NextResponse.json(
        { data: null, error: 'Failed to deactivate branch' },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: { success: true }, error: null });
  } catch (error) {
    console.error('[api/admin/clients/[id]/branches/[branchId] DELETE]', error);
    return NextResponse.json(
      { data: null, error: 'Internal server error' },
      { status: 500 }
    );
  }
}
