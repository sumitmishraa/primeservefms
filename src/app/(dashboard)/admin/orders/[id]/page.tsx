/**
 * Admin — Order Detail Page
 *
 * The admin's action centre for a single order.
 * Shows order header, status timeline, action section (changes by status),
 * buyer info card, order items table, and admin notes editor.
 *
 * Data: GET /api/admin/orders/[id]
 * Mutations: PATCH /api/admin/orders/[id]
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Phone,
  Mail,
  MessageSquare,
  CheckCircle2,
  Clock,
  Truck,
  Package,
  XCircle,
  Building2,
  User,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatINR, formatDate } from '@/lib/utils/formatting';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import type { OrderDetail } from '@/app/api/admin/orders/[id]/route';
import type { Enums } from '@/types/database';

type OrderStatus = Enums<'order_status'>;

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

const STATUS_BADGE: Record<OrderStatus, { bg: string; text: string; label: string }> = {
  pending:             { bg: 'bg-amber-100',   text: 'text-amber-800',  label: 'Pending' },
  approved:            { bg: 'bg-blue-100',    text: 'text-blue-800',   label: 'Approved' },
  forwarded_to_vendor: { bg: 'bg-purple-100',  text: 'text-purple-800', label: 'Forwarded to Vendor' },
  dispatched:          { bg: 'bg-orange-100',  text: 'text-orange-800', label: 'Dispatched' },
  delivered:           { bg: 'bg-emerald-100', text: 'text-emerald-800',label: 'Delivered' },
  cancelled:           { bg: 'bg-rose-100',    text: 'text-rose-800',   label: 'Cancelled' },
  confirmed:           { bg: 'bg-slate-100',   text: 'text-slate-600',  label: 'Confirmed' },
  processing:          { bg: 'bg-slate-100',   text: 'text-slate-600',  label: 'Processing' },
  shipped:             { bg: 'bg-slate-100',   text: 'text-slate-600',  label: 'Shipped' },
};

function StatusBadge({ status }: { status: OrderStatus }) {
  const meta = STATUS_BADGE[status] ?? { bg: 'bg-slate-100', text: 'text-slate-600', label: status };
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${meta.bg} ${meta.text}`}>
      {meta.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Status Timeline
// ---------------------------------------------------------------------------

const TIMELINE_STEPS: { key: OrderStatus; label: string }[] = [
  { key: 'pending',             label: 'Pending' },
  { key: 'approved',            label: 'Approved' },
  { key: 'forwarded_to_vendor', label: 'Forwarded' },
  { key: 'dispatched',          label: 'Dispatched' },
  { key: 'delivered',           label: 'Delivered' },
];

function getStepTimestamp(order: OrderDetail, status: OrderStatus): string | null {
  if (status === 'pending')             return order.created_at;
  if (status === 'forwarded_to_vendor') return order.forwarded_at ?? null;
  if (status === 'dispatched')          return order.dispatched_at ?? null;
  if (status === 'delivered')           return order.delivered_at ?? null;
  return null;
}

function StatusTimeline({ order }: { order: OrderDetail }) {
  const isCancelled = order.status === 'cancelled';
  const currentIdx  = TIMELINE_STEPS.findIndex((s) => s.key === order.status);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <h2 className="mb-5 font-heading text-sm font-semibold uppercase tracking-wider text-slate-500">
        Order Timeline
      </h2>
      <div className="relative flex items-start justify-between">
        {/* Connector line */}
        <div className="absolute left-0 right-0 top-4 h-0.5 bg-slate-200" />

        {TIMELINE_STEPS.map((step, idx) => {
          const isCompleted = !isCancelled && currentIdx > idx;
          const isCurrent   = !isCancelled && currentIdx === idx;
          const ts          = isCompleted || isCurrent ? getStepTimestamp(order, step.key) : null;

          // For cancelled: mark the last completed step as cancelled
          const wasCancelledHere =
            isCancelled &&
            idx === Math.max(
              TIMELINE_STEPS.findIndex((s) => {
                // Find what the status was before cancellation — we don't track that,
                // so show cancel icon on last valid step if cancelled
                return false;
              }),
              0
            );

          return (
            <div key={step.key} className="relative z-10 flex flex-1 flex-col items-center">
              {/* Circle */}
              <div
                className={[
                  'flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-bold transition-all',
                  isCompleted
                    ? 'border-teal-600 bg-teal-600 text-white'
                    : isCurrent && !isCancelled
                      ? 'animate-pulse border-teal-600 bg-teal-100 text-teal-700'
                      : 'border-slate-200 bg-white text-slate-400',
                ].join(' ')}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : isCurrent && !isCancelled ? (
                  <span className="h-3 w-3 rounded-full bg-teal-600" />
                ) : (
                  <span className="h-3 w-3 rounded-full bg-slate-300" />
                )}
              </div>

              {/* Label */}
              <p
                className={[
                  'mt-2 text-center text-xs font-medium',
                  isCompleted || isCurrent ? 'text-slate-800' : 'text-slate-400',
                ].join(' ')}
              >
                {step.label}
              </p>

              {/* Timestamp */}
              {ts && (
                <p className="mt-0.5 text-center text-xs text-slate-400">
                  {formatDate(ts)}
                </p>
              )}
            </div>
          );
        })}

        {/* Cancelled indicator at the end */}
        {isCancelled && (
          <div className="relative z-10 flex flex-col items-center">
            <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-rose-500 bg-rose-100 text-rose-600">
              <XCircle className="h-4 w-4" />
            </div>
            <p className="mt-2 text-center text-xs font-medium text-rose-600">Cancelled</p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

interface ConfirmState {
  open:      boolean;
  title:     string;
  message:   string;
  onConfirm: () => void;
  variant:   'default' | 'destructive';
}

export default function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const [orderId,  setOrderId]  = useState<string | null>(null);
  const [order,    setOrder]    = useState<OrderDetail | null>(null);
  const [isLoading,setIsLoading]= useState(true);
  const [error,    setError]    = useState<string | null>(null);
  const [isUpdating,setUpdating]= useState(false);

  // Editable fields
  const [adminNotes,   setAdminNotes]   = useState('');
  const [vendorName,   setVendorName]   = useState('');
  const [vendorPhone,  setVendorPhone]  = useState('');
  const [cancelReason, setCancelReason] = useState('');
  const [showCancelForm, setShowCancelForm] = useState(false);

  // Confirm dialog
  const [confirm, setConfirm] = useState<ConfirmState>({
    open: false, title: '', message: '', onConfirm: () => {}, variant: 'default',
  });

  // Resolve params
  useEffect(() => {
    void params.then(({ id }) => setOrderId(id));
  }, [params]);

  // ---------------------------------------------------------------------------
  // Fetch order
  // ---------------------------------------------------------------------------

  const fetchOrder = useCallback(async (id: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const res  = await fetch(`/api/admin/orders/${id}`);
      const json = (await res.json()) as { data: OrderDetail | null; error: string | null };

      if (!res.ok || json.error || !json.data) {
        setError(json.error ?? 'Order not found');
        return;
      }

      setOrder(json.data);
      setAdminNotes(json.data.admin_notes ?? '');
      setVendorName(json.data.assigned_vendor_name ?? '');
      setVendorPhone(json.data.assigned_vendor_phone ?? '');
    } catch {
      setError('Failed to load order');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (orderId) void fetchOrder(orderId);
  }, [orderId, fetchOrder]);

  // ---------------------------------------------------------------------------
  // Update helper
  // ---------------------------------------------------------------------------

  async function updateOrder(
    updates: Record<string, unknown>,
    successMsg: string
  ): Promise<boolean> {
    if (!orderId) return false;
    setUpdating(true);
    try {
      const res  = await fetch(`/api/admin/orders/${orderId}`, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(updates),
      });
      const json = (await res.json()) as { data: unknown; error: string | null };

      if (!res.ok || json.error) {
        toast.error(json.error ?? 'Update failed');
        return false;
      }

      toast.success(successMsg);
      await fetchOrder(orderId);
      return true;
    } catch {
      toast.error('Network error — please try again');
      return false;
    } finally {
      setUpdating(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Action handlers
  // ---------------------------------------------------------------------------

  function openConfirm(cfg: Omit<ConfirmState, 'open'>) {
    setConfirm({ ...cfg, open: true });
  }

  const handleApprove = () => {
    openConfirm({
      title:     'Approve this order?',
      message:   'The order will be marked as approved and you can then forward it to a vendor.',
      variant:   'default',
      onConfirm: async () => {
        setConfirm((c) => ({ ...c, open: false }));
        await updateOrder({ status: 'approved' }, 'Order approved');
      },
    });
  };

  const handleCancelSubmit = async () => {
    if (!cancelReason.trim()) {
      toast.error('Please enter a reason for cancellation');
      return;
    }
    openConfirm({
      title:     'Cancel this order?',
      message:   `This cannot be undone. Reason: "${cancelReason}"`,
      variant:   'destructive',
      onConfirm: async () => {
        setConfirm((c) => ({ ...c, open: false }));
        const ok = await updateOrder(
          { status: 'cancelled', cancelled_reason: cancelReason },
          'Order cancelled'
        );
        if (ok) { setCancelReason(''); setShowCancelForm(false); }
      },
    });
  };

  const handleForwardToVendor = () => {
    if (!vendorName.trim() || !vendorPhone.trim()) {
      toast.error('Vendor name and phone are required');
      return;
    }
    openConfirm({
      title:   'Forward to vendor?',
      message: `Forward this order to ${vendorName} (${vendorPhone}). You will coordinate delivery via WhatsApp or call.`,
      variant: 'default',
      onConfirm: async () => {
        setConfirm((c) => ({ ...c, open: false }));
        await updateOrder(
          {
            status:                 'forwarded_to_vendor',
            assigned_vendor_name:   vendorName.trim(),
            assigned_vendor_phone:  vendorPhone.trim(),
          },
          'Order forwarded to vendor'
        );
      },
    });
  };

  const handleMarkDispatched = () => {
    openConfirm({
      title:   'Mark as dispatched?',
      message: 'This confirms that the vendor has dispatched the order for delivery.',
      variant: 'default',
      onConfirm: async () => {
        setConfirm((c) => ({ ...c, open: false }));
        await updateOrder({ status: 'dispatched' }, 'Order marked as dispatched');
      },
    });
  };

  const handleMarkDelivered = () => {
    openConfirm({
      title:   'Mark as delivered?',
      message: 'This marks the order as successfully delivered. This action is final.',
      variant: 'default',
      onConfirm: async () => {
        setConfirm((c) => ({ ...c, open: false }));
        await updateOrder({ status: 'delivered' }, 'Order marked as delivered');
      },
    });
  };

  const handleSaveNotes = async () => {
    await updateOrder({ admin_notes: adminNotes }, 'Notes saved');
  };

  // ---------------------------------------------------------------------------
  // Loading / error states
  // ---------------------------------------------------------------------------

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-500">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
          </svg>
          Loading order…
        </div>
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 text-center">
        <p className="text-sm text-rose-600">{error ?? 'Order not found'}</p>
        <Link href="/admin/orders" className="text-sm font-medium text-teal-600 hover:underline">
          Back to Orders
        </Link>
      </div>
    );
  }

  const { buyer, items } = order;
  const subtotal  = items.reduce((sum, i) => sum + (i.unit_price * i.quantity), 0);
  const gstTotal  = items.reduce((sum, i) => sum + i.gst_amount, 0);
  const grandTotal= items.reduce((sum, i) => sum + i.total_amount, 0);

  // ---------------------------------------------------------------------------
  // Action section (status-dependent)
  // ---------------------------------------------------------------------------

  function ActionSection() {
    switch (order!.status) {
      case 'pending':
        return (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-6">
            <h2 className="mb-4 font-heading text-base font-semibold text-amber-900">
              Action Required
            </h2>
            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                onClick={handleApprove}
                disabled={isUpdating}
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                Approve Order
              </button>
              <button
                onClick={() => setShowCancelForm((v) => !v)}
                disabled={isUpdating}
                className="flex-1 rounded-lg border border-rose-300 bg-white px-4 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
              >
                Cancel Order
              </button>
            </div>
            {showCancelForm && (
              <div className="mt-4 space-y-3">
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Reason for cancellation (required)…"
                  rows={3}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-400/20"
                />
                <button
                  onClick={() => void handleCancelSubmit()}
                  disabled={isUpdating || !cancelReason.trim()}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                >
                  Confirm Cancellation
                </button>
              </div>
            )}
            <div className="mt-4">
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Admin Notes
              </label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={3}
                placeholder="Internal notes about this order…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
              <button
                onClick={() => void handleSaveNotes()}
                disabled={isUpdating}
                className="mt-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
              >
                Save Notes
              </button>
            </div>
          </div>
        );

      case 'approved':
        return (
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-6">
            <h2 className="mb-1 font-heading text-base font-semibold text-blue-900">
              Forward to Vendor
            </h2>
            <p className="mb-4 text-sm text-blue-700">
              Select a vendor to fulfil this order. You will coordinate delivery via WhatsApp or call.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Vendor Name <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={vendorName}
                  onChange={(e) => setVendorName(e.target.value)}
                  placeholder="e.g. Raj Cleaning Supplies"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-700">
                  Vendor Phone <span className="text-rose-500">*</span>
                </label>
                <input
                  type="tel"
                  value={vendorPhone}
                  onChange={(e) => setVendorPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-slate-700">Admin Notes</label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={2}
                placeholder="Instructions for the vendor…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={handleForwardToVendor}
                disabled={isUpdating || !vendorName.trim() || !vendorPhone.trim()}
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                Forward to Vendor
              </button>
              <button
                onClick={() => setShowCancelForm((v) => !v)}
                disabled={isUpdating}
                className="rounded-lg border border-rose-300 bg-white px-4 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-60"
              >
                Cancel Order
              </button>
            </div>
            {showCancelForm && (
              <div className="mt-3 space-y-3">
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Reason for cancellation (required)…"
                  rows={2}
                  className="w-full rounded-lg border border-rose-200 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-400/20"
                />
                <button
                  onClick={() => void handleCancelSubmit()}
                  disabled={isUpdating || !cancelReason.trim()}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                >
                  Confirm Cancellation
                </button>
              </div>
            )}
          </div>
        );

      case 'forwarded_to_vendor':
        return (
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-6">
            <h2 className="mb-4 font-heading text-base font-semibold text-purple-900">
              Vendor Assigned
            </h2>
            <div className="mb-4 flex flex-col gap-2 rounded-lg border border-purple-200 bg-white p-4">
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-800">
                  {order!.assigned_vendor_name}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-slate-400" />
                <span className="font-mono text-sm text-slate-600">
                  {order!.assigned_vendor_phone}
                </span>
              </div>
            </div>
            <div className="mb-4 flex flex-wrap gap-2">
              <a
                href={`https://wa.me/${(order!.assigned_vendor_phone ?? '').replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-medium text-emerald-700 hover:bg-emerald-100"
              >
                <MessageSquare className="h-4 w-4" />
                WhatsApp Vendor
              </a>
              <a
                href={`tel:${order!.assigned_vendor_phone}`}
                className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                <Phone className="h-4 w-4" />
                Call Vendor
              </a>
            </div>
            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-slate-700">Admin Notes</label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={2}
                placeholder="Internal notes…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={handleMarkDispatched}
                disabled={isUpdating}
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                Mark as Dispatched
              </button>
              <button
                onClick={() => setShowCancelForm((v) => !v)}
                disabled={isUpdating}
                className="rounded-lg border border-rose-300 bg-white px-4 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-50"
              >
                Cancel Order
              </button>
            </div>
            {showCancelForm && (
              <div className="mt-3 space-y-3">
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Reason for cancellation (required)…"
                  rows={2}
                  className="w-full rounded-lg border border-rose-200 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-400/20"
                />
                <button
                  onClick={() => void handleCancelSubmit()}
                  disabled={isUpdating || !cancelReason.trim()}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                >
                  Confirm Cancellation
                </button>
              </div>
            )}
          </div>
        );

      case 'dispatched':
        return (
          <div className="rounded-xl border border-orange-200 bg-orange-50 p-6">
            <h2 className="mb-2 font-heading text-base font-semibold text-orange-900">
              Out for Delivery
            </h2>
            {order!.dispatched_at && (
              <p className="mb-4 text-sm text-orange-700">
                Dispatched on {formatDate(order!.dispatched_at)}
              </p>
            )}
            <div className="mt-3">
              <label className="mb-1 block text-xs font-medium text-slate-700">Admin Notes</label>
              <textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                rows={2}
                placeholder="Internal notes…"
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
              />
            </div>
            <div className="mt-4 flex flex-col gap-3 sm:flex-row">
              <button
                onClick={handleMarkDelivered}
                disabled={isUpdating}
                className="flex-1 rounded-lg bg-emerald-600 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                Mark as Delivered
              </button>
              <button
                onClick={() => setShowCancelForm((v) => !v)}
                disabled={isUpdating}
                className="rounded-lg border border-rose-300 bg-white px-4 py-3 text-sm font-semibold text-rose-600 hover:bg-rose-50"
              >
                Cancel Order
              </button>
            </div>
            {showCancelForm && (
              <div className="mt-3 space-y-3">
                <textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="Reason for cancellation (required)…"
                  rows={2}
                  className="w-full rounded-lg border border-rose-200 px-3 py-2 text-sm focus:border-rose-400 focus:outline-none focus:ring-2 focus:ring-rose-400/20"
                />
                <button
                  onClick={() => void handleCancelSubmit()}
                  disabled={isUpdating || !cancelReason.trim()}
                  className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
                >
                  Confirm Cancellation
                </button>
              </div>
            )}
          </div>
        );

      case 'delivered':
        return (
          <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-6">
            <CheckCircle2 className="h-6 w-6 shrink-0 text-emerald-600" />
            <div>
              <p className="font-heading font-semibold text-emerald-800">Order Complete</p>
              {order!.delivered_at && (
                <p className="text-sm text-emerald-600">
                  Delivered on {formatDate(order!.delivered_at)}
                </p>
              )}
            </div>
          </div>
        );

      case 'cancelled':
        return (
          <div className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-6">
            <XCircle className="mt-0.5 h-6 w-6 shrink-0 text-rose-600" />
            <div>
              <p className="font-heading font-semibold text-rose-800">Order Cancelled</p>
              {order!.cancelled_reason && (
                <p className="mt-1 text-sm text-rose-600">
                  Reason: {order!.cancelled_reason}
                </p>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <div className="min-h-full bg-slate-50">
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">

        {/* Back link */}
        <Link
          href="/admin/orders"
          className="mb-6 inline-flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Orders
        </Link>

        {/* Order header */}
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="font-heading text-2xl font-bold tracking-tight text-slate-900 font-mono">
              {order.order_number}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Placed {formatDate(order.created_at)}
            </p>
          </div>
          <StatusBadge status={order.status} />
        </div>

        {/* Status timeline */}
        <div className="mb-6">
          <StatusTimeline order={order} />
        </div>

        {/* Action section */}
        <div className="mb-6">
          <ActionSection />
        </div>

        {/* Buyer info card */}
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 font-heading text-sm font-semibold uppercase tracking-wider text-slate-500">
            Buyer Information
          </h2>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-slate-400" />
                <span className="font-medium text-slate-900">{buyer?.full_name ?? '—'}</span>
              </div>
              <div className="flex items-center gap-2">
                <Building2 className="h-4 w-4 text-slate-400" />
                <span className="text-sm text-slate-600">{buyer?.company_name ?? '—'}</span>
              </div>
              {buyer?.email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-slate-400" />
                  <span className="text-sm text-slate-600">{buyer.email}</span>
                </div>
              )}
              {buyer?.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-slate-400" />
                  <span className="font-mono text-sm text-slate-600">{buyer.phone}</span>
                </div>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {buyer?.phone && (
                <a
                  href={`tel:${buyer.phone}`}
                  className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Phone className="h-3.5 w-3.5" />
                  Call Buyer
                </a>
              )}
              {buyer?.email && (
                <a
                  href={`mailto:${buyer.email}`}
                  className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Mail className="h-3.5 w-3.5" />
                  Email Buyer
                </a>
              )}
            </div>
          </div>

          {/* Shipping address */}
          {order.shipping_address && (
            <div className="mt-4 rounded-lg bg-slate-50 p-3">
              <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">
                Delivery Address
              </p>
              <p className="text-sm text-slate-700">
                {order.shipping_address.name && <span className="font-medium">{order.shipping_address.name}, </span>}
                {order.shipping_address.line1}
                {order.shipping_address.line2 ? `, ${order.shipping_address.line2}` : ''}
                {', '}
                {order.shipping_address.city}
                {', '}
                {order.shipping_address.state}
                {' — '}
                {order.shipping_address.pincode}
              </p>
            </div>
          )}
        </div>

        {/* Order items table */}
        <div className="mb-6 rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 px-6 py-4">
            <h2 className="font-heading text-sm font-semibold uppercase tracking-wider text-slate-500">
              Order Items
            </h2>
          </div>

          {items.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-12 text-slate-400">
              <Package className="h-5 w-5" />
              <span className="text-sm">No items found</span>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Product
                      </th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                        SKU
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Qty
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Unit Price
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                        GST
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {item.product_name}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-slate-500">
                          {item.product_sku ?? '—'}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-700">
                          {item.quantity}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-slate-700">
                          {formatINR(item.unit_price)}
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs text-slate-500">
                          {formatINR(item.gst_amount)}
                          <span className="ml-1 text-xs text-slate-400">
                            ({item.gst_rate}%)
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right font-mono font-semibold text-slate-900">
                          {formatINR(item.total_amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="border-t border-slate-100 px-6 py-4">
                <div className="ml-auto w-full max-w-xs space-y-2 text-sm">
                  <div className="flex justify-between text-slate-600">
                    <span>Subtotal</span>
                    <span className="font-mono">{formatINR(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>GST</span>
                    <span className="font-mono">{formatINR(gstTotal)}</span>
                  </div>
                  {order.shipping_amount > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Shipping</span>
                      <span className="font-mono">{formatINR(order.shipping_amount)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t border-slate-200 pt-2 font-semibold text-slate-900">
                    <span>Grand Total</span>
                    <span className="font-mono text-teal-700">
                      {formatINR(grandTotal + order.shipping_amount)}
                    </span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Admin notes (standalone section for delivered/cancelled) */}
        {(order.status === 'delivered' || order.status === 'cancelled') && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="mb-3 font-heading text-sm font-semibold uppercase tracking-wider text-slate-500">
              Admin Notes
            </h2>
            <textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              rows={3}
              placeholder="Internal notes…"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
            <button
              onClick={() => void handleSaveNotes()}
              disabled={isUpdating}
              className="mt-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-60"
            >
              Update Notes
            </button>
          </div>
        )}

      </div>

      {/* Confirm dialog */}
      <ConfirmDialog
        open={confirm.open}
        title={confirm.title}
        message={confirm.message}
        variant={confirm.variant}
        onConfirm={confirm.onConfirm}
        onCancel={() => setConfirm((c) => ({ ...c, open: false }))}
        loading={isUpdating}
      />
    </div>
  );
}
