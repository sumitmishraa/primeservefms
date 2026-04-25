/**
 * GET  /api/buyer/company — Fetch buyer's company details
 * PUT  /api/buyer/company — Update company details
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ApiResponse } from '@/types';

const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;

export interface CompanyDetails {
  company_name: string | null;
  company_type: string | null;
  gst_number: string | null;
  tax_id: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  business_verified: boolean;
  client_name: string | null;
  branch_name: string | null;
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<CompanyDetails>>> {
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
        company_name: user.company_name,
        company_type: user.company_type,
        gst_number: user.gst_number,
        tax_id: user.tax_id,
        address_line1: user.address_line1,
        address_line2: user.address_line2,
        city: user.city,
        state: user.state,
        pincode: user.pincode,
        business_verified: user.business_verified,
        client_name: (clientRes.data as { name: string } | null)?.name ?? null,
        branch_name: (branchRes.data as { name: string } | null)?.name ?? null,
      },
      error: null,
    });
  } catch (error) {
    console.error('[api/buyer/company GET]', error);
    return NextResponse.json({ data: null, error: 'Failed to fetch company details' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// PUT
// ---------------------------------------------------------------------------

interface UpdateCompanyBody {
  company_name?: string;
  company_type?: string;
  gst_number?: string | null;
  tax_id?: string | null;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
}

export async function PUT(request: NextRequest): Promise<NextResponse<ApiResponse<null>>> {
  try {
    const user = await verifyAuth(request);
    if (!user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

    const body = await request.json() as UpdateCompanyBody;
    const update: Record<string, unknown> = {};

    if (body.company_name !== undefined) update.company_name = body.company_name.trim() || null;
    if (body.company_type !== undefined) update.company_type = body.company_type || null;

    if (body.gst_number !== undefined) {
      const gst = body.gst_number?.trim().toUpperCase() ?? null;
      if (gst && !GST_REGEX.test(gst)) {
        return NextResponse.json({ data: null, error: 'Invalid GST number format (expected: 22AAAAA0000A1Z5)' }, { status: 400 });
      }
      update.gst_number = gst;
    }

    if (body.tax_id !== undefined) {
      const pan = body.tax_id?.trim().toUpperCase() ?? null;
      if (pan && !PAN_REGEX.test(pan)) {
        return NextResponse.json({ data: null, error: 'Invalid PAN format (expected: ABCDE1234F)' }, { status: 400 });
      }
      update.tax_id = pan;
    }

    if (body.address_line1 !== undefined) update.address_line1 = body.address_line1.trim() || null;
    if (body.address_line2 !== undefined) update.address_line2 = body.address_line2.trim() || null;
    if (body.city !== undefined) update.city = body.city.trim() || null;
    if (body.state !== undefined) update.state = body.state.trim() || null;
    if (body.pincode !== undefined) {
      const pin = body.pincode.trim().replace(/\D/g, '');
      if (pin && pin.length !== 6) {
        return NextResponse.json({ data: null, error: 'Pincode must be 6 digits' }, { status: 400 });
      }
      update.pincode = pin || null;
    }

    if (!Object.keys(update).length) {
      return NextResponse.json({ data: null, error: 'No fields to update' }, { status: 400 });
    }

    const supabase = createAdminClient();
    const { error } = await supabase.from('users').update(update).eq('id', user.id);
    if (error) throw error;

    return NextResponse.json({ data: null, error: null });
  } catch (error) {
    console.error('[api/buyer/company PUT]', error);
    return NextResponse.json({ data: null, error: 'Failed to update company details' }, { status: 500 });
  }
}
