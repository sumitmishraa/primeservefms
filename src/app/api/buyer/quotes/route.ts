/**
 * GET  /api/buyer/quotes     — List buyer's quote requests
 * POST /api/buyer/quotes     — Submit a new quote request
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';
import type { ApiResponse } from '@/types';

export interface QuoteItem {
  product_name: string;
  quantity: number;
  unit: string;
  frequency: string;
  notes: string;
}

export interface QuoteRequest {
  id: string;
  title: string;
  status: 'submitted' | 'under_review' | 'quoted' | 'accepted' | 'rejected';
  items: QuoteItem[];
  notes: string | null;
  document_url: string | null;
  admin_notes: string | null;
  quoted_amount: number | null;
  valid_until: string | null;
  created_at: string;
  updated_at: string;
}

// ---------------------------------------------------------------------------
// GET
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest): Promise<NextResponse<ApiResponse<QuoteRequest[]>>> {
  try {
    const user = await verifyAuth(request);
    if (!user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('quote_requests')
      .select('id, title, status, items, notes, document_url, admin_notes, quoted_amount, valid_until, created_at, updated_at')
      .eq('buyer_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ data: (data ?? []) as unknown as QuoteRequest[], error: null });
  } catch (error) {
    console.error('[api/buyer/quotes GET]', error);
    return NextResponse.json({ data: null, error: 'Failed to fetch quote requests' }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST
// ---------------------------------------------------------------------------

interface SubmitQuoteBody {
  title: string;
  items: QuoteItem[];
  notes?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse<ApiResponse<{ id: string }>>> {
  try {
    const user = await verifyAuth(request);
    if (!user) return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });

    const body = await request.json() as SubmitQuoteBody;

    if (!body.title?.trim()) {
      return NextResponse.json({ data: null, error: 'Quote title is required' }, { status: 400 });
    }
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ data: null, error: 'At least one item is required' }, { status: 400 });
    }
    for (const item of body.items) {
      if (!item.product_name?.trim()) {
        return NextResponse.json({ data: null, error: 'Each item must have a product name' }, { status: 400 });
      }
      if (!item.quantity || item.quantity <= 0) {
        return NextResponse.json({ data: null, error: `Invalid quantity for "${item.product_name}"` }, { status: 400 });
      }
    }

    const supabase = createAdminClient();
    // Cast items to satisfy the Json JSONB column type
    const insertRow = {
      buyer_id: user.id,
      title: body.title.trim(),
      items: body.items as unknown as Record<string, unknown>[],
      notes: body.notes?.trim() || null,
      status: 'submitted' as const,
    };
    const { data, error } = await supabase
      .from('quote_requests')
      .insert(insertRow as never)
      .select('id')
      .single();

    if (error) throw error;

    return NextResponse.json({ data: { id: (data as { id: string }).id }, error: null }, { status: 201 });
  } catch (error) {
    console.error('[api/buyer/quotes POST]', error);
    return NextResponse.json({ data: null, error: 'Failed to submit quote request' }, { status: 500 });
  }
}
