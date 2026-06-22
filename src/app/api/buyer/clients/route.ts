/**
 * GET /api/buyer/clients
 *
 * Returns all client companies the authenticated buyer has access to.
 * Sources data from the `user_clients` join table (Migration 20260622).
 * Falls back to `users.client_id` for buyers created before the migration.
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ApiResponse } from '@/types';

export interface BuyerClientItem {
  id: string;
  name: string;
  display_name: string | null;
  industry: string | null;
  logo_url: string | null;
  is_primary: boolean;
  branches_count: number;
}

export async function GET(
  request: NextRequest,
): Promise<NextResponse<ApiResponse<BuyerClientItem[]>>> {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // Fetch from user_clients join table
    const { data: userClients, error: ucErr } = await supabase
      .from('user_clients')
      .select('client_id, is_primary')
      .eq('user_id', user.id);

    if (ucErr) throw ucErr;

    // If no rows in user_clients, fall back to users.client_id
    let clientIds: { client_id: string; is_primary: boolean }[] = userClients ?? [];
    if (clientIds.length === 0 && user.client_id) {
      clientIds = [{ client_id: user.client_id, is_primary: true }];
    }

    if (clientIds.length === 0) {
      return NextResponse.json({ data: [], error: null });
    }

    // Fetch client details
    const ids = clientIds.map((r) => r.client_id);
    const { data: clients, error: clientErr } = await supabase
      .from('clients')
      .select('id, name, display_name, industry, logo_url')
      .in('id', ids)
      .eq('is_active', true);

    if (clientErr) throw clientErr;

    // Fetch branch counts per client
    const { data: branchRows, error: branchErr } = await supabase
      .from('branches')
      .select('client_id')
      .in('client_id', ids)
      .eq('is_active', true);

    if (branchErr) throw branchErr;

    const branchCountMap = new Map<string, number>();
    for (const row of branchRows ?? []) {
      branchCountMap.set(row.client_id, (branchCountMap.get(row.client_id) ?? 0) + 1);
    }

    const primaryMap = new Map<string, boolean>(
      clientIds.map((r) => [r.client_id, r.is_primary]),
    );

    const result: BuyerClientItem[] = (clients ?? []).map((c) => ({
      id: c.id,
      name: c.name,
      display_name: c.display_name,
      industry: c.industry,
      logo_url: c.logo_url,
      is_primary: primaryMap.get(c.id) ?? false,
      branches_count: branchCountMap.get(c.id) ?? 0,
    }));

    // Put primary client first
    result.sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));

    return NextResponse.json({ data: result, error: null });
  } catch (error) {
    console.error('[api/buyer/clients GET]', error);
    return NextResponse.json({ data: null, error: 'Failed to fetch clients' }, { status: 500 });
  }
}
