'use client';

/**
 * Buyer — My Orders page
 * Filter tabs + order cards + pagination.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Package, ShoppingBag, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

import { formatINR, formatDate } from '@/lib/utils/formatting';
import type { OrderStatus } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OrderPreviewItem {
  id: string;
  product_name: string;
  quantity: number;
}

interface OrderPreview {
  id: string;
  order_number: string;
  status: OrderStatus;
  payment_status: string;
  total_amount: number;
  created_at: string;
  order_items: OrderPreviewItem[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_TABS: { value: OrderStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All Orders' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'forwarded_to_vendor', label: 'Forwarded' },
  { value: 'dispatched', label: 'Dispatched' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-blue-50 text-blue-700 border-blue-200',
  forwarded_to_vendor: 'bg-purple-50 text-purple-700 border-purple-200',
  dispatched: 'bg-orange-50 text-orange-700 border-orange-200',
  delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending',
  approved: 'Approved',
  forwarded_to_vendor: 'Forwarded',
  dispatched: 'Dispatched',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

function itemsPreview(items: OrderPreviewItem[]): string {
  if (!items.length) return 'No items';
  const first = `${items[0].product_name} ×${items[0].quantity}`;
  if (items.length === 1) return first;
  return `${first} and ${items.length - 1} more item${items.length - 1 !== 1 ? 's' : ''}`;
}

const PER_PAGE = 10;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BuyerOrdersPage() {
  const [orders, setOrders] = useState<OrderPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<OrderStatus | 'all'>('all');
  const [page, setPage] = useState(1);

  useEffect(() => {
    async function fetchOrders() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch('/api/buyer/orders?per_page=200');
        const json = await res.json() as {
          data: { orders: OrderPreview[] } | null;
          error: string | null;
        };
        if (!res.ok || json.error || !json.data) throw new Error(json.error ?? 'Failed');
        setOrders(json.data.orders);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to load orders';
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    }
    fetchOrders();
  }, []);

  // Tab filtering + pagination (client-side)
  const filtered = activeTab === 'all'
    ? orders
    : orders.filter((o) => o.status === activeTab);

  const totalPages = Math.ceil(filtered.length / PER_PAGE);
  const paginated = filtered.slice((page - 1) * PER_PAGE, page * PER_PAGE);

  function handleTab(tab: OrderStatus | 'all') {
    setActiveTab(tab);
    setPage(1);
  }

  // Tab counts
  const counts: Record<string, number> = { all: orders.length };
  for (const o of orders) {
    counts[o.status] = (counts[o.status] ?? 0) + 1;
  }

  // ── Loading ────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">My Orders</h1>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-slate-200 h-28 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // ── Error ──────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-6">My Orders</h1>
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <p className="text-rose-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm text-teal-600 hover:underline"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">My Orders</h1>

      {/* ── Filter Tabs ──────────────────────────────────────────────────── */}
      <div className="flex gap-1 overflow-x-auto pb-1 mb-6 border-b border-slate-200 scrollbar-hide">
        {STATUS_TABS.map((tab) => {
          const count = counts[tab.value] ?? 0;
          const isActive = activeTab === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => handleTab(tab.value)}
              className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                isActive
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
              }`}
            >
              {tab.label}
              {count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-mono ${
                  isActive ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Empty state ───────────────────────────────────────────────────── */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-700 mb-2">
            {activeTab === 'all' ? "You haven't placed any orders yet" : `No ${STATUS_LABELS[activeTab] ?? activeTab} orders`}
          </h2>
          <p className="text-slate-500 text-sm mb-6">
            {activeTab === 'all' ? 'Start shopping and your orders will appear here.' : 'Switch to another tab to see more orders.'}
          </p>
          {activeTab === 'all' && (
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 transition-colors"
            >
              <ShoppingBag className="w-4 h-4" />
              Browse Marketplace
            </Link>
          )}
        </div>
      ) : (
        <>
          {/* ── Order Cards ─────────────────────────────────────────────── */}
          <div className="space-y-3">
            {paginated.map((order) => (
              <Link
                key={order.id}
                href={`/buyer/orders/${order.id}`}
                className="block bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-teal-300 transition-all p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  {/* Left */}
                  <div className="min-w-0 flex-1">
                    <p className="text-base font-bold text-teal-600 font-mono">{order.order_number}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Placed {formatDate(order.created_at)}</p>
                    <p className="text-sm text-slate-600 mt-2 truncate">
                      {itemsPreview(order.order_items)}
                    </p>
                  </div>

                  {/* Right */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${STATUS_STYLES[order.status] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                      {STATUS_LABELS[order.status] ?? order.status}
                    </span>
                    <p className="font-mono font-bold text-slate-900 text-base">{formatINR(order.total_amount)}</p>
                    <p className="text-xs text-slate-400">
                      {order.payment_status === 'paid'
                        ? <span className="text-emerald-600 font-medium">Paid ✓</span>
                        : <span className="text-amber-500 font-medium">Payment Pending</span>}
                    </p>
                  </div>
                </div>

                {/* Bottom row */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-100">
                  <span className="text-xs text-teal-600 font-medium">View Details →</span>
                  {order.status === 'delivered' && (
                    <span className="flex items-center gap-1 text-xs text-teal-600 font-medium border border-teal-200 rounded px-2 py-0.5">
                      <RefreshCw className="w-3 h-3" />
                      Reorder
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>

          {/* ── Pagination ──────────────────────────────────────────────── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-3 mt-6">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-teal-600 hover:border-teal-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-slate-600">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg border border-slate-200 text-slate-500 hover:text-teal-600 hover:border-teal-300 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
