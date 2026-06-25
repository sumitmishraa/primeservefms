/**
 * GET /api/admin/credit-applications
 *
 * Returns all credit applications with buyer and client info.
 * Admin-only. Supports optional `status` filter.
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ApiResponse } from '@/types';

export interface AdminCreditApplicationItem {
  id: string;
  status: string;
  buyer_id: string;
  buyer_name: string;
  buyer_email: string | null;
  client_name: string | null;
  requested_credit_limit: number | null;
  annual_turnover: string | null;
  business_years: number | null;
  notes: string | null;
  admin_notes: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
  // Document presence flags
  has_gst: boolean;
  has_pan: boolean;
  has_cin: boolean;
  has_cheque: boolean;
  has_itr: boolean;
  has_bank_statement: boolean;
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<AdminCreditApplicationItem[]>>> {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return NextResponse.json({ data: null, error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status');

    const supabase = createAdminClient();

    let query = supabase
      .from('credit_applications')
      .select('*')
      .order('submitted_at', { ascending: false });

    if (statusFilter) {
      query = query.eq(
        'status',
        statusFilter as 'draft' | 'submitted' | 'under_review' | 'documents_verified' | 'meeting_scheduled' | 'approved' | 'rejected',
      );
    }

    const { data: apps, error: appsErr } = await query;
    if (appsErr) throw appsErr;

    if (!apps || apps.length === 0) {
      return NextResponse.json({ data: [], error: null });
    }

    // Fetch buyer details
    const buyerIds = [...new Set(apps.map((a) => a.buyer_id))];
    const { data: buyers } = await supabase
      .from('users')
      .select('id, full_name, email')
      .in('id', buyerIds);

    const buyerMap = new Map(
      (buyers ?? []).map((b) => [b.id, { full_name: b.full_name, email: b.email }]),
    );

    // Fetch client names
    const clientIds = [...new Set(apps.map((a) => a.client_id).filter(Boolean))] as string[];
    const { data: clients } = clientIds.length
      ? await supabase.from('clients').select('id, name').in('id', clientIds)
      : { data: [] };

    const clientMap = new Map((clients ?? []).map((c) => [c.id, c.name]));

    const result: AdminCreditApplicationItem[] = apps.map((a) => {
      const buyer = buyerMap.get(a.buyer_id);
      return {
        id: a.id,
        status: a.status,
        buyer_id: a.buyer_id,
        buyer_name: buyer?.full_name ?? 'Unknown',
        buyer_email: buyer?.email ?? null,
        client_name: a.client_id ? (clientMap.get(a.client_id) ?? null) : null,
        requested_credit_limit: a.requested_credit_limit ? Number(a.requested_credit_limit) : null,
        annual_turnover: a.annual_turnover,
        business_years: a.business_years,
        notes: a.notes,
        admin_notes: a.admin_notes,
        submitted_at: a.submitted_at,
        reviewed_at: a.reviewed_at,
        has_gst: !!a.gst_certificate_url,
        has_pan: !!a.pan_card_url,
        has_cin: !!a.cin_document_url,
        has_cheque: !!a.cancelled_cheque_url,
        has_itr: !!a.itr_url,
        has_bank_statement: !!a.bank_statement_url,
      };
    });

    return NextResponse.json({ data: result, error: null });
  } catch (error) {
    console.error('[api/admin/credit-applications GET]', error);
    return NextResponse.json({ data: null, error: 'Failed to fetch applications' }, { status: 500 });
  }
}
