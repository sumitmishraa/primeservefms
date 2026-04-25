/**
 * GET /api/buyer/credit — Fetch buyer's credit account.
 * Returns a clean initial state if no credit_accounts row exists yet.
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ApiResponse } from '@/types';

export interface CreditAccount {
  id: string | null;
  credit_limit: number;
  used_amount: number;
  available: number;
  status: 'pending' | 'active' | 'suspended';
  notes: string | null;
}

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<CreditAccount>>> {
  try {
    const user = await verifyAuth(request);
    if (!user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('credit_accounts')
      .select('id, credit_limit, used_amount, status, notes')
      .eq('buyer_id', user.id)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      return NextResponse.json({
        data: { id: null, credit_limit: 0, used_amount: 0, available: 0, status: 'pending', notes: null },
        error: null,
      });
    }

    const row = data as { id: string; credit_limit: number; used_amount: number; status: 'pending' | 'active' | 'suspended'; notes: string | null };
    return NextResponse.json({
      data: {
        id: row.id,
        credit_limit: row.credit_limit,
        used_amount: row.used_amount,
        available: Math.max(0, row.credit_limit - row.used_amount),
        status: row.status,
        notes: row.notes,
      },
      error: null,
    });
  } catch (error) {
    console.error('[api/buyer/credit GET]', error);
    return NextResponse.json({ data: null, error: 'Failed to fetch credit account' }, { status: 500 });
  }
}
