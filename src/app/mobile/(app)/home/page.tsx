'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatINR } from '@/lib/utils/formatting';

interface User { id: string; full_name: string; email: string; role: string; company_name: string | null; }
interface RecentOrder { id: string; order_number: string; status: string; total_amount: number; created_at: string; item_count: number; }
interface Stats {
  active_orders: number; total_this_month: number; total_orders: number;
  recent_orders: RecentOrder[]; top_products: { product_name: string; times_ordered: number }[];
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  approved: 'bg-blue-50 text-blue-700 border-blue-200',
  dispatched: 'bg-purple-50 text-purple-700 border-purple-200',
  delivered: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  cancelled: 'bg-rose-50 text-rose-700 border-rose-200',
};

export default function MobileHomePage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) { router.replace('/mobile/login'); return; }
        setUser(d.user);
        return fetch('/api/buyer/stats').then((r) => r.json());
      })
      .then((d) => {
        if (d?.data) setStats(d.data);
        setLoading(false);
      })
      .catch(() => router.replace('/mobile/login'));
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-[3px] border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const firstName = user?.full_name.split(' ')[0] ?? '';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-teal-600 px-4 pt-12 pb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-teal-100 text-sm">Good day,</p>
            <h1 className="text-white font-heading font-bold text-xl">{firstName} 👋</h1>
            {user?.company_name && (
              <p className="text-teal-200 text-xs mt-0.5">{user.company_name}</p>
            )}
          </div>
          <div className="w-11 h-11 bg-white/20 rounded-full flex items-center justify-center">
            <span className="text-white font-heading font-bold text-lg">
              {user?.full_name.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>

        {/* Search shortcut */}
        <Link
          href="/mobile/products"
          className="mt-4 flex items-center gap-2 bg-white rounded-xl px-4 py-3 shadow-sm"
        >
          <span className="text-slate-400">🔍</span>
          <span className="text-slate-400 text-sm">Search products...</span>
        </Link>
      </div>

      <div className="px-4 py-4 space-y-5">
        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Active Orders', value: stats?.active_orders ?? 0, emoji: '⏳', color: 'text-amber-600' },
            { label: 'This Month', value: stats?.total_this_month ? formatINR(stats.total_this_month) : '₹0', emoji: '📈', color: 'text-teal-600' },
            { label: 'Total Orders', value: stats?.total_orders ?? 0, emoji: '✅', color: 'text-emerald-600' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 text-center">
              <span className="text-xl">{s.emoji}</span>
              <p className={`font-heading font-bold text-base mt-1 ${s.color}`}>{s.value}</p>
              <p className="text-slate-400 text-[10px] mt-0.5 leading-tight">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Quick actions */}
        <div>
          <h2 className="font-heading font-bold text-slate-900 mb-3">Quick Actions</h2>
          <div className="grid grid-cols-4 gap-2">
            {[
              { href: '/mobile/products', emoji: '🛍️', label: 'Browse', bg: 'bg-teal-50' },
              { href: '/mobile/cart', emoji: '🛒', label: 'Cart', bg: 'bg-blue-50' },
              { href: '/mobile/orders', emoji: '📦', label: 'Orders', bg: 'bg-amber-50' },
              { href: '/mobile/account', emoji: '💳', label: 'Account', bg: 'bg-purple-50' },
            ].map((a) => (
              <Link
                key={a.href}
                href={a.href}
                className={`${a.bg} rounded-2xl p-3 flex flex-col items-center gap-1`}
              >
                <span className="text-2xl">{a.emoji}</span>
                <span className="text-slate-700 text-[11px] font-semibold">{a.label}</span>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent orders */}
        {(stats?.recent_orders?.length ?? 0) > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-heading font-bold text-slate-900">Recent Orders</h2>
              <Link href="/mobile/orders" className="text-teal-600 text-sm font-semibold">View All →</Link>
            </div>
            <div className="space-y-2">
              {stats!.recent_orders.slice(0, 3).map((o) => (
                <div key={o.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 flex justify-between items-center">
                  <div>
                    <p className="font-mono font-bold text-teal-700 text-sm">{o.order_number}</p>
                    <p className="text-slate-400 text-xs mt-0.5">{o.item_count} item{o.item_count !== 1 ? 's' : ''}</p>
                  </div>
                  <div className="text-right">
                    <span className={`inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full border ${STATUS_COLORS[o.status] ?? 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                      {o.status.charAt(0).toUpperCase() + o.status.slice(1)}
                    </span>
                    <p className="font-mono font-bold text-slate-900 text-sm mt-1">{formatINR(o.total_amount)}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty onboarding */}
        {(stats?.total_orders ?? 0) === 0 && (
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-slate-100 text-center">
            <span className="text-5xl">🛒</span>
            <h3 className="font-heading font-bold text-slate-900 text-lg mt-4 mb-2">Welcome to PrimeServe!</h3>
            <p className="text-slate-500 text-sm mb-5">Browse our housekeeping catalog and place your first order.</p>
            <Link
              href="/mobile/products"
              className="inline-block bg-teal-600 text-white font-bold rounded-xl px-6 py-3 text-sm"
            >
              Browse Products →
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
