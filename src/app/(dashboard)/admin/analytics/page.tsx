/**
 * Admin Analytics Page
 *
 * Displays real-time analytics from GET /api/admin/analytics.
 * Includes:
 *   - Date range + client filter bar
 *   - Overview stat cards (revenue, orders, avg order, active buyers)
 *   - Orders by status (horizontal bar chart via Tailwind divs)
 *   - Top 10 products table
 *   - Top 10 clients table
 *   - Category breakdown cards
 *   - Monthly trend bar chart (Tailwind divs)
 */

'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  TrendingUp,
  ShoppingCart,
  Users,
  Package,
  AlertCircle,
  RefreshCw,
  BarChart3,
  Download,
} from 'lucide-react';
import { formatINR } from '@/lib/utils/formatting';
import type { AnalyticsData } from '@/app/api/admin/analytics/route';

// ---------------------------------------------------------------------------
// Date range helpers
// ---------------------------------------------------------------------------

type DateRangeKey = 'this_month' | 'last_month' | 'last_3_months' | 'last_6_months' | 'this_year' | 'all_time';

const DATE_RANGE_OPTIONS: { key: DateRangeKey; label: string }[] = [
  { key: 'this_month',    label: 'This Month' },
  { key: 'last_month',    label: 'Last Month' },
  { key: 'last_3_months', label: 'Last 3 Months' },
  { key: 'last_6_months', label: 'Last 6 Months' },
  { key: 'this_year',     label: 'This Year' },
  { key: 'all_time',      label: 'All Time' },
];

/**
 * Returns ISO date_from and date_to strings for a given range key.
 */
function resolveDateRange(key: DateRangeKey): { date_from: string | null; date_to: string | null } {
  const now  = new Date();
  const y    = now.getUTCFullYear();
  const m    = now.getUTCMonth();

  switch (key) {
    case 'this_month':
      return {
        date_from: new Date(Date.UTC(y, m, 1)).toISOString(),
        date_to:   now.toISOString(),
      };
    case 'last_month': {
      const from = new Date(Date.UTC(y, m - 1, 1));
      const to   = new Date(Date.UTC(y, m, 0, 23, 59, 59));
      return { date_from: from.toISOString(), date_to: to.toISOString() };
    }
    case 'last_3_months':
      return {
        date_from: new Date(Date.UTC(y, m - 3, 1)).toISOString(),
        date_to:   now.toISOString(),
      };
    case 'last_6_months':
      return {
        date_from: new Date(Date.UTC(y, m - 6, 1)).toISOString(),
        date_to:   now.toISOString(),
      };
    case 'this_year':
      return {
        date_from: new Date(Date.UTC(y, 0, 1)).toISOString(),
        date_to:   now.toISOString(),
      };
    case 'all_time':
    default:
      return { date_from: null, date_to: null };
  }
}

// ---------------------------------------------------------------------------
// Status display config
// ---------------------------------------------------------------------------

const STATUS_COLORS: Record<string, string> = {
  pending:             'bg-amber-400',
  approved:            'bg-blue-400',
  forwarded_to_vendor: 'bg-purple-400',
  dispatched:          'bg-orange-400',
  delivered:           'bg-emerald-500',
  cancelled:           'bg-rose-400',
};

const STATUS_LABELS: Record<string, string> = {
  pending:             'Pending',
  approved:            'Approved',
  forwarded_to_vendor: 'Forwarded',
  dispatched:          'Dispatched',
  delivered:           'Delivered',
  cancelled:           'Cancelled',
};

// ---------------------------------------------------------------------------
// Skeleton components
// ---------------------------------------------------------------------------

function CardSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3 h-3.5 w-28 rounded bg-slate-200" />
      <div className="h-8 w-24 rounded bg-slate-200" />
    </div>
  );
}

