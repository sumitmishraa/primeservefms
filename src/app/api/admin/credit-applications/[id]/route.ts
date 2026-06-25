/**
 * GET   /api/admin/credit-applications/[id] — Full application + signed document URLs.
 * PATCH /api/admin/credit-applications/[id] — Advance lifecycle (verify / schedule / approve / reject).
 *
 * Admin-only. Documents live in a private Storage bucket, so viewing requires
 * short-lived signed URLs. Approving activates the buyer's credit_accounts row.
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ApiResponse } from '@/types';
import type { Database } from '@/types/database';
import type { CreditApplicationRecord } from '../../../buyer/credit-application/route';

const BUCKET = 'buyer-documents';
const SIGNED_URL_TTL = 60 * 30; // 30 minutes

const DOC_FIELDS: (keyof CreditApplicationRecord)[] = [
  'gst_certificate_url',
  'pan_card_url',
  'pan_card_back_url',
  'cin_document_url',
  'bank_statement_url',
  'itr_url',
];

export interface AdminCreditApplicationDetail extends CreditApplicationRecord {
  buyer_name: string;
  buyer_email: string | null;
  signed_documents: Record<string, string>;
}

/** Extract the object path inside the bucket from a stored public/sign URL. */
function toObjectPath(url: string): string | null {
  const marker = `/${BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx === -1) return null;
  return url.slice(idx + marker.length).split('?')[0];
}

// ── GET ─────────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<AdminCreditApplicationDetail>>> {
  try {
    const user = await verifyAuth(request);
    if (!user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const supabase = createAdminClient();

    const { data: app, error } = await supabase
      .from('credit_applications')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) throw error;
    if (!app) return NextResponse.json({ data: null, error: 'Application not found' }, { status: 404 });

    const { data: buyer } = await supabase
      .from('users')
      .select('full_name, email')
      .eq('id', app.buyer_id)
      .maybeSingle();

    // Sign each present document
    const signed: Record<string, string> = {};
    for (const field of DOC_FIELDS) {
      const url = app[field] as string | null;
      if (!url) continue;
      const path = toObjectPath(url);
      if (!path) continue;
      const { data: signedData } = await supabase.storage.from(BUCKET).createSignedUrl(path, SIGNED_URL_TTL);
      if (signedData?.signedUrl) signed[field] = signedData.signedUrl;
    }

    const detail: AdminCreditApplicationDetail = {
      ...(app as CreditApplicationRecord),
      buyer_name: buyer?.full_name ?? 'Unknown',
      buyer_email: buyer?.email ?? null,
      signed_documents: signed,
    };

    return NextResponse.json({ data: detail, error: null });
  } catch (error) {
    console.error('[api/admin/credit-applications/[id] GET]', error);
    return NextResponse.json({ data: null, error: 'Failed to fetch application' }, { status: 500 });
  }
}

// ── PATCH ────────────────────────────────────────────────────────────────────

type PatchBody = {
  action: 'verify_documents' | 'schedule_meeting' | 'approve' | 'reject';
  admin_notes?: string | null;
  meeting_link?: string | null;
  meeting_scheduled_at?: string | null;
  credit_limit?: number | null;
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse<ApiResponse<CreditApplicationRecord>>> {
  try {
    const user = await verifyAuth(request);
    if (!user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    if (user.role !== 'admin') return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });

    const { id } = await params;
    const body = (await request.json()) as PatchBody;
    const supabase = createAdminClient();

    const { data: app, error: fetchErr } = await supabase
      .from('credit_applications')
      .select('id, buyer_id, status')
      .eq('id', id)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    if (!app) return NextResponse.json({ data: null, error: 'Application not found' }, { status: 404 });

    const now = new Date().toISOString();
    const patch: Database['public']['Tables']['credit_applications']['Update'] = {
      updated_at: now,
      reviewed_at: now,
      reviewed_by: user.id,
    };
    if (body.admin_notes !== undefined) patch.admin_notes = body.admin_notes;

    switch (body.action) {
      case 'verify_documents':
        patch.status = 'documents_verified';
        patch.documents_verified_at = now;
        break;
      case 'schedule_meeting':
        if (!body.meeting_link) {
          return NextResponse.json({ data: null, error: 'Meeting link is required' }, { status: 400 });
        }
        patch.status = 'meeting_scheduled';
        patch.meeting_link = body.meeting_link;
        patch.meeting_scheduled_at = body.meeting_scheduled_at ?? now;
        break;
      case 'approve':
        if (body.credit_limit == null || body.credit_limit <= 0) {
          return NextResponse.json({ data: null, error: 'A credit limit is required to approve' }, { status: 400 });
        }
        patch.status = 'approved';
        break;
      case 'reject':
        patch.status = 'rejected';
        break;
      default:
        return NextResponse.json({ data: null, error: 'Invalid action' }, { status: 400 });
    }

    const { data: updated, error: updErr } = await supabase
      .from('credit_applications')
      .update(patch)
      .eq('id', id)
      .select()
      .single();
    if (updErr) throw updErr;

    // On approval, activate the buyer's credit account (one per buyer — unique)
    if (body.action === 'approve' && body.credit_limit) {
      const { error: caErr } = await supabase
        .from('credit_accounts')
        .upsert(
          {
            buyer_id: app.buyer_id,
            credit_limit: body.credit_limit,
            status: 'active',
            notes: body.admin_notes ?? null,
            updated_at: now,
          },
          { onConflict: 'buyer_id' },
        );
      if (caErr) {
        console.error('[api/admin/credit-applications/[id] PATCH] credit_accounts upsert:', caErr);
        return NextResponse.json({ data: null, error: 'Approved, but failed to activate credit account' }, { status: 500 });
      }
    }

    return NextResponse.json({ data: updated as CreditApplicationRecord, error: null });
  } catch (error) {
    console.error('[api/admin/credit-applications/[id] PATCH]', error);
    return NextResponse.json({ data: null, error: 'Failed to update application' }, { status: 500 });
  }
}
