/**
 * GET  /api/buyer/profile — Fetch buyer profile with client/branch names
 * PUT  /api/buyer/profile — Update editable profile fields
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ApiResponse } from '@/types';

const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const user = await verifyAuth(request);
    if (!user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

    const supabase = createAdminClient();

    const [clientRes, branchRes] = await Promise.all([
      user.client_id
        ? supabase.from('clients').select('name').eq('id', user.client_id).single()
        : Promise.resolve({ data: null, error: null }),
      user.branch_id
        ? supabase.from('branches').select('name').eq('id', user.branch_id).single()
        : Promise.resolve({ data: null, error: null }),
    ]);

    return NextResponse.json({
      data: {
        ...user,
        client_name: (clientRes.data as { name: string } | null)?.name ?? null,
        branch_name: (branchRes.data as { name: string } | null)?.name ?? null,
      },
      error: null,
    });
  } catch (error) {
    console.error('[api/buyer/profile GET]', error);
    return NextResponse.json({ data: null, error: 'Failed to fetch profile' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT
// ---------------------------------------------------------------------------

interface UpdateProfileBody {
  // Core personal
  full_name?: string;
  phone?: string;
  // New personal fields
  designation?: string | null;
  department?: string | null;
  alt_phone?: string | null;
  procurement_email?: string | null;
  invoice_email?: string | null;
  // Legacy tax/company fields (kept for backward compat)
  company_name?: string;
  company_type?: string;
  gst_number?: string | null;
  /** PAN — stored in tax_id column */
  tax_id?: string | null;
  avatar_url?: string | null;
  saved_addresses?: unknown;
}

export async function PUT(request: NextRequest): Promise<NextResponse<ApiResponse<unknown>>> {
  try {
    const user = await verifyAuth(request);
    if (!user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

    const body = await request.json() as UpdateProfileBody;
    const update: Record<string, unknown> = {};

    if (body.full_name !== undefined) {
      if (!body.full_name.trim()) return NextResponse.json({ data: null, error: 'Name cannot be empty' }, { status: 400 });
      update.full_name = body.full_name.trim();
    }
    if (body.phone !== undefined) update.phone = body.phone.trim() || null;
    if (body.designation !== undefined) update.designation = body.designation?.trim() || null;
    if (body.department !== undefined) update.department = body.department?.trim() || null;
    if (body.alt_phone !== undefined) update.alt_phone = body.alt_phone?.trim() || null;

    if (body.procurement_email !== undefined) {
      const em = body.procurement_email?.trim() || null;
      if (em && !EMAIL_REGEX.test(em)) {
        return NextResponse.json({ data: null, error: 'Invalid procurement email address' }, { status: 400 });
      }
      update.procurement_email = em;
    }
    if (body.invoice_email !== undefined) {
      const em = body.invoice_email?.trim() || null;
      if (em && !EMAIL_REGEX.test(em)) {
        return NextResponse.json({ data: null, error: 'Invalid invoice email address' }, { status: 400 });
      }
      update.invoice_email = em;
    }

    if (body.company_name !== undefined) update.company_name = body.company_name.trim() || null;
    if (body.company_type !== undefined) update.company_type = body.company_type || null;
    if (body.gst_number !== undefined) {
      const gst = body.gst_number?.trim().toUpperCase() ?? null;
      if (gst && !GST_REGEX.test(gst)) {
        return NextResponse.json({ data: null, error: 'Invalid GST number format' }, { status: 400 });
      }
      update.gst_number = gst;
    }
    if (body.tax_id !== undefined) {
      const pan = body.tax_id?.trim().toUpperCase() ?? null;
      if (pan && !PAN_REGEX.test(pan)) {
        return NextResponse.json({ data: null, error: 'Invalid PAN format — expected ABCDE1234F' }, { status: 400 });
      }
      update.tax_id = pan;
    }
    if (body.avatar_url !== undefined) update.avatar_url = body.avatar_url?.trim() || null;
    if (body.saved_addresses !== undefined) update.saved_addresses = body.saved_addresses;

    if (!Object.keys(update).length) {
      return NextResponse.json({ data: null, error: 'No fields to update' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('users')
      .update(update)
      .eq('id', user.id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ data, error: null });
  } catch (error) {
    console.error('[api/buyer/profile PUT]', error);
    return NextResponse.json({ data: null, error: 'Failed to update profile' }, { status: 500 });
  }
}
