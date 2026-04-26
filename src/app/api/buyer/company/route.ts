/**
 * GET  /api/buyer/company — Fetch buyer's company + KYC details
 * PUT  /api/buyer/company — Update company/KYC details (buyer-side only)
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ApiResponse } from '@/types';

const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SPEND_BANDS = [
  'Up to ₹50,000',
  '₹50,000 – ₹2,00,000',
  '₹2,00,000 – ₹5,00,000',
  '₹5,00,000 – ₹10,00,000',
  'Above ₹10,00,000',
];

export interface CompanyDetails {
  // Legacy fields (existing columns)
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
  // Extended KYC fields (Migration 8)
  legal_company_name: string | null;
  trade_name: string | null;
  cin_number: string | null;
  msme_number: string | null;
  website: string | null;
  incorporation_year: number | null;
  expected_monthly_spend: string | null;
  // Finance contacts
  payment_contact_name: string | null;
  payment_contact_email: string | null;
  payment_contact_phone: string | null;
  finance_approver_name: string | null;
  finance_approver_email: string | null;
  finance_approver_phone: string | null;
  // Purchasing preferences
  po_required: boolean;
  billing_cycle_notes: string | null;
  // Branch operational
  branch_contact_person: string | null;
  delivery_contact_phone: string | null;
  delivery_window_notes: string | null;
  loading_unloading_notes: string | null;
  branch_purchase_notes: string | null;
  // Documents
  business_documents: unknown[];
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
        legal_company_name: user.legal_company_name ?? null,
        trade_name: user.trade_name ?? null,
        cin_number: user.cin_number ?? null,
        msme_number: user.msme_number ?? null,
        website: user.website ?? null,
        incorporation_year: user.incorporation_year ?? null,
        expected_monthly_spend: user.expected_monthly_spend ?? null,
        payment_contact_name: user.payment_contact_name ?? null,
        payment_contact_email: user.payment_contact_email ?? null,
        payment_contact_phone: user.payment_contact_phone ?? null,
        finance_approver_name: user.finance_approver_name ?? null,
        finance_approver_email: user.finance_approver_email ?? null,
        finance_approver_phone: user.finance_approver_phone ?? null,
        po_required: user.po_required ?? false,
        billing_cycle_notes: user.billing_cycle_notes ?? null,
        branch_contact_person: user.branch_contact_person ?? null,
        delivery_contact_phone: user.delivery_contact_phone ?? null,
        delivery_window_notes: user.delivery_window_notes ?? null,
        loading_unloading_notes: user.loading_unloading_notes ?? null,
        branch_purchase_notes: user.branch_purchase_notes ?? null,
        business_documents: (user.business_documents ?? []) as unknown[],
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
  // Legacy
  company_name?: string;
  company_type?: string;
  gst_number?: string | null;
  tax_id?: string | null;
  address_line1?: string;
  address_line2?: string;
  city?: string;
  state?: string;
  pincode?: string;
  // Extended KYC
  legal_company_name?: string | null;
  trade_name?: string | null;
  cin_number?: string | null;
  msme_number?: string | null;
  website?: string | null;
  incorporation_year?: number | null;
  expected_monthly_spend?: string | null;
  // Finance contacts
  payment_contact_name?: string | null;
  payment_contact_email?: string | null;
  payment_contact_phone?: string | null;
  finance_approver_name?: string | null;
  finance_approver_email?: string | null;
  finance_approver_phone?: string | null;
  // Purchasing
  po_required?: boolean;
  billing_cycle_notes?: string | null;
  // Branch ops
  branch_contact_person?: string | null;
  delivery_contact_phone?: string | null;
  delivery_window_notes?: string | null;
  loading_unloading_notes?: string | null;
  branch_purchase_notes?: string | null;
}

export async function PUT(request: NextRequest): Promise<NextResponse<ApiResponse<null>>> {
  try {
    const user = await verifyAuth(request);
    if (!user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

    const body = await request.json() as UpdateCompanyBody;
    const update: Record<string, unknown> = {};

    // ── Legacy fields ────────────────────────────────────────────────────────
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

    // ── Extended KYC ─────────────────────────────────────────────────────────
    if (body.legal_company_name !== undefined) update.legal_company_name = body.legal_company_name?.trim() || null;
    if (body.trade_name !== undefined) update.trade_name = body.trade_name?.trim() || null;
    if (body.cin_number !== undefined) update.cin_number = body.cin_number?.trim().toUpperCase() || null;
    if (body.msme_number !== undefined) update.msme_number = body.msme_number?.trim() || null;
    if (body.website !== undefined) update.website = body.website?.trim() || null;
    if (body.incorporation_year !== undefined) {
      const yr = body.incorporation_year;
      if (yr !== null && (yr < 1900 || yr > new Date().getFullYear())) {
        return NextResponse.json({ data: null, error: 'Invalid incorporation year' }, { status: 400 });
      }
      update.incorporation_year = yr;
    }
    if (body.expected_monthly_spend !== undefined) {
      const band = body.expected_monthly_spend;
      if (band && !SPEND_BANDS.includes(band)) {
        return NextResponse.json({ data: null, error: 'Invalid spend band' }, { status: 400 });
      }
      update.expected_monthly_spend = band || null;
    }

    // ── Finance contacts ─────────────────────────────────────────────────────
    const emailFields = ['payment_contact_email', 'finance_approver_email'] as const;
    for (const field of emailFields) {
      if (body[field] !== undefined) {
        const em = (body[field] as string | null)?.trim() || null;
        if (em && !EMAIL_REGEX.test(em)) {
          return NextResponse.json({ data: null, error: `Invalid email for ${field}` }, { status: 400 });
        }
        update[field] = em;
      }
    }
    const textFields = [
      'payment_contact_name', 'payment_contact_phone',
      'finance_approver_name', 'finance_approver_phone',
      'billing_cycle_notes',
      'branch_contact_person', 'delivery_contact_phone',
      'delivery_window_notes', 'loading_unloading_notes', 'branch_purchase_notes',
    ] as const;
    for (const field of textFields) {
      if (body[field] !== undefined) {
        update[field] = (body[field] as string | null)?.trim() || null;
      }
    }
    if (body.po_required !== undefined) update.po_required = Boolean(body.po_required);

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
