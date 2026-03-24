/**
 * Admin Dashboard Home — command-centre overview for the PrimeServe team.
 *
 * Sections:
 *   1. Welcome banner + quick actions
 *   2. Stats row 1 — Products, Orders, Pending Orders, Buyers
 *   3. Stats row 2 — Revenue This Month, Orders Today
 *   4. Pending Orders table (max 5, action buttons)
 *   5. Recent Activity feed (last 10 orders)
 *
 * Data is fetched from GET /api/admin/stats on mount.
 * All monetary values are formatted with formatINR (Indian numbering).
 */

'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Package,
  ShoppingCart,
  Clock,
  Users,
  TrendingUp,
  CalendarDays,
  Upload,
  BookUser,
  ArrowRight,
  CheckCircle2,
  Truck,
  XCircle,
  AlertCircle,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { formatINR, formatDate } from '@/lib/utils/formatting';
import type { AdminDashboardData } from '@/app/api/admin/stats/route';

// ---------------------------------------------------------------------------
// Order status display helpers
// ---------------------------------------------------------------------------

const STATUS_META: Record<
  string,
  { label: string; icon: LucideIcon; color: string }
> = {
  pending:              { label: 'New order',          icon: Clock,          color: 'text-amber-500' },
  approved:             { label: 'Order approved',     icon: CheckCircle2,   color: 'text-blue-500' },
  forwarded_to_vendor:  { label: 'Forwarded to vendor', icon: ArrowRight,    color: 'text-purple-500' },
  dispatched:           { label: 'Dispatched',         icon: Truck,          color: 'text-orange-500' },
  delivered:            { label: 'Delivered',          icon: CheckCircle2,   color: 'text-emerald-500' },
  cancelled:            { label: 'Cancelled',          icon: XCircle,        color: 'text-rose-500' },
};

function getStatusMeta(status: string) {
  return STATUS_META[status] ?? { label: status, icon: AlertCircle, color: 'text-slate-400' };
}

// ---------------------------------------------------------------------------
// Skeleton components
// ---------------------------------------------------------------------------

function StatCardSkeleton() {
  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 animate-pulse">
      <div className="flex items-center justify-between mb-4">
        <div className="h-4 bg-slate-200 rounded w-28" />
        <div className="w-9 h-9 rounded-lg bg-slate-200" />
      </div>
      <div className="h-8 bg-slate-200 rounded w-20 mt-1" />
    </div>
  );
}

function TableSkeleton() {
  return (
    <div className="animate-pulse space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4 py-3 border-b border-slate-100">
          <div className="h-4 bg-slate-200 rounded w-28" />
          <div className="h-4 bg-slate-200 rounded w-32 flex-1" />
          <div className="h-4 bg-slate-200 rounded w-16" />
          <div className="h-4 bg-slate-200 rounded w-20" />
          <div className="h-8 bg-slate-200 rounded w-20" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat card component
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  /** Amber highlight style when value demands attention */
  urgent?: boolean;
  href?: string;
}

function StatCard({ label, value, icon: Icon, iconBg, iconColor, urgent, href }: StatCardProps) {
  const card = (
    <div
      className={`bg-white rounded-xl border p-5 h-full transition-shadow ${
        urgent
          ? 'border-amber-300 bg-amber-50'
          : 'border-slate-200 hover:shadow-sm'
      } ${href ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-center justify-between mb-3">
        <p className={`text-sm font-medium ${urgent ? 'text-amber-700' : 'text-slate-500'}`}>
          {label}
        </p>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${iconBg}`}>
          <Icon className={`w-4 h-4 ${iconColor}`} aria-hidden="true" />
        </div>
      </div>
      <p className={`text-2xl font-bold font-mono ${urgent ? 'text-amber-800' : 'text-slate-900'}`}>
        {value}
      </p>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block">
        {card}
      </Link>
    );
  }
  return card;
}

// ---------------------------------------------------------------------------
// Welcome banner
// ---------------------------------------------------------------------------

