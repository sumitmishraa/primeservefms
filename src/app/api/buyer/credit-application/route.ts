/**
 * GET  /api/buyer/credit-application  — Returns the buyer's latest application (draft or active).
 * PUT  /api/buyer/credit-application  — Saves/updates the buyer's DRAFT (autosave per wizard step).
 * POST /api/buyer/credit-application  — Submits the draft (draft → submitted) after validation.
 *
 * A buyer has at most one "current" application. A `draft` is editable; once an
 * application is active (submitted…approved) it is read-only until resolved. A
 * `rejected` application lets the buyer start a fresh draft.
 *
 * Identity fields are mirrored back to the users profile so My Account stays in
 * sync and future applications auto-fill.
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ApiResponse } from '@/types';
import type { Database } from '@/types/database';

type CreditApplicationStatus =
  | 'draft' | 'submitted' | 'under_review'
  | 'documents_verified' | 'meeting_scheduled'
  | 'approved' | 'rejected';

export interface CreditApplicationRecord {
  id: string;
  buyer_id: string;
  client_id: string | null;
  status: CreditApplicationStatus;
  current_step: number;
  entity_type: 'company' | 'llp' | null;
  gst_number: string | null;
  pan_number: string | null;
  cin_number: string | null;
  gst_certificate_url: string | null;
  pan_card_url: string | null;
  pan_card_back_url: string | null;
  cin_document_url: string | null;
  cancelled_cheque_url: string | null;
  itr_url: string | null;
  bank_statement_url: string | null;
  requested_credit_limit: number | null;
  business_years: number | null;
  annual_turnover: string | null;
  notes: string | null;
  admin_notes: string | null;
  documents_verified_at: string | null;
  meeting_scheduled_at: string | null;
  meeting_link: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Statuses that mean an application is "live" with the team (not editable). */
const ACTIVE_STATUSES: CreditApplicationStatus[] = [
  'submitted', 'under_review', 'documents_verified', 'meeting_scheduled', 'approved',
];

type DraftBody = {
  entity_type?: 'company' | 'llp' | null;
  legal_company_name?: string | null;
  full_name?: string | null;
  designation?: string | null;
  contact_email?: string | null;
  contact_phone?: string | null;
  gst_number?: string | null;
  pan_number?: string | null;
  cin_number?: string | null;
  gst_certificate_url?: string | null;
  pan_card_url?: string | null;
  pan_card_back_url?: string | null;
  cin_document_url?: string | null;
  bank_statement_url?: string | null;
  itr_url?: string | null;
  current_step?: number;
};

/** Sync identity fields back onto the users profile (best-effort). */
async function syncProfile(
  supabase: ReturnType<typeof createAdminClient>,
  userId: string,
  body: DraftBody,
): Promise<void> {
  const patch: Database['public']['Tables']['users']['Update'] = {};
  if (body.full_name) patch.full_name = body.full_name.trim();
  if (body.designation) patch.designation = body.designation.trim();
  if (body.legal_company_name) patch.legal_company_name = body.legal_company_name.trim();
  if (body.gst_number) patch.gst_number = body.gst_number.trim().toUpperCase();
  if (body.pan_number) patch.tax_id = body.pan_number.trim().toUpperCase();
  if (body.cin_number) patch.cin_number = body.cin_number.trim().toUpperCase();
  if (body.entity_type) patch.company_type = body.entity_type;
  if (Object.keys(patch).length === 0) return;
  await supabase.from('users').update(patch).eq('id', userId);
}

/** Map a draft body to a credit_applications insert/update payload. */
function toApplicationPatch(body: DraftBody): Database['public']['Tables']['credit_applications']['Update'] {
  return {
    entity_type: body.entity_type ?? undefined,
    gst_number: body.gst_number?.trim().toUpperCase() ?? undefined,
    pan_number: body.pan_number?.trim().toUpperCase() ?? undefined,
    cin_number: body.cin_number?.trim().toUpperCase() ?? undefined,
    gst_certificate_url: body.gst_certificate_url ?? undefined,
    pan_card_url: body.pan_card_url ?? undefined,
    pan_card_back_url: body.pan_card_back_url ?? undefined,
    cin_document_url: body.cin_document_url ?? undefined,
    bank_statement_url: body.bank_statement_url ?? undefined,
    itr_url: body.itr_url ?? undefined,
    current_step: body.current_step ?? undefined,
    updated_at: new Date().toISOString(),
  };
}

