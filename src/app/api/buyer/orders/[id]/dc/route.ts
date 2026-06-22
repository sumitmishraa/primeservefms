/**
 * GET /api/buyer/orders/[id]/dc
 * Returns a server-rendered Delivery Challan PDF for the given order.
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import type { DocumentProps } from '@react-pdf/renderer';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidUUID } from '@/lib/security/validate';
import { DeliveryChallanPDF } from '@/components/buyer/pdf/DeliveryChallanPDF';
import type { DCData } from '@/components/buyer/pdf/DeliveryChallanPDF';

interface RouteParams { params: Promise<{ id: string }> }

export async function GET(
  request: NextRequest,
  { params }: RouteParams
): Promise<NextResponse | Response> {
  try {
    const user = await verifyAuth(request);
    if (!user) {
      return NextResponse.json({ data: null, error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!isValidUUID(id)) {
      return NextResponse.json({ data: null, error: 'Invalid order ID' }, { status: 400 });
    }

    const supabase = createAdminClient();

    /* Fetch order + items */
    const { data: order, error: orderErr } = await supabase
      .from('orders')
      .select('*, order_items(*)')
      .eq('id', id)
      .eq('buyer_id', user.id)
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ data: null, error: 'Order not found' }, { status: 404 });
    }

    /* Fetch buyer for company name */
    const { data: buyer } = await supabase
      .from('users')
      .select('full_name, company_name, legal_company_name, phone')
      .eq('id', user.id)
      .maybeSingle();

    const addr = order.shipping_address as {
      name: string; line1: string; line2?: string | null;
      city: string; state: string; pincode: string; phone: string;
    } | null;

    const dcData: DCData = {
      order_number:    order.order_number,
      created_at:      order.created_at,
      delivered_at:    order.delivered_at ?? null,
      address_name:    addr?.name ?? buyer?.full_name ?? 'Customer',
      address_line1:   addr?.line1 ?? '',
      address_line2:   addr?.line2 ?? null,
      address_city:    addr?.city ?? '',
      address_state:   addr?.state ?? '',
      address_pincode: addr?.pincode ?? '',
      address_phone:   addr?.phone ?? buyer?.phone ?? '',
      company_name:    buyer?.legal_company_name ?? buyer?.company_name ?? null,
      buyer_name:      buyer?.full_name ?? 'Customer',
      items: ((order.order_items as unknown as {
        product_name: string; product_sku: string | null; quantity: number;
      }[]) ?? []).map((item) => ({
        product_name: item.product_name,
        product_sku:  item.product_sku ?? null,
        quantity:     item.quantity,
      })),
    };

    const buffer = await renderToBuffer(
      React.createElement(DeliveryChallanPDF, { order: dcData }) as unknown as React.ReactElement<DocumentProps>
    );

    return new Response(new Uint8Array(buffer as unknown as ArrayBuffer), {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="dc-${order.order_number}.pdf"`,
        'Cache-Control':       'no-store',
      },
    });
  } catch (error) {
    console.error('[api/buyer/orders/[id]/dc GET]', error);
    return NextResponse.json({ data: null, error: 'PDF generation failed' }, { status: 500 });
  }
}
