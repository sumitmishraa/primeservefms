'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatINR } from '@/lib/utils/formatting';

interface Order {
  id: string; order_number: string; status: string;
  payment_status: string; payment_method: string;
  total_amount: number; created_at: string;
  order_items: { id: string; product_name: string; quantity: number }[];
}

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-blue-50 text-blue-700 border-blue-200',
  dispatched: 'bg-purple-50 text-purple-700 border-purple-200',
  delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
};

const STATUS_EMOJI: Record<string, string> = {
  pending: '⏳', approved: '✅', dispatched: '🚚', delivered: '📦', cancelled: '❌',
};

const TABS = ['All', 'Pending', 'Approved', 'Dispatched', 'Delivered', 'Cancelled'];

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MobileOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('All');
  const [refreshing, setRefreshing] = useState(false);

  async function load() {
    const res = await fetch('/api/buyer/orders?per_page=200');
    const data = await res.json();
    if (data?.data?.orders) setOrders(data.data.orders);
    setLoading(false);
    setRefreshing(false);
  }

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) { router.replace('/mobile/login'); return; }
        load();
      })
      .catch(() => router.replace('/mobile/login'));
  }, [router]);

  const filtered = tab === 'All' ? orders : orders.filter((o) => o.status === tab.toLowerCase());

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-[3px] border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white px-4 pt-12 pb-3 border-b border-slate-100 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h1 className="font-heading font-bold text-xl text-slate-900">My Orders</h1>
          <span className="text-slate-400 text-sm">{orders.length} total</span>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {TABS.map((t) => {
            const count = t === 'All' ? orders.length : orders.filter((o) => o.status === t.toLowerCase()).length;
            return (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                  tab === t
                    ? 'bg-teal-600 text-white border-teal-600'
                    : 'bg-white text-slate-500 border-slate-200'
                }`}
              >
                {t} {count > 0 && <span className="ml-0.5 opacity-70">({count})</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* Order list */}
      <div className="px-4 py-4 space-y-3">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 gap-3">
            <span className="text-5xl">📦</span>
            <p className="font-heading font-bold text-slate-900 text-lg">
              {tab === 'All' ? 'No orders yet' : `No ${tab} orders`}
            </p>
            <p className="text-slate-400 text-sm text-center">
              {tab === 'All' ? 'Browse the marketplace to place your first order.' : 'Try a different filter.'}
            </p>
          </div>
        ) : (
          filtered.map((order) => {
            const statusStyle = STATUS_STYLE[order.status] ?? 'bg-slate-50 text-slate-600 border-slate-200';
            const itemPreview = order.order_items.length > 0
              ? `${order.order_items[0].product_name} ×${order.order_items[0].quantity}${order.order_items.length > 1 ? ` +${order.order_items.length - 1} more` : ''}`
              : 'No items';

            return (
              <div key={order.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
                {/* Top */}
                <div className="px-4 pt-4 pb-3 flex justify-between items-start">
                  <div>
                    <p className="font-mono font-bold text-teal-700">{order.order_number}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{formatDate(order.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusStyle}`}>
                      {STATUS_EMOJI[order.status]} {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
                    </span>
                    <p className="font-mono font-bold text-slate-900 text-base mt-1">{formatINR(order.total_amount)}</p>
                  </div>
                </div>

                {/* Items preview */}
                <div className="px-4 pb-3">
                  <p className="text-slate-500 text-xs truncate">{itemPreview}</p>
                </div>

                {/* Footer */}
                <div className="border-t border-slate-100 px-4 py-2.5 flex justify-between items-center bg-slate-50">
                  <span className={`text-xs font-semibold ${
                    order.payment_status === 'paid' ? 'text-emerald-600' : 'text-amber-600'
                  }`}>
                    {order.payment_status === 'paid' ? '✓ Paid' :
                      order.payment_method === 'credit_45day' ? '45-Day Credit' : 'Payment Pending'}
                  </span>
                  <span className="text-teal-600 text-xs font-semibold">
                    {order.order_items.length} item{order.order_items.length !== 1 ? 's' : ''}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