function SectionSkeleton() {
  return (
    <div className="animate-pulse rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-4 h-5 w-40 rounded bg-slate-200" />
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="flex gap-3">
            <div className="h-4 w-full rounded bg-slate-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Overview stat card
// ---------------------------------------------------------------------------

interface StatCardProps {
  label: string;
  value: string;
  icon: React.ElementType;
  iconBg: string;
  iconColor: string;
}

function StatCard({ label, value, icon: Icon, iconBg, iconColor }: StatCardProps) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm font-medium text-slate-500">{label}</p>
        <div className={`flex h-9 w-9 items-center justify-center rounded-lg ${iconBg}`}>
          <Icon className={`h-4 w-4 ${iconColor}`} aria-hidden="true" />
        </div>
      </div>
      <p className="font-mono text-2xl font-bold text-slate-900">{value}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Monthly bar chart
// ---------------------------------------------------------------------------

function MonthlyChart({ data }: { data: AnalyticsData['monthly_orders'] }) {
  const maxOrders = Math.max(...data.map((d) => d.orders), 1);
  const months    = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  return (
    <div className="flex items-end gap-2 h-40 pt-4">
      {data.map((d) => {
        const monthIndex = parseInt(d.month.split('-')[1], 10) - 1;
        const label      = months[monthIndex] ?? d.month;
        const pct        = (d.orders / maxOrders) * 100;
        return (
          <div key={d.month} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-xs font-mono text-slate-500">{d.orders}</span>
            <div className="w-full rounded-t-sm bg-teal-500 transition-all" style={{ height: `${Math.max(pct, 2)}%` }} />
            <span className="text-xs text-slate-400">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status bar chart
// ---------------------------------------------------------------------------

function StatusBarChart({ data }: { data: AnalyticsData['orders_by_status'] }) {
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="space-y-3">
      {data.map((row) => {
        const pct   = (row.count / maxCount) * 100;
        const color = STATUS_COLORS[row.status] ?? 'bg-slate-400';
        const label = STATUS_LABELS[row.status] ?? row.status;
        return (
          <div key={row.status} className="flex items-center gap-3">
            <span className="w-24 shrink-0 text-sm text-slate-600 capitalize">{label}</span>
            <div className="flex-1">
              <div
                className={`h-6 rounded-sm ${color} flex items-center px-2 transition-all`}
                style={{ width: `${Math.max(pct, 3)}%`, minWidth: '2rem' }}
              >
                <span className="text-xs font-semibold text-white">{row.count}</span>
              </div>
            </div>
            <span className="w-28 shrink-0 text-right text-xs text-slate-500 font-mono">
              {formatINR(row.amount)}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

/**
 * Admin analytics dashboard. All data is real-time from /api/admin/analytics.
 */
export default function AdminAnalyticsPage() {
  const [data,        setData]       = useState<AnalyticsData | null>(null);
  const [isLoading,   setIsLoading]  = useState(true);
  const [error,       setError]      = useState<string | null>(null);
  const [dateRange,   setDateRange]  = useState<DateRangeKey>('this_month');

  // ---------------------------------------------------------------------------
  // Data fetching
  // ---------------------------------------------------------------------------

  const fetchAnalytics = useCallback(async (range: DateRangeKey) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      const { date_from, date_to } = resolveDateRange(range);
      if (date_from) params.set('date_from', date_from);
      if (date_to)   params.set('date_to',   date_to);

      const res  = await fetch(`/api/admin/analytics?${params.toString()}`);
      const json = (await res.json()) as { data: AnalyticsData | null; error: string | null };

      if (!res.ok || json.error || !json.data) {
        setError(json.error ?? 'Failed to load analytics');
        return;
      }
      setData(json.data);
    } catch {
      setError('Could not connect to server. Please refresh.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void fetchAnalytics(dateRange); }, [dateRange, fetchAnalytics]);

  // ---------------------------------------------------------------------------
  // Export handler (stub — Phase 4)
  // ---------------------------------------------------------------------------

  const handleExport = () => {
    // TODO: implement CSV export in Phase 4
    alert('Export coming soon! This will download a CSV of all analytics data.');
  };

  // ---------------------------------------------------------------------------
  // Error state
  // ---------------------------------------------------------------------------

  if (error && !data) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-rose-50">
          <AlertCircle className="h-7 w-7 text-rose-500" aria-hidden="true" />
        </div>
        <p className="font-semibold text-slate-900">Failed to load analytics</p>
        <p className="text-sm text-slate-500">{error}</p>
        <button
          onClick={() => void fetchAnalytics(dateRange)}
          className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
        >
          <RefreshCw className="h-4 w-4" aria-hidden="true" /> Retry
        </button>
      </div>
    );
  }

  const hasData = (data?.overview.total_orders ?? 0) > 0;

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* ── Page header ───────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100">
            <BarChart3 className="h-5 w-5 text-teal-700" aria-hidden="true" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-900">Analytics</h1>
            <p className="text-xs text-slate-500">Real-time performance overview</p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleExport}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          Export CSV
        </button>
      </div>

      {/* ── Date range filter bar ─────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-2">
        {DATE_RANGE_OPTIONS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => setDateRange(key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              dateRange === key
                ? 'bg-teal-600 text-white'
                : 'border border-slate-300 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Overview stat cards ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {isLoading ? (
          <><CardSkeleton /><CardSkeleton /><CardSkeleton /><CardSkeleton /></>
        ) : (
          <>
            <StatCard
              label="Total Revenue"
              value={formatINR(data?.overview.total_revenue ?? 0)}
              icon={TrendingUp}
              iconBg="bg-emerald-50"
              iconColor="text-emerald-600"
            />
            <StatCard
              label="Total Orders"
              value={String(data?.overview.total_orders ?? 0)}
              icon={ShoppingCart}
              iconBg="bg-teal-50"
              iconColor="text-teal-600"
            />
            <StatCard
              label="Avg Order Value"
              value={formatINR(data?.overview.average_order_value ?? 0)}
              icon={BarChart3}
              iconBg="bg-blue-50"
              iconColor="text-blue-600"
            />
            <StatCard
              label="Active Buyers"
              value={String(data?.overview.active_buyers ?? 0)}
              icon={Users}
              iconBg="bg-violet-50"
              iconColor="text-violet-600"
            />
          </>
        )}
      </div>

      {/* ── No data empty state ───────────────────────────────────────────── */}
      {!isLoading && !hasData && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-slate-200 bg-white py-20 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100">
            <BarChart3 className="h-8 w-8 text-slate-400" aria-hidden="true" />
          </div>
          <div>
            <p className="font-semibold text-slate-800">No analytics data yet</p>
            <p className="mt-1 text-sm text-slate-500">
              Analytics will populate as orders come in.
            </p>
          </div>
        </div>
      )}

      {/* ── Orders by status ─────────────────────────────────────────────── */}
      {(isLoading || hasData) && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Orders by Status</h2>
          {isLoading ? (
            <SectionSkeleton />
          ) : (data?.orders_by_status.length ?? 0) === 0 ? (
            <p className="text-sm text-slate-400">No orders yet.</p>
          ) : (
            <StatusBarChart data={data!.orders_by_status} />
          )}
        </section>
      )}

      {/* ── Monthly trend ─────────────────────────────────────────────────── */}
      {(isLoading || hasData) && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-2 font-semibold text-slate-900">Monthly Trend</h2>
          <p className="mb-4 text-xs text-slate-500">Orders placed per month (last 6 months)</p>
          {isLoading ? (
            <div className="h-40 animate-pulse rounded-lg bg-slate-100" />
          ) : (
            <MonthlyChart data={data?.monthly_orders ?? []} />
          )}
        </section>
      )}

      {/* ── Two-column: Top Products + Category Breakdown ─────────────────── */}
      <div className="grid gap-6 lg:grid-cols-2">

        {/* Top 10 Products */}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Top Products</h2>
            <span className="text-xs text-slate-400">by order count</span>
          </div>
          {isLoading ? (
            <SectionSkeleton />
          ) : (data?.top_products.length ?? 0) === 0 ? (
            <p className="text-sm text-slate-400">No product orders yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left">
                    <th className="pb-2 pr-3 text-xs font-medium text-slate-400">#</th>
                    <th className="pb-2 pr-3 text-xs font-medium text-slate-400">Product</th>
                    <th className="pb-2 pr-3 text-right text-xs font-medium text-slate-400">Orders</th>
                    <th className="pb-2 text-right text-xs font-medium text-slate-400">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data!.top_products.map((p, i) => (
                    <tr key={p.name} className="hover:bg-slate-50">
                      <td className="py-2.5 pr-3 text-slate-400 text-xs">{i + 1}</td>
                      <td className="py-2.5 pr-3">
                        <p className="font-medium text-slate-800 leading-snug line-clamp-1">{p.name}</p>
                        <p className="text-xs text-slate-400">{p.category}</p>
                      </td>
                      <td className="py-2.5 pr-3 text-right font-mono text-slate-700">{p.order_count}</td>
                      <td className="py-2.5 text-right font-mono text-sm font-semibold text-teal-700">
                        {formatINR(p.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Category Breakdown */}
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-900">Category Breakdown</h2>
            <span className="text-xs text-slate-400">by order volume</span>
          </div>
          {isLoading ? (
            <SectionSkeleton />
          ) : (data?.category_breakdown.length ?? 0) === 0 ? (
            <p className="text-sm text-slate-400">No order data yet.</p>
          ) : (
            <div className="space-y-4">
              {data!.category_breakdown.map((cat) => (
                <div key={cat.category}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-medium text-slate-700">{cat.category}</span>
                    <span className="text-xs text-slate-400">{cat.percentage}%</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-2 rounded-full bg-teal-500 transition-all"
                      style={{ width: `${cat.percentage}%` }}
                    />
                  </div>
                  <div className="mt-1 flex items-center justify-between">
                    <span className="text-xs text-slate-400">{cat.orders} orders</span>
                    <span className="text-xs font-mono text-slate-600">{formatINR(cat.revenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── Top Clients ───────────────────────────────────────────────────── */}
      {(isLoading || (data?.top_clients.length ?? 0) > 0) && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Top Clients</h2>
          {isLoading ? (
            <SectionSkeleton />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left">
                    <th className="pb-2 pr-4 text-xs font-medium text-slate-400">#</th>
                    <th className="pb-2 pr-4 text-xs font-medium text-slate-400">Client</th>
                    <th className="pb-2 pr-4 text-right text-xs font-medium text-slate-400">Orders</th>
                    <th className="pb-2 pr-4 text-right text-xs font-medium text-slate-400">Revenue</th>
                    <th className="pb-2 text-right text-xs font-medium text-slate-400">Pending</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data!.top_clients.map((c, i) => (
                    <tr key={c.name} className="hover:bg-slate-50">
                      <td className="py-2.5 pr-4 text-xs text-slate-400">{i + 1}</td>
                      <td className="py-2.5 pr-4 font-medium text-slate-800">{c.name}</td>
                      <td className="py-2.5 pr-4 text-right font-mono text-slate-700">{c.total_orders}</td>
                      <td className="py-2.5 pr-4 text-right font-mono font-semibold text-teal-700">
                        {formatINR(c.total_revenue)}
                      </td>
                      <td className="py-2.5 text-right font-mono text-amber-600">
                        {formatINR(c.pending)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── Top Buyers ────────────────────────────────────────────────────── */}
      {(isLoading || (data?.top_buyers.length ?? 0) > 0) && (
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 font-semibold text-slate-900">Top Buyers</h2>
          {isLoading ? (
            <SectionSkeleton />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left">
                    <th className="pb-2 pr-4 text-xs font-medium text-slate-400">#</th>
                    <th className="pb-2 pr-4 text-xs font-medium text-slate-400">Buyer</th>
                    <th className="pb-2 pr-4 text-right text-xs font-medium text-slate-400">Orders</th>
                    <th className="pb-2 text-right text-xs font-medium text-slate-400">Total Spent</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {data!.top_buyers.map((b, i) => (
                    <tr key={b.name} className="hover:bg-slate-50">
                      <td className="py-2.5 pr-4 text-xs text-slate-400">{i + 1}</td>
                      <td className="py-2.5 pr-4">
                        <p className="font-medium text-slate-800">{b.name}</p>
                        {b.company && <p className="text-xs text-slate-400">{b.company}</p>}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono text-slate-700">{b.orders}</td>
                      <td className="py-2.5 text-right font-mono font-semibold text-teal-700">
                        {formatINR(b.spent)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── Pending payments indicator ──────────────────────────────────── */}
      {!isLoading && (data?.overview.pending_payments ?? 0) > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-5 py-4">
          <Package className="h-5 w-5 text-amber-600 shrink-0" aria-hidden="true" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              Pending Revenue: {formatINR(data!.overview.pending_payments)}
            </p>
            <p className="text-xs text-amber-600">
              Orders that are active but not yet delivered
            </p>
          </div>
        </div>
      )}

      <div className="h-4" />
    </div>
  );
}
