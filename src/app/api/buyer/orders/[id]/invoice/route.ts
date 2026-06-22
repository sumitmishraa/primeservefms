/**
 * GET /api/buyer/orders/[id]/invoice
 * Returns a server-rendered Tax Invoice PDF for the given order.
 */
export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import React from 'react';
import { renderToBuffer } from '@react-pdf/renderer';
import type { DocumentProps } from '@react-pdf/renderer';
import { verifyAuth } from '@/lib/auth/verify';
import { createAdminClient } from '@/lib/supabase/admin';
import { isValidUUID } from '@/lib/security/validate';
import { InvoicePDF } from '@/components/buyer/pdf/InvoicePDF';
import type { InvoiceData } from '@/components/buyer/pdf/InvoicePDF';

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

    /* Fetch buyer profile for company name & address */
    const { data: buyer } = await supabase
      .from('users')
      .select('full_name, company_name, legal_company_name, gst_number, address_line1, address_line2, city, state, pincode, phone')
      .eq('id', user.id)
      .maybeSingle();

    const addr = order.shipping_address as {
      name: string; line1: string; line2?: string | null;
      city: string; state: string; pincode: string; phone: string;
    } | null;

    const invoiceData: InvoiceData = {
      order_number:     order.order_number,
      created_at:       order.created_at,
      subtotal:         order.subtotal ?? 0,
      gst_amount:       order.gst_amount ?? 0,
      shipping_amount:  order.shipping_amount ?? 0,
      total_amount:     order.total_amount ?? 0,
      notes:            order.notes ?? null,
      payment_method:   order.payment_method ?? 'razorpay',
      buyer_name:       buyer?.full_name ?? user.full_name ?? 'Customer',
      company_name:     buyer?.legal_company_name ?? buyer?.company_name ?? null,
      gst_number:       order.gst_number ?? buyer?.gst_number ?? null,
      address_name:     addr?.name ?? buyer?.full_name ?? 'Customer',
      address_line1:    addr?.line1 ?? buyer?.address_line1 ?? '',
      address_line2:    addr?.line2 ?? buyer?.address_line2 ?? null,
      address_city:     addr?.city ?? buyer?.city ?? '',
      address_state:    addr?.state ?? buyer?.state ?? '',
      address_pincode:  addr?.pincode ?? buyer?.pincode ?? '',
      address_phone:    addr?.phone ?? buyer?.phone ?? '',
      items: ((order.order_items as unknown as {
        product_name: string; product_sku: string | null;
        quantity: number; unit_price: number;
        gst_rate: number; gst_amount: number; total_amount: number;
      }[]) ?? []).map((item) => ({
        product_name: item.product_name,
        product_sku:  item.product_sku ?? null,
        quantity:     item.quantity,
        unit_price:   item.unit_price,
        gst_rate:     item.gst_rate,
        gst_amount:   item.gst_amount,
        total_amount: item.total_amount,
      })),
    };

    const buffer = await renderToBuffer(
      React.createElement(InvoicePDF, { order: invoiceData }) as unknown as React.ReactElement<DocumentProps>
    );

    return new Response(new Uint8Array(buffer as unknown as ArrayBuffer), {
      headers: {
        'Content-Type':        'application/pdf',
        'Content-Disposition': `attachment; filename="invoice-${order.order_number}.pdf"`,
        'Cache-Control':       'no-store',
      },
    });
  } catch (error) {
    console.error('[api/buyer/orders/[id]/invoice GET]', error);
    return NextResponse.json({ data: null, error: 'PDF generation failed' }, { status: 500 });
  }
}
