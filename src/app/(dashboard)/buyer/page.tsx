'use client';

/**
 * Buyer Dashboard Home
 * Welcome section + stats cards + recent orders + frequently ordered products.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ShoppingBag, Package, RefreshCw, TrendingUp, Clock, CheckCircle2, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { formatINR, formatDate } from '@/lib/utils/formatting';
import type { OrderStatus } from '@/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RecentOrder {
  id: string; order_number: string; status: OrderStatus;
  total_amount: number; created_at: string; item_count: number;
}

interface FreqProduct {
  product_id: string; product_name: string;
  times_ordered: number; last_ordered: string;
}

interface Stats {
  active_orders: number;
  total_this_month: number;
  total_orders: number;
  recent_orders: RecentOrder[];
  top_products: FreqProduct[];
}

// ---------------------------------------------------------------------------
// Status badge helpers
// ---------------------------------------------------------------------------

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700',
  approved: 'bg-blue-50 text-blue-700',
  forwarded_to_vendor: 'bg-purple-50 text-purple-700',
  dispatched: 'bg-orange-50 text-orange-700',
  delivered: 'bg-emerald-50 text-emerald-700',
  cancelled: 'bg-rose-50 text-rose-700',
};

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', approved: 'Approved', forwarded_to_vendor: 'Processing',
  dispatched: 'Dispatched', delivered: 'Delivered', cancelled: 'Cancelled',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BuyerDashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [userName, setUserName] = useState('');
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const [statsRes, profileRes] = await Promise.all([
          fetch('/api/buyer/stats'),
          fetch('/api/auth/me'),
        ]);
        const [statsJson, profileJson] = await Promise.all([
          statsRes.json() as Promise<{ data: Stats | null; error: string | null }>,
          profileRes.json() as Promise<{ user: { full_name: string; company_name: string | null } | null }>,
        ]);
        if (statsJson.data) setStats(statsJson.data);
        if (profileJson.user) {
          setUserName(profileJson.user.full_name);
          setCompanyName(profileJson.user.company_name ?? '');
        }
      } catch {
        toast.error('Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="w-8 h-8 animate-spin text-teal-600" />
    </div>
  );

  const hasOrders = (stats?.total_orders ?? 0) > 0;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* ── Welcome ───────────────────────────────────────────────────────── */}
      <div className="mb-7">
        <h1 className="text-2xl font-bold text-slate-900">
          Welcome{userName ? `, ${userName.split(' ')[0]}` : ''}!
        </h1>
        {companyName && <p className="text-slate-500 text-sm mt-0.5">{companyName}</p>}

        {/* Quick actions */}
        <div className="flex flex-wrap gap-2 mt-4">
          <Link href="/marketplace" className="inline-flex items-center gap-1.5 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 transition-colors">
            <ShoppingBag className="w-4 h-4" />Browse Marketplace
          </Link>
          <Link href="/buyer/orders" className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors">
            <Package className="w-4 h-4" />View Orders
          </Link>
          <Link href="/buyer/reorder" className="inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-lg text-sm font-semibold hover:bg-slate-50 transition-colors">
            <RefreshCw className="w-4 h-4" />Quick Reorder
          </Link>
        </div>
      </div>

      {/* ── No orders — onboarding state ─────────────────────────────────── */}
      {!hasOrders ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center">
          <ShoppingBag className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <h2 className="text-lg font-semibold text-slate-700 mb-2">Welcome to PrimeServe!</h2>
          <p className="text-slate-500 text-sm mb-6">Start browsing our catalog to place your first order.</p>
          <Link href="/marketplace" className="inline-flex items-center gap-2 px-5 py-2.5 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 transition-colors">
            <ShoppingBag className="w-4 h-4" />Go to Marketplace
          </Link>
        </div>
      ) : (
        <>
          {/* ── Stats Cards ─────────────────────────────────────────────── */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-7">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-amber-50 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-amber-600" />
                </div>
                <p className="text-sm font-medium text-slate-600">Active Orders</p>
              </div>
              <p className="text-3xl font-bold text-slate-900">{stats?.active_orders ?? 0}</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-teal-50 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-teal-600" />
                </div>
                <p className="text-sm font-medium text-slate-600">Spent This Month</p>
              </div>
              <p className="text-2xl font-bold text-slate-900 font-mono">{formatINR(stats?.total_this_month ?? 0)}</p>
            </div>

            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-3 mb-2">
                <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                </div>
                <p className="text-sm font-medium text-slate-600">Total Orders</p>
              </div>
              <p className="text-3xl font-bold text-slate-900">{stats?.total_orders ?? 0}</p>
            </div>
          </div>

          {/* ── Recent Orders ────────────────────────────────────────────── */}
          {(stats?.recent_orders?.length ?? 0) > 0 && (
            <section className="mb-7">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-slate-700">Recent Orders</h2>
                <Link href="/buyer/orders" className="text-sm text-teal-600 hover:underline">View All →</Link>
              </div>
              <div className="space-y-2">
                {stats!.recent_orders.map((order) => (
                  <Link
                    key={order.id}
                    href={`/buyer/orders/${order.id}`}
                    className="flex items-center justify-between gap-4 bg-white rounded-xl border border-slate-200 shadow-sm p-4 hover:border-teal-300 hover:shadow-md transition-all"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-teal-600 font-mono">{order.order_number}</p>
                      <p className="text-xs text-slate-400 mt-0.5">{formatDate(order.created_at)} · {order.item_count} item{order.item_count !== 1 ? 's' : ''}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[order.status] ?? 'bg-slate-50 text-slate-600'}`}>
                        {STATUS_LABELS[order.status] ?? order.status}
                      </span>
                      <p className="font-mono font-bold text-slate-900 text-sm">{formatINR(order.total_amount)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {/* ── Frequently Ordered ───────────────────────────────────────── */}
          {(stats?.top_products?.length ?? 0) > 0 && (
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-slate-700">Frequently Ordered</h2>
                <Link href="/buyer/reorder" className="text-sm text-teal-600 hover:underline">Quick Reorder →</Link>
              </div>
              <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
                {stats!.top_products.slice(0, 3).map((p) => (
                  <div key={p.product_id} className="flex items-center justify-between gap-4 px-5 py-3.5">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 truncate">{p.product_name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Ordered {p.times_ordered}×</p>
                    </div>
                    <Link
                      href={`/marketplace?search=${encodeURIComponent(p.product_name)}`}
                      className="text-xs text-teal-600 font-medium hover:underline shrink-0"
                    >
                      Order Again →
                    </Link>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}
