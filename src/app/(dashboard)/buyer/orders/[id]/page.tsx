'use client';

/**
 * Buyer — Order Detail page
 * Timeline, items table, price summary, payment info, shipping address, reorder.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ChevronLeft, Package, RefreshCw, Check, Loader2,
  MapPin, CreditCard, FileText, Download,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { formatINR, formatDate } from '@/lib/utils/formatting';
import { useCartStore } from '@/stores/cartStore';
import type { OrderStatus, OrderItem, Product } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrderDetail {
  id: string;
  order_number: string;
  status: OrderStatus;
  payment_status: string;
  payment_method: 'razorpay' | 'credit_45day';
  razorpay_payment_id: string | null;
  subtotal: number;
  gst_amount: number;
  shipping_amount: number;
  total_amount: number;
  created_at: string;
  forwarded_at: string | null;
  dispatched_at: string | null;
  delivered_at: string | null;
  cancelled_reason: string | null;
  notes: string | null;
  admin_notes: string | null;
  shipping_address: {
    name?: string; phone?: string; line1?: string; line2?: string;
    city?: string; state?: string; pincode?: string;
  } | null;
  order_items: OrderItem[];
}

// ---------------------------------------------------------------------------
// Status config
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-blue-50 text-blue-700 border-blue-200',
  forwarded_to_vendor: 'bg-purple-50 text-purple-700 border-purple-200',
  dispatched: 'bg-orange-50 text-orange-700 border-orange-200',
  delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', approved: 'Approved', forwarded_to_vendor: 'Forwarded to Vendor',
  dispatched: 'Dispatched', delivered: 'Delivered', cancelled: 'Cancelled',
};

// ---------------------------------------------------------------------------
// Timeline
// ---------------------------------------------------------------------------

type TimelineStep = {
  key: OrderStatus;
  label: string;
  shortLabel: string;
};

const TIMELINE_STEPS: TimelineStep[] = [
  { key: 'pending', label: 'Order Placed', shortLabel: 'Placed' },
  { key: 'approved', label: 'Approved', shortLabel: 'Approved' },
  { key: 'forwarded_to_vendor', label: 'Processing', shortLabel: 'Processing' },
  { key: 'dispatched', label: 'Dispatched', shortLabel: 'Dispatched' },
  { key: 'delivered', label: 'Delivered', shortLabel: 'Delivered' },
];

const STATUS_ORDER: OrderStatus[] = ['pending', 'approved', 'forwarded_to_vendor', 'dispatched', 'delivered'];

function getStepState(step: OrderStatus, currentStatus: OrderStatus): 'done' | 'current' | 'upcoming' | 'cancelled' {
  if (currentStatus === 'cancelled') {
    const stepIdx = STATUS_ORDER.indexOf(step);
    const cancelIdx = STATUS_ORDER.indexOf('delivered'); // cancelled can happen at any point
    return stepIdx < cancelIdx ? 'done' : 'cancelled';
  }
  const stepIdx = STATUS_ORDER.indexOf(step);
  const currentIdx = STATUS_ORDER.indexOf(currentStatus);
  if (stepIdx < currentIdx) return 'done';
  if (stepIdx === currentIdx) return 'current';
  return 'upcoming';
}

function getStepTimestamp(step: OrderStatus, order: OrderDetail): string | null {
  switch (step) {
    case 'pending': return order.created_at;
    case 'forwarded_to_vendor': return order.forwarded_at;
    case 'dispatched': return order.dispatched_at;
    case 'delivered': return order.delivered_at;
    default: return null;
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BuyerOrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reordering, setReordering] = useState(false);

  useEffect(() => {
    if (!id) return;
    async function fetchOrder() {
      try {
        const res = await fetch(`/api/buyer/orders/${id}`);
        const json = await res.json() as { data: OrderDetail | null; error: string | null };
        if (!res.ok || json.error || !json.data) throw new Error(json.error ?? 'Order not found');
        setOrder(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load order');
      } finally {
        setLoading(false);
      }
    }
    fetchOrder();
  }, [id]);

  async function handleReorder() {
    setReordering(true);
    try {
      const res = await fetch(`/api/buyer/orders/${id}/reorder`);
      const json = await res.json() as {
        data: { products: Product[]; quantities: Record<string, number> } | null;
        error: string | null;
      };
      if (!res.ok || json.error || !json.data) throw new Error(json.error ?? 'Failed');

      const { products, quantities } = json.data;
      if (!products.length) {
        toast.error('No products available to reorder');
        return;
      }

      for (const product of products) {
        addItem(product, quantities[product.id] ?? product.moq);
      }

      toast.success(`${products.length} item${products.length !== 1 ? 's' : ''} added to cart`);
      router.push('/buyer/cart');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reorder failed');
    } finally {
      setReordering(false);
    }
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error || !order) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-12 text-center">
        <p className="text-slate-500 mb-4">{error ?? 'Order not found'}</p>
        <Link href="/buyer/orders" className="text-teal-600 hover:underline text-sm">Back to My Orders</Link>
      </div>
    );
  }

  const razorpayPaymentId = order.razorpay_payment_id;
  const isCreditOrder = order.payment_method === 'credit_45day';

  // GST breakdown from order_items
  const gstByRate = new Map<number, number>();
  for (const item of order.order_items) {
    gstByRate.set(item.gst_rate, (gstByRate.get(item.gst_rate) ?? 0) + item.gst_amount);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <div className="mb-6">
        <Link href="/buyer/orders" className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-teal-600 mb-3 transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Back to My Orders
        </Link>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 font-mono">{order.order_number}</h1>
            <p className="text-sm text-slate-500 mt-0.5">Placed {formatDate(order.created_at)}</p>
          </div>
          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${STATUS_STYLES[order.status] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}>
            {STATUS_LABELS[order.status] ?? order.status}
          </span>
        </div>
      </div>

      <div className="space-y-5">

        {/* ── Status Timeline ───────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-5">Order Status</h2>

          {order.status === 'cancelled' && order.cancelled_reason && (
            <div className="mb-4 px-3 py-2 bg-rose-50 border border-rose-200 rounded-lg text-sm text-rose-700">
              Cancelled: {order.cancelled_reason}
            </div>
          )}

          <div className="flex items-start">
            {TIMELINE_STEPS.map((step, idx) => {
              const state = order.status === 'cancelled'
                ? (STATUS_ORDER.indexOf(step.key) < STATUS_ORDER.indexOf(order.status === 'cancelled' ? 'pending' : order.status) ? 'done' : 'upcoming')
                : getStepState(step.key, order.status);
              const ts = getStepTimestamp(step.key, order);
              const isLast = idx === TIMELINE_STEPS.length - 1;

              return (
                <div key={step.key} className={`flex-1 flex flex-col items-center ${!isLast ? 'relative' : ''}`}>
                  {/* Connector line */}
                  {!isLast && (
                    <div className={`absolute top-4 left-1/2 w-full h-0.5 ${state === 'done' ? 'bg-teal-500' : 'bg-slate-200'}`} />
                  )}

                  {/* Step dot */}
                  <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center border-2 ${
                    state === 'done'
                      ? 'bg-teal-500 border-teal-500'
                      : state === 'current'
                      ? 'bg-white border-teal-500'
                      : 'bg-white border-slate-200'
                  }`}>
                    {state === 'done' ? (
                      <Check className="w-4 h-4 text-white" strokeWidth={3} />
                    ) : state === 'current' ? (
                      <span className="w-3 h-3 rounded-full bg-teal-500 animate-pulse" />
                    ) : (
                      <span className="w-3 h-3 rounded-full bg-slate-200" />
                    )}
                  </div>

                  {/* Label + timestamp */}
                  <div className="mt-2 text-center px-1">
                    <p className={`text-xs font-medium ${state === 'upcoming' ? 'text-slate-400' : 'text-slate-700'}`}>
                      {step.shortLabel}
                    </p>
                    {ts ? (
                      <p className="text-xs text-slate-400 mt-0.5 leading-tight">
                        {formatDate(ts)}
                      </p>
                    ) : state !== 'upcoming' ? (
                      <p className="text-xs text-slate-300 mt-0.5">—</p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Order Items ───────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Package className="w-4 h-4 text-teal-600" />
            <h2 className="text-sm font-semibold text-slate-700">Order Items ({order.order_items.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Product</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Qty</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Unit Price</th>
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">GST</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-slate-500 uppercase tracking-wide">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {order.order_items.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="font-medium text-slate-800">{item.product_name}</p>
                      {item.product_sku && (
                        <p className="text-xs text-slate-400 mt-0.5">SKU: {item.product_sku}</p>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-slate-700">{item.quantity}</td>
                    <td className="px-4 py-3.5 text-right font-mono text-slate-700">{formatINR(item.unit_price)}</td>
                    <td className="px-4 py-3.5 text-right font-mono text-slate-500 text-xs">
                      {item.gst_rate}% · {formatINR(item.gst_amount)}
                    </td>
                    <td className="px-5 py-3.5 text-right font-mono font-semibold text-slate-900">{formatINR(item.total_amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Price Summary ─────────────────────────────────────────────────── */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">Price Summary</h2>
          <div className="space-y-2.5">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-mono text-slate-700">{formatINR(order.subtotal)}</span>
            </div>
            {Array.from(gstByRate.entries()).map(([rate, amount]) => (
              <div key={rate} className="flex justify-between text-sm">
                <span className="text-slate-500">GST {rate}%</span>
                <span className="font-mono text-slate-600">{formatINR(amount)}</span>
              </div>
            ))}
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Delivery</span>
              {order.shipping_amount === 0
                ? <span className="font-mono text-emerald-600 font-medium">FREE</span>
                : <span className="font-mono text-slate-600">{formatINR(order.shipping_amount)}</span>
              }
            </div>
            <div className="flex justify-between text-base font-bold pt-2.5 border-t border-slate-200">
              <span className="text-slate-900">Total</span>
              <span className="font-mono text-teal-600">{formatINR(order.total_amount)}</span>
            </div>
          </div>
        </div>

        {/* ── Payment Info + Shipping ────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">

          {/* Payment */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="w-4 h-4 text-teal-600" />
              <h2 className="text-sm font-semibold text-slate-700">Payment</h2>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Method</span>
                <span className="text-slate-700">
                  {isCreditOrder ? '45-Day Credit' : 'Razorpay'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                {order.payment_status === 'paid' ? (
                  <span className="text-emerald-600 font-medium">Paid ✓</span>
                ) : isCreditOrder ? (
                  <span className="text-amber-600 font-medium">Due after delivery</span>
                ) : (
                  <span className="text-amber-500 font-medium">Pending</span>
                )}
              </div>
              {!isCreditOrder && razorpayPaymentId && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment ID</span>
                  <span className="font-mono text-xs text-slate-600 truncate max-w-[140px]">
                    {razorpayPaymentId}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Shipping */}
          {order.shipping_address && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-3">
                <MapPin className="w-4 h-4 text-teal-600" />
                <h2 className="text-sm font-semibold text-slate-700">Shipping To</h2>
              </div>
              <div className="text-sm text-slate-600 space-y-0.5">
                {order.shipping_address.name && (
                  <p className="font-medium text-slate-800">{order.shipping_address.name}</p>
                )}
                {order.shipping_address.phone && (
                  <p className="text-slate-500">{order.shipping_address.phone}</p>
                )}
                <p>{order.shipping_address.line1}</p>
                {order.shipping_address.line2 && <p>{order.shipping_address.line2}</p>}
                <p>
                  {[order.shipping_address.city, order.shipping_address.state, order.shipping_address.pincode]
                    .filter(Boolean).join(', ')}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* ── Order Notes ───────────────────────────────────────────────────── */}
        {order.notes && (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-2">
              <FileText className="w-4 h-4 text-teal-600" />
              <h2 className="text-sm font-semibold text-slate-700">Order Notes</h2>
            </div>
            <p className="text-sm text-slate-600">{order.notes}</p>
          </div>
        )}

        {/* ── Actions ───────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3">
          {order.status === 'delivered' && (
            <button
              onClick={handleReorder}
              disabled={reordering}
              className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-teal-600 text-white rounded-lg font-semibold text-sm hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
            >
              {reordering ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <RefreshCw className="w-4 h-4" />
              )}
              {reordering ? 'Adding to Cart…' : 'Reorder'}
            </button>
          )}

          <button
            onClick={() => toast('Invoice download coming soon!', { icon: '📄' })}
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-white text-slate-700 border border-slate-200 rounded-lg font-semibold text-sm hover:bg-slate-50 transition-colors"
          >
            <Download className="w-4 h-4" />
            Download Invoice
          </button>

          <Link
            href="/buyer/messages"
            className="flex-1 flex items-center justify-center gap-2 px-5 py-3 bg-white text-slate-700 border border-slate-200 rounded-lg font-semibold text-sm hover:bg-slate-50 transition-colors"
          >
            Need Help?
          </Link>
        </div>
      </div>
    </div>
  );
}