// ── GET ─────────────────────────────────────────────────────────────────────

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
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;

    return NextResponse.json({ data: data as CreditApplicationRecord | null, error: null });
  } catch (error) {
    console.error('[api/buyer/credit-application GET]', error);
    return NextResponse.json({ data: null, error: 'Failed to fetch application' }, { status: 500 });
  }
}

// ── PUT — save / update draft (autosave per step) ────────────────────────────

export async function PUT(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<CreditApplicationRecord>>> {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();
    const body = (await request.json()) as DraftBody;

    const { data: latest } = await supabase
      .from('credit_applications')
      .select('id, status')
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latest && ACTIVE_STATUSES.includes(latest.status as CreditApplicationStatus)) {
      return NextResponse.json(
        { data: null, error: 'You already have an application in progress. Please wait for it to be reviewed.' },
        { status: 409 },
      );
    }

    await syncProfile(supabase, user.id, body);

    let record: CreditApplicationRecord;
    if (latest && latest.status === 'draft') {
      const { data: updated, error: updErr } = await supabase
        .from('credit_applications')
        .update(toApplicationPatch(body))
        .eq('id', latest.id)
        .select()
        .single();
      if (updErr) throw updErr;
      record = updated as CreditApplicationRecord;
    } else {
      const { data: created, error: insErr } = await supabase
        .from('credit_applications')
        .insert({
          buyer_id: user.id,
          client_id: user.client_id ?? null,
          status: 'draft',
          ...toApplicationPatch(body),
        })
        .select()
        .single();
      if (insErr) throw insErr;
      record = created as CreditApplicationRecord;
    }

    return NextResponse.json({ data: record, error: null });
  } catch (error) {
    console.error('[api/buyer/credit-application PUT]', error);
    return NextResponse.json({ data: null, error: 'Failed to save draft' }, { status: 500 });
  }
}

// ── POST — submit the draft ──────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<CreditApplicationRecord>>> {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    const { data: latest } = await supabase
      .from('credit_applications')
      .select('*')
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latest && ACTIVE_STATUSES.includes(latest.status as CreditApplicationStatus)) {
      return NextResponse.json(
        { data: null, error: 'You already have an active application.' },
        { status: 409 },
      );
    }
    if (!latest || latest.status !== 'draft') {
      return NextResponse.json(
        { data: null, error: 'No draft application found. Please complete the form first.' },
        { status: 400 },
      );
    }

    // Validate everything is present before submitting
    const missing: string[] = [];
    if (!latest.gst_number || !latest.gst_certificate_url) missing.push('GST details & certificate');
    if (!latest.pan_number || !latest.pan_card_url || !latest.pan_card_back_url) missing.push('PAN details & both card sides');
    if (!latest.cin_number || !latest.cin_document_url) missing.push('CIN/LLP details & document');
    if (!latest.bank_statement_url) missing.push('6-month bank statement');
    if (missing.length > 0) {
      return NextResponse.json(
        { data: null, error: `Please complete: ${missing.join(', ')}.` },
        { status: 400 },
      );
    }

    const { data: submitted, error: subErr } = await supabase
      .from('credit_applications')
      .update({
        status: 'submitted',
        submitted_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        current_step: 6,
      })
      .eq('id', latest.id)
      .select()
      .single();

    if (subErr) {
      console.error('[api/buyer/credit-application POST] submit:', subErr);
      return NextResponse.json({ data: null, error: 'Failed to submit application' }, { status: 500 });
    }

    // Admin notification — log for now; wire to Resend in follow-up sprint
    console.info('[CREDIT APPLICATION] New application submitted', {
      applicationId: submitted.id,
      buyerId: user.id,
      buyerName: user.full_name,
      buyerEmail: user.email,
      notifyAdmin: 'sumitmishraa.business@gmail.com',
    });

    return NextResponse.json({ data: submitted as CreditApplicationRecord, error: null }, { status: 201 });
  } catch (error) {
    console.error('[api/buyer/credit-application POST]', error);
    return NextResponse.json({ data: null, error: 'Failed to submit application' }, { status: 500 });
  }
}
