'use client';

/**
 * Buyer — Quick Reorder page
 * Shows delivered orders + frequently ordered products.
 */

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { RefreshCw, ShoppingBag, Package, Loader2, Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';

import { formatINR, formatDate } from '@/lib/utils/formatting';
import { useCartStore } from '@/stores/cartStore';
import type { OrderStatus, Product } from '@/types';

interface OrderPreviewItem { id: string; product_name: string; quantity: number; }
interface DeliveredOrder {
  id: string; order_number: string; status: OrderStatus;
  total_amount: number; created_at: string;
  order_items: OrderPreviewItem[];
}
interface FreqProduct {
  product_id: string; product_name: string;
  times_ordered: number; last_ordered: string;
}

function itemsSummary(items: OrderPreviewItem[]): string {
  if (!items.length) return 'No items';
  const parts = items.slice(0, 2).map((i) => `${i.product_name} ×${i.quantity}`);
  const more = items.length - 2;
  return more > 0 ? `${parts.join(', ')}, +${more} more` : parts.join(', ');
}

export default function QuickReorderPage() {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);

  const [orders, setOrders] = useState<DeliveredOrder[]>([]);
  const [topProducts, setTopProducts] = useState<FreqProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [reordering, setReordering] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [oRes, sRes] = await Promise.all([
          fetch('/api/buyer/orders?status=delivered&per_page=50'),
          fetch('/api/buyer/stats'),
        ]);
        const [oJson, sJson] = await Promise.all([
          oRes.json() as Promise<{ data: { orders: DeliveredOrder[] } | null; error: string | null }>,
          sRes.json() as Promise<{ data: { top_products: FreqProduct[] } | null; error: string | null }>,
        ]);
        if (oJson.data) setOrders(oJson.data.orders);
        if (sJson.data) setTopProducts(sJson.data.top_products.slice(0, 5));
      } catch {
        toast.error('Failed to load reorder data');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleReorder = useCallback(async (orderId: string) => {
    setReordering(orderId);
    try {
      const res = await fetch(`/api/buyer/orders/${orderId}/reorder`);
      const json = await res.json() as {
        data: { products: Product[]; quantities: Record<string, number> } | null;
        error: string | null;
      };
      if (!json.data?.products.length) { toast.error('No available products to reorder'); return; }

      const { products, quantities } = json.data;
      const originalCount = orders.find((o) => o.id === orderId)?.order_items.length ?? 0;

      for (const product of products) addItem(product, quantities[product.id] ?? product.moq);

      const skipped = originalCount - products.length;
      if (skipped > 0) {
        toast(`${products.length} items added. ${skipped} item${skipped !== 1 ? 's' : ''} no longer available.`, { icon: 'ℹ️' });
      } else {
        toast.success(`${products.length} item${products.length !== 1 ? 's' : ''} added to cart!`);
      }
      router.push('/buyer/cart');
    } catch { toast.error('Reorder failed — please try again'); }
    finally { setReordering(null); }
  }, [orders, addItem, router]);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Quick Reorder</h1>
        <p className="text-slate-500 text-sm mt-1">Reorder your previous purchases with one click</p>
      </div>

      {/* ── Past Delivered Orders ─────────────────────────────────────────── */}
      <section className="mb-8">
        <h2 className="text-base font-semibold text-slate-700 mb-3">Past Orders</h2>

        {orders.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-medium mb-1">No delivered orders yet</p>
            <p className="text-slate-400 text-sm mb-5">Place your first order to start using Quick Reorder!</p>
            <Link href="/marketplace" className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 transition-colors">
              <ShoppingBag className="w-4 h-4" />Browse Marketplace
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div className="min-w-0">
                    <p className="font-bold text-teal-600 font-mono text-sm">{order.order_number}</p>
                    <p className="text-xs text-slate-400 mt-0.5">{formatDate(order.created_at)}</p>
                    <p className="text-sm text-slate-600 mt-1.5 line-clamp-2">{itemsSummary(order.order_items)}</p>
                  </div>
                  <p className="font-mono font-bold text-slate-900 text-base whitespace-nowrap shrink-0">{formatINR(order.total_amount)}</p>
                </div>
                <button
                  onClick={() => handleReorder(order.id)}
                  disabled={reordering === order.id}
                  className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
                >
                  {reordering === order.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {reordering === order.id ? 'Adding to Cart…' : 'Reorder All Items'}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ── Frequently Ordered ───────────────────────────────────────────── */}
      {topProducts.length > 0 && (
        <section>
          <h2 className="text-base font-semibold text-slate-700 mb-3">Frequently Ordered</h2>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
            {topProducts.map((p) => (
              <div key={p.product_id} className="flex items-center justify-between gap-4 px-5 py-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 truncate">{p.product_name}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Ordered {p.times_ordered}× · Last {formatDate(p.last_ordered)}
                  </p>
                </div>
                {/* Navigate to marketplace with product search so buyer can add at desired qty */}
                <Link
                  href={`/marketplace?search=${encodeURIComponent(p.product_name)}`}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-teal-300 text-teal-700 rounded-lg text-xs font-semibold hover:bg-teal-50 transition-colors shrink-0"
                >
                  <Search className="w-3 h-3" />Find & Add
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
