/**
 * GET  /api/buyer/credit-application  — Returns the buyer's latest application (if any).
 * POST /api/buyer/credit-application  — Submits a new credit application.
 *
 * On POST: stores the application in `credit_applications`, then logs an
 * admin notification to console (email wired via Resend in a follow-up sprint).
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ApiResponse } from '@/types';

export interface CreditApplicationRecord {
  id: string;
  buyer_id: string;
  client_id: string | null;
  status: 'submitted' | 'under_review' | 'approved' | 'rejected';
  gst_certificate_url: string | null;
  pan_card_url: string | null;
  cin_document_url: string | null;
  cancelled_cheque_url: string | null;
  itr_url: string | null;
  bank_statement_url: string | null;
  requested_credit_limit: number | null;
  business_years: number | null;
  annual_turnover: string | null;
  notes: string | null;
  admin_notes: string | null;
  submitted_at: string;
  reviewed_at: string | null;
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<CreditApplicationRecord | null>>> {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    const { data, error } = await supabase
      .from('credit_applications')
      .select('*')
      .eq('buyer_id', user.id)
      .order('submitted_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ data: data as CreditApplicationRecord | null, error: null });
  } catch (error) {
    console.error('[api/buyer/credit-application GET]', error);
    return NextResponse.json({ data: null, error: 'Failed to fetch application' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<CreditApplicationRecord>>> {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Only one active application at a time
    const { data: existing } = await supabase
      .from('credit_applications')
      .select('id, status')
      .eq('buyer_id', user.id)
      .in('status', ['submitted', 'under_review'])
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { data: null, error: 'You already have an active application. Please wait for it to be reviewed.' },
        { status: 409 },
      );
    }

    const body = (await request.json()) as {
      client_id?: string | null;
      gst_certificate_url?: string | null;
      pan_card_url?: string | null;
      cin_document_url?: string | null;
      cancelled_cheque_url?: string | null;
      itr_url?: string | null;
      bank_statement_url?: string | null;
      requested_credit_limit?: number | null;
      business_years?: number | null;
      annual_turnover?: string | null;
      notes?: string | null;
    };

    const { data: created, error: insertErr } = await supabase
      .from('credit_applications')
      .insert({
        buyer_id: user.id,
        client_id: body.client_id ?? user.client_id ?? null,
        status: 'submitted',
        gst_certificate_url: body.gst_certificate_url ?? null,
        pan_card_url: body.pan_card_url ?? null,
        cin_document_url: body.cin_document_url ?? null,
        cancelled_cheque_url: body.cancelled_cheque_url ?? null,
        itr_url: body.itr_url ?? null,
        bank_statement_url: body.bank_statement_url ?? null,
        requested_credit_limit: body.requested_credit_limit ?? null,
        business_years: body.business_years ?? null,
        annual_turnover: body.annual_turnover ?? null,
        notes: body.notes ?? null,
      })
      .select()
      .single();

    if (insertErr) {
      console.error('[api/buyer/credit-application POST] insert:', insertErr);
      return NextResponse.json({ data: null, error: 'Failed to submit application' }, { status: 500 });
    }

    // Admin notification — log for now; wire to Resend in follow-up sprint
    console.info('[CREDIT APPLICATION] New application submitted', {
      applicationId: created.id,
      buyerId: user.id,
      buyerName: user.full_name,
      buyerEmail: user.email,
      requestedLimit: body.requested_credit_limit,
      notifyAdmin: 'sumitmishraa.business@gmail.com',
    });

    return NextResponse.json({ data: created as CreditApplicationRecord, error: null }, { status: 201 });
  } catch (error) {
    console.error('[api/buyer/credit-application POST]', error);
    return NextResponse.json({ data: null, error: 'Failed to submit application' }, { status: 500 });
  }
}
