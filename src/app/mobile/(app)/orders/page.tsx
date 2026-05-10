'use client';

import { useEffect, useState } from 'react';
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  LoadingScreen,
  MobilePage,
  RequireAuth,
  ScreenHeader,
  mobileIcons,
} from '@/components/mobile/PrimeserveMobile';
import { formatINR } from '@/lib/utils/formatting';

interface Order {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method: string;
  total_amount: number;
  created_at: string;
  order_items: { id: string; product_name: string; quantity: number }[];
}

const tabs = ['All', 'Pending', 'Approved', 'Dispatched', 'Delivered', 'Cancelled'];

const statusTone: Record<string, 'teal' | 'amber' | 'rose' | 'blue' | 'slate'> = {
  pending: 'amber',
  approved: 'blue',
  forwarded_to_vendor: 'blue',
  dispatched: 'blue',
  delivered: 'teal',
  cancelled: 'rose',
};

function formatDate(value: string) {
  return new Date(value).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function OrdersContent() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('All');

  useEffect(() => {
    fetch('/api/buyer/orders?per_page=200')
      .then((r) => r.json())
      .then((d) => setOrders(d?.data?.orders ?? []))
      .catch(() => setOrders([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingScreen label="Loading orders" />;

  const filtered = tab === 'All' ? orders : orders.filter((order) => order.status === tab.toLowerCase());

  return (
    <MobilePage>
      <ScreenHeader title="My Orders" subtitle="Track procurement and reorders" variant="dark" />

      <div className="scrollbar-hide flex gap-2 overflow-x-auto border-b border-slate-200 bg-white px-5 py-3">
        {tabs.map((item) => {
          const count = item === 'All' ? orders.length : orders.filter((order) => order.status === item.toLowerCase()).length;
          const active = item === tab;
          return (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`ps-press shrink-0 rounded-full border px-3 py-2 text-xs font-extrabold ${active ? 'border-transparent bg-[#0D9488] text-white' : 'border-slate-200 bg-white text-slate-500'}`}
            >
              {item} {count > 0 ? `(${count})` : ''}
            </button>
          );
        })}
      </div>

      <div className="space-y-3 px-5 py-5">
        {filtered.length === 0 ? (
          <EmptyState
            icon={mobileIcons.Box}
            title={tab === 'All' ? 'No orders yet' : `No ${tab.toLowerCase()} orders`}
            body="Browse the PrimeServe catalog to place your first order."
            action={<ButtonLink href="/mobile/products">Browse products</ButtonLink>}
          />
        ) : (
          filtered.map((order) => {
            const itemPreview = order.order_items.length > 0
              ? `${order.order_items[0].product_name} x${order.order_items[0].quantity}${order.order_items.length > 1 ? ` +${order.order_items.length - 1} more` : ''}`
              : 'No items';

            return (
              <Card key={order.id} className="overflow-hidden">
                <div className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="font-mono text-sm font-extrabold text-[#0D9488]">{order.order_number}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-400">{formatDate(order.created_at)}</p>
                    </div>
                    <div className="text-right">
                      <Badge tone={statusTone[order.status] ?? 'slate'}>{order.status.replaceAll('_', ' ')}</Badge>
                      <p className="mt-2 font-mono text-base font-extrabold text-slate-900">{formatINR(order.total_amount)}</p>
                    </div>
                  </div>
                  <p className="mt-4 truncate text-sm font-semibold text-slate-500">{itemPreview}</p>
                </div>
                <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-4 py-3">
                  <span className="text-xs font-extrabold text-[#0D9488]">
                    {order.payment_method === 'credit_45day' ? '45-day credit terms' : order.payment_status}
                  </span>
                  <span className="text-xs font-bold text-slate-400">{order.order_items.length} items</span>
                </div>
              </Card>
            );
          })
        )}
      </div>
    </MobilePage>
  );
}

export default function MobileOrdersPage() {
  return (
    <RequireAuth>
      <OrdersContent />
    </RequireAuth>
  );
}
