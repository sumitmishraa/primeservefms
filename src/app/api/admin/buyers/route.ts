/**
 * GET /api/admin/buyers
 *
 * Returns all registered buyers with their assigned client and branch names.
 * Supports ?search= (ILIKE on full_name, email, company_name).
 *
 * Admin-only — returns 403 for non-admin sessions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

// ---------------------------------------------------------------------------
// Response shape
// ---------------------------------------------------------------------------

export interface BuyerRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  is_active: boolean;
  created_at: string;
  client_id: string | null;
  branch_id: string | null;
  client_name: string | null;
  branch_name: string | null;
}

// ---------------------------------------------------------------------------
// Internal Supabase join shape
// ---------------------------------------------------------------------------

interface RawBuyerRow {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  is_active: boolean;
  created_at: string;
  client_id: string | null;
  branch_id: string | null;
  client: { name: string } | null;
  branch: { name: string } | null;
}

/**
 * GET /api/admin/buyers
 *
 * Returns all buyers with client/branch info joined.
 * Supports ?search= query param for filtering by name, email, or company.
 *
 * @param request - Incoming NextRequest
 * @returns JSON array of BuyerRow objects
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ data: null, error: 'Not authenticated' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return NextResponse.json({ data: null, error: 'Forbidden — admin access only' }, { status: 403 });
    }

    const supabase = createAdminClient();
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') ?? '';

    let query = supabase
      .from('users')
      .select(
        'id, full_name, email, phone, company_name, is_active, created_at, client_id, branch_id, client:clients(name), branch:branches(name)'
      )
      .eq('role', 'buyer')
      .order('created_at', { ascending: false });

    if (search.trim()) {
      query = query.or(
        `full_name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%,company_name.ilike.%${search.trim()}%`
      );
    }

    const { data, error: dbError } = await query;

    if (dbError) {
      console.error('[api/admin/buyers GET] query error:', dbError.message);
      return NextResponse.json({ data: null, error: 'Failed to fetch buyers' }, { status: 500 });
    }

    // Flatten the joined client/branch names
    const buyers: BuyerRow[] = ((data ?? []) as unknown as RawBuyerRow[]).map((row) => ({
      id: row.id,
      full_name: row.full_name,
      email: row.email,
      phone: row.phone,
      company_name: row.company_name,
      is_active: row.is_active,
      created_at: row.created_at,
      client_id: row.client_id,
      branch_id: row.branch_id,
      client_name: row.client?.name ?? null,
      branch_name: row.branch?.name ?? null,
    }));

    return NextResponse.json({ data: buyers, error: null });
  } catch (error) {
    console.error('[api/admin/buyers GET]', error);
    return NextResponse.json({ data: null, error: 'Internal server error' }, { status: 500 });
  }
}
