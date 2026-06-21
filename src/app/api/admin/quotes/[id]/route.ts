/**
 * PATCH /api/admin/quotes/[id] — Update quote status, quoted_amount, admin_notes, valid_until
 * Admin-only.
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidUUID } from '@/lib/security/validate';

interface PatchBody {
  status?: 'submitted' | 'under_review' | 'quoted' | 'accepted' | 'rejected';
  quoted_amount?: number | null;
  admin_notes?: string | null;
  valid_until?: string | null;
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  try {
    const user = await verifyAuth(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });
    }

    const { id } = await params;
    if (!isValidUUID(id)) {
      return NextResponse.json({ data: null, error: 'Invalid quote ID' }, { status: 400 });
    }

    const body = await request.json() as PatchBody;

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.status !== undefined) updates.status = body.status;
    if (body.quoted_amount !== undefined) updates.quoted_amount = body.quoted_amount;
    if (body.admin_notes !== undefined) updates.admin_notes = body.admin_notes;
    if (body.valid_until !== undefined) updates.valid_until = body.valid_until;

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('quote_requests')
      .update(updates as never)
      .eq('id', id)
      .select('id, status, quoted_amount, admin_notes, valid_until, updated_at')
      .single();

    if (error) throw error;

    return NextResponse.json({ data, error: null });
  } catch (error) {
    console.error('[api/admin/quotes/[id] PATCH]', error);
    return NextResponse.json({ data: null, error: 'Failed to update quote' }, { status: 500 });
  }
}