function WelcomeBanner({ name }: { name: string }) {
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });

  return (
    <div className="bg-linear-to-r from-teal-600 to-teal-700 rounded-xl p-5 sm:p-6 text-white">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <p className="text-teal-100 text-sm mb-1">{today}</p>
          <h1 className="text-xl sm:text-2xl font-bold">
            Welcome back, {name.split(' ')[0]}
          </h1>
          <p className="text-teal-200 text-sm mt-1">
            Here&apos;s what&apos;s happening with Primeserve today.
          </p>
        </div>
        {/* Quick actions */}
        <div className="flex flex-wrap gap-2 shrink-0">
          <Link
            href="/admin/products/import"
            className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
          >
            <Upload className="w-3.5 h-3.5" aria-hidden="true" />
            Import Products
          </Link>
          <Link
            href="/admin/orders"
            className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
          >
            <ShoppingCart className="w-3.5 h-3.5" aria-hidden="true" />
            View Orders
          </Link>
          <Link
            href="/admin/vendors"
            className="inline-flex items-center gap-2 bg-white/20 hover:bg-white/30 text-white text-xs font-medium px-3 py-2 rounded-lg transition-colors"
          >
            <BookUser className="w-3.5 h-3.5" aria-hidden="true" />
            Add Vendor
          </Link>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page component
// ---------------------------------------------------------------------------

/**
 * Admin dashboard home page.
 * Renders a welcome banner, stat cards, pending orders table, and activity feed.
 * All data is loaded from GET /api/admin/stats on mount.
 */
export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [data, setData] = useState<AdminDashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    fetch('/api/admin/stats')
      .then((res) => res.json())
      .then((json: { data: AdminDashboardData | null; error: string | null }) => {
        if (cancelled) return;
        if (json.error || !json.data) {
          setError(json.error ?? 'Failed to load dashboard data');
        } else {
          setData(json.data);
        }
        setIsLoading(false);
      })
      .catch(() => {
        if (!cancelled) {
          setError('Could not connect to server. Please refresh.');
          setIsLoading(false);
        }
      });

    return () => { cancelled = true; };
  }, []);

  const adminName = user?.full_name ?? 'Admin';

  // ── Error state ─────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="max-w-7xl mx-auto">
        <WelcomeBanner name={adminName} />
        <div className="mt-6 flex flex-col items-center justify-center min-h-[40vh] text-center">
          <div className="w-14 h-14 bg-rose-50 rounded-2xl flex items-center justify-center mb-4">
            <AlertCircle className="w-7 h-7 text-rose-500" aria-hidden="true" />
          </div>
          <p className="text-slate-900 font-semibold mb-1">Failed to load dashboard</p>
          <p className="text-sm text-slate-500 mb-5">{error}</p>
          <button
            onClick={() => { setError(null); setIsLoading(true); location.reload(); }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors"
          >
            <RefreshCw className="w-4 h-4" aria-hidden="true" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  const stats = data?.stats;
  const pendingOrders = data?.pending_orders ?? [];
  const recentOrders = data?.recent_orders ?? [];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* ── Welcome banner ──────────────────────────────────────────────── */}
      <WelcomeBanner name={adminName} />

      {/* ── Stats row 1 — 4 cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              label="Total Products"
              value={stats?.total_products ?? 0}
              icon={Package}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
              href="/admin/products"
            />
            <StatCard
              label="Total Orders"
              value={stats?.total_orders ?? 0}
              icon={ShoppingCart}
              iconBg="bg-teal-50"
              iconColor="text-teal-600"
              href="/admin/orders"
            />
            <StatCard
              label="Pending Orders"
              value={stats?.pending_orders ?? 0}
              icon={Clock}
              iconBg={
                (stats?.pending_orders ?? 0) > 0
                  ? 'bg-amber-100'
                  : 'bg-slate-100'
              }
              iconColor={
                (stats?.pending_orders ?? 0) > 0
                  ? 'text-amber-600'
                  : 'text-slate-500'
              }
              urgent={(stats?.pending_orders ?? 0) > 0}
              href="/admin/orders"
            />
            <StatCard
              label="Registered Buyers"
              value={stats?.total_buyers ?? 0}
              icon={Users}
              iconBg="bg-violet-50"
              iconColor="text-violet-600"
              href="/admin/buyers"
            />
          </>
        )}
      </div>

      {/* ── Stats row 2 — 2 cards ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {isLoading ? (
          <>
            <StatCardSkeleton />
            <StatCardSkeleton />
          </>
        ) : (
          <>
            <StatCard
              label="Revenue This Month"
              value={
                (stats?.revenue_this_month ?? 0) > 0
                  ? formatINR(stats!.revenue_this_month)
                  : '₹0.00'
              }
              icon={TrendingUp}
              iconBg="bg-emerald-50"
              iconColor="text-emerald-600"
            />
            <StatCard
              label="Orders Today"
              value={stats?.orders_today ?? 0}
              icon={CalendarDays}
              iconBg="bg-teal-50"
              iconColor="text-teal-600"
            />
          </>
        )}
      </div>

      {/* ── Pending orders section ──────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <h2 className="font-semibold text-slate-900 text-sm">
              Orders Requiring Action
            </h2>
            {!isLoading && (stats?.pending_orders ?? 0) > 0 && (
              <span className="inline-flex items-center justify-center w-5 h-5 bg-amber-500 text-white text-xs font-bold rounded-full">
                {stats!.pending_orders > 9 ? '9+' : stats!.pending_orders}
              </span>
            )}
          </div>
          <Link
            href="/admin/orders"
            className="text-xs text-teal-600 hover:text-teal-700 font-medium inline-flex items-center gap-1"
          >
            View all
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div className="px-5 py-4">
          {isLoading ? (
            <TableSkeleton />
          ) : pendingOrders.length === 0 ? (
            /* Empty state */
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center mb-3">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" aria-hidden="true" />
              </div>
              <p className="font-medium text-slate-900 text-sm">All caught up!</p>
              <p className="text-xs text-slate-500 mt-1">No pending orders right now.</p>
            </div>
          ) : (
            /* Table */
            <div className="overflow-x-auto -mx-5 px-5">
              <table className="w-full min-w-150 text-sm">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide py-2 pr-4">
                      Order #
                    </th>
                    <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide py-2 pr-4">
                      Buyer
                    </th>
                    <th className="text-right text-xs font-medium text-slate-400 uppercase tracking-wide py-2 pr-4">
                      Items
                    </th>
                    <th className="text-right text-xs font-medium text-slate-400 uppercase tracking-wide py-2 pr-4">
                      Total
                    </th>
                    <th className="text-left text-xs font-medium text-slate-400 uppercase tracking-wide py-2 pr-4">
                      Placed
                    </th>
                    <th className="text-right text-xs font-medium text-slate-400 uppercase tracking-wide py-2">
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pendingOrders.map((order) => (
                    <tr
                      key={order.id}
                      className="border-b border-slate-50 hover:bg-slate-50 transition-colors"
                    >
                      <td className="py-3 pr-4">
                        <span className="font-mono text-xs font-semibold text-slate-700">
                          {order.order_number}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-medium text-slate-900 leading-tight">
                          {order.buyer_name}
                        </p>
                        {order.buyer_company && (
                          <p className="text-xs text-slate-400 mt-0.5">
                            {order.buyer_company}
                          </p>
                        )}
                      </td>
                      <td className="py-3 pr-4 text-right text-slate-600">
                        {order.items_count}
                      </td>
                      <td className="py-3 pr-4 text-right font-mono text-slate-900 font-semibold">
                        {formatINR(order.total_amount)}
                      </td>
                      <td className="py-3 pr-4 text-slate-500 text-xs whitespace-nowrap">
                        {formatDate(order.created_at)}
                      </td>
                      <td className="py-3 text-right">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium rounded-lg transition-colors"
                        >
                          Review
                          <ArrowRight className="w-3 h-3" aria-hidden="true" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {/* ── Recent activity feed ────────────────────────────────────────── */}
      <section className="bg-white rounded-xl border border-slate-200">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <h2 className="font-semibold text-slate-900 text-sm">Recent Activity</h2>
          <Link
            href="/admin/orders"
            className="text-xs text-teal-600 hover:text-teal-700 font-medium inline-flex items-center gap-1"
          >
            All orders
            <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
          </Link>
        </div>

        <div className="divide-y divide-slate-50">
          {isLoading ? (
            <div className="px-5 py-4 animate-pulse space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-slate-200 shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-3.5 bg-slate-200 rounded w-3/4" />
                    <div className="h-3 bg-slate-200 rounded w-1/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <p className="text-sm text-slate-500">No orders yet.</p>
              <Link
                href="/admin/products/import"
                className="mt-3 text-sm text-teal-600 hover:underline font-medium"
              >
                Import your product catalog to get started
              </Link>
            </div>
          ) : (
            recentOrders.map((order) => {
              const meta = getStatusMeta(order.status);
              const StatusIcon = meta.icon;
              const displayName = order.buyer_company ?? order.buyer_name;

              return (
                <div
                  key={order.id}
                  className="flex items-start gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                    <StatusIcon
                      className={`w-4 h-4 ${meta.color}`}
                      aria-hidden="true"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-slate-800 leading-snug">
                      <span className="font-medium">{meta.label}</span>{' '}
                      <span className="font-mono text-xs text-slate-600">
                        {order.order_number}
                      </span>{' '}
                      {order.status === 'delivered'
                        ? `delivered to ${displayName}`
                        : `from ${displayName}`}{' '}
                      —{' '}
                      <span className="font-semibold font-mono">
                        {formatINR(order.total_amount)}
                      </span>
                    </p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatDate(order.created_at)}
                    </p>
                  </div>
                  <Link
                    href={`/admin/orders/${order.id}`}
                    className="text-xs text-teal-600 hover:text-teal-700 font-medium shrink-0 mt-0.5"
                    aria-label={`View order ${order.order_number}`}
                  >
                    View
                  </Link>
                </div>
              );
            })
          )}
        </div>
      </section>

      {/* Bottom spacing */}
      <div className="h-4" />
    </div>
  );
}
