'use client';

/**
 * Account > Order History
 * Full order list with filter tabs, same data as /buyer/orders but in the account context.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Package, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatINR, formatDate } from '@/lib/utils/formatting';
import type { OrderStatus } from '@/types';

interface OrderPreviewItem { id: string; product_name: string; quantity: number; }
interface OrderPreview {
  id: string; order_number: string; status: OrderStatus;
  payment_status: string; payment_method: 'razorpay' | 'credit_45day';
  total_amount: number; created_at: string; order_items: OrderPreviewItem[];
}

const STATUS_TABS: { value: OrderStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
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
  pending: 'Pending', approved: 'Approved',
  forwarded_to_vendor: 'Forwarded', dispatched: 'Dispatched',
  delivered: 'Delivered', cancelled: 'Cancelled',
};

function itemsPreview(items: OrderPreviewItem[]): string {
  if (!items.length) return 'No items';
  const first = `${items[0].product_name} ×${items[0].quantity}`;
  if (items.length === 1) return first;
  return `${first} and ${items.length - 1} more item${items.length - 1 !== 1 ? 's' : ''}`;
}

const PER_PAGE = 8;

export default function AccountOrdersPage() {
  const [orders, setOrders] = useState<OrderPreview[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<OrderStatus | 'all'>('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [activeTab]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const params = new URLSearchParams({ page: String(page), per_page: String(PER_PAGE) });
        if (activeTab !== 'all') params.set('status', activeTab);
        const res = await fetch(`/api/buyer/orders?${params}`);
        const json = await res.json() as {
          data: { orders: OrderPreview[]; total: number; page: number; per_page: number } | null;
          error: string | null;
        };
        if (!res.ok || json.error) throw new Error(json.error ?? 'Failed');
        setOrders(json.data?.orders ?? []);
        const total = json.data?.total ?? 0;
        setTotalPages(Math.max(1, Math.ceil(total / PER_PAGE)));
      } catch {
        toast.error('Could not load orders');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [activeTab, page]);

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex overflow-x-auto border-b border-slate-100">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-4 py-3 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                activeTab === tab.value
                  ? 'border-teal-600 text-teal-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Order list */}
        {loading ? (
          <div className="py-12 text-center text-slate-400 text-sm">Loading orders…</div>
        ) : orders.length === 0 ? (
          <div className="py-12 text-center">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium text-sm">No orders found</p>
            <p className="text-slate-400 text-xs mt-1">
              {activeTab === 'all' ? "You haven't placed any orders yet." : `No ${STATUS_LABELS[activeTab] ?? activeTab} orders.`}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {orders.map((order) => (
              <Link
                key={order.id}
                href={`/buyer/orders/${order.id}`}
                className="flex items-start justify-between gap-4 px-5 py-4 hover:bg-slate-50 transition-colors group"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-slate-900 font-mono">{order.order_number}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${STATUS_STYLES[order.status] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                      {STATUS_LABELS[order.status] ?? order.status}
                    </span>
                  </div>
                  <p className="text-sm text-slate-500 truncate">{itemsPreview(order.order_items)}</p>
                  <p className="text-xs text-slate-400 mt-1">{formatDate(order.created_at)}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-sm font-bold font-mono text-slate-900">{formatINR(order.total_amount)}</p>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-300 group-hover:text-teal-500 ml-auto mt-2 transition-colors" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 shadow-sm px-5 py-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <ChevronLeft className="w-4 h-4" />Previous
          </button>
          <span className="text-xs text-slate-500">Page {page} of {totalPages}</span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next<ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
