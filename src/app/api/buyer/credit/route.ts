/**
 * GET /api/buyer/credit
 *
 * Returns the buyer's credit account status plus aging computed from open
 * credit_45day orders.  No limit-based arithmetic — credit is status-gated
 * only (active / pending / suspended).
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ApiResponse } from '@/types';

export interface CreditOrderRow {
  order_id: string;
  order_number: string;
  total_amount: number;
  delivered_at: string | null;
  due_date: string | null;
  days_overdue: number;
  bucket: 'overdue' | 'due_soon' | 'upcoming';
}

export interface CreditAccount {
  id: string | null;
  status: 'pending' | 'active' | 'suspended';
  notes: string | null;
  outstanding: number;
  due_soon: number;
  overdue: number;
  open_credit_orders: CreditOrderRow[];
}

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<CreditAccount>>> {
  try {
    const user = await verifyAuth(request);
    if (!user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

    const supabase = createAdminClient();

    // Credit account row (status + notes only — ignore limit/used columns)
    const { data: acct, error: acctErr } = await supabase
      .from('credit_accounts')
      .select('id, status, notes')
      .eq('buyer_id', user.id)
      .maybeSingle();

    if (acctErr) throw acctErr;

    // Open credit orders scoped to buyer (and branch if assigned)
    let q = supabase
      .from('orders')
      .select('id, order_number, total_amount, delivered_at')
      .eq('buyer_id', user.id)
      .eq('payment_method', 'credit_45day')
      .eq('payment_status', 'pending')
      .neq('status', 'cancelled');

    if (user.branch_id) q = q.eq('branch_id', user.branch_id);

    const { data: openOrders, error: ordersErr } = await q.order('created_at', { ascending: false });
    if (ordersErr) throw ordersErr;

    const nowMs = Date.now();
    let outstanding = 0;
    let due_soon = 0;
    let overdue = 0;

    const open_credit_orders: CreditOrderRow[] = (openOrders ?? []).map((o) => {
      outstanding += o.total_amount ?? 0;
      let due_date: string | null = null;
      let days_overdue = 0;
      let bucket: CreditOrderRow['bucket'] = 'upcoming';

      if (o.delivered_at) {
        const dueMs = new Date(o.delivered_at).getTime() + 45 * 24 * 60 * 60 * 1000;
        due_date = new Date(dueMs).toISOString();
        const diffDays = Math.ceil((dueMs - nowMs) / (24 * 60 * 60 * 1000));
        if (diffDays < 0) {
          bucket = 'overdue';
          days_overdue = Math.abs(diffDays);
          overdue += o.total_amount ?? 0;
        } else if (diffDays <= 7) {
          bucket = 'due_soon';
          due_soon += o.total_amount ?? 0;
        }
      }

      return {
        order_id: o.id,
        order_number: o.order_number,
        total_amount: o.total_amount,
        delivered_at: o.delivered_at ?? null,
        due_date,
        days_overdue,
        bucket,
      };
    });

    const status = (acct as { status: 'pending' | 'active' | 'suspended' } | null)?.status ?? 'pending';
    const notes = (acct as { notes: string | null } | null)?.notes ?? null;
    const id = (acct as { id: string } | null)?.id ?? null;

    return NextResponse.json({
      data: {
        id,
        status,
        notes,
        outstanding: Math.round(outstanding),
        due_soon: Math.round(due_soon),
        overdue: Math.round(overdue),
        open_credit_orders,
      },
      error: null,
    });
  } catch (error) {
    console.error('[api/buyer/credit GET]', error);
    return NextResponse.json({ data: null, error: 'Failed to fetch credit account' }, { status: 500 });
  }
}
