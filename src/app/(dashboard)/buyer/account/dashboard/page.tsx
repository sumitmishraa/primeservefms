'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp, CreditCard, AlertTriangle, Clock, CheckCircle2,
  Package, FileText, Building2, ShoppingBag, Loader2, ArrowRight,
  CalendarDays, ChevronDown,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatINR, formatDate } from '@/lib/utils/formatting';
import type { DashboardData } from '@/app/api/buyer/dashboard/route';

type Period = 'this_month' | 'last_3_months' | 'this_fy' | 'custom';

const PERIOD_LABELS: Record<Period, string> = {
  this_month: 'This Month',
  last_3_months: 'Last 3 Months',
  this_fy: 'This FY',
  custom: 'Custom',
};

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

const inputCls = 'px-3 py-1.5 text-sm border border-white/20 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-400 bg-white/10 text-white placeholder:text-slate-400 backdrop-blur-sm';

export default function BuyerAccountDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showCustom, setShowCustom] = useState(false);

  const load = useCallback(async (p: Period, cs?: string, ce?: string) => {
    setLoading(true);
    try {
      let url = `/api/buyer/dashboard?period=${p}`;
      if (p === 'custom' && cs && ce) url += `&start=${cs}&end=${ce}`;
      const res = await fetch(url);
      const json = await res.json() as { data: DashboardData | null; error: string | null };
      if (!res.ok || json.error) throw new Error(json.error ?? 'Failed');
      setData(json.data);
    } catch {
      toast.error('Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(period); }, [load, period]);

  function handlePeriodChange(p: Period) {
    setPeriod(p);
    setShowCustom(p === 'custom');
    if (p !== 'custom') load(p);
  }

  function applyCustomRange() {
    if (!customStart || !customEnd) { toast.error('Select start and end date'); return; }
    load('custom', customStart, customEnd);
  }

  const trendMax = Math.max(...(data?.spend_trend?.map((p) => p.amount) ?? [1]), 1);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 space-y-6">

      {/* ── Dark Hero: Header + Period + KPIs ─────────────────────────── */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-slate-900 via-slate-800 to-teal-950 shadow-2xl">
        {/* Decorative glow orbs */}
        <div className="pointer-events-none absolute -right-24 -top-24 w-72 h-72 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-16 -bottom-16 w-56 h-56 rounded-full bg-teal-700/15 blur-2xl" />
        <div className="pointer-events-none absolute right-1/3 top-1/2 w-40 h-40 rounded-full bg-indigo-500/10 blur-2xl" />

        <div className="relative z-10 p-6 space-y-6">
          {/* Header */}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard</h1>
              <p className="text-sm text-slate-400 mt-0.5">
                {data?.client_name && data?.branch_name
                  ? `${data.client_name} — ${data.branch_name}`
                  : 'Your account overview'}
              </p>
            </div>

            {/* Period selector */}
            <div className="flex flex-wrap items-center gap-2">
              {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => handlePeriodChange(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                    period === p
                      ? 'bg-teal-500 text-white shadow-lg shadow-teal-500/30'
                      : 'bg-white/10 border border-white/15 text-slate-300 hover:bg-white/20 backdrop-blur-sm'
                  }`}
                >
                  {p === 'custom' && <CalendarDays className="w-3 h-3 inline mr-1" />}
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
          </div>

          {/* Custom date range */}
          {showCustom && (
            <div className="flex flex-wrap items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl backdrop-blur-sm">
              <div className="flex items-center gap-2 text-sm text-slate-300">
                <CalendarDays className="w-4 h-4 text-slate-400" />
                <span className="font-medium">Custom range</span>
              </div>
              <input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} className={inputCls} />
              <span className="text-slate-500 text-sm">to</span>
              <input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} className={inputCls} />
              <button
                onClick={applyCustomRange}
                className="px-4 py-1.5 bg-teal-500 text-white text-sm font-semibold rounded-lg hover:bg-teal-400 transition-colors shadow-md shadow-teal-500/30"
              >
                Apply
              </button>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-14">
              <Loader2 className="w-8 h-8 animate-spin text-teal-400" />
            </div>
          ) : !data ? null : (
            <>
              {/* ── KPI Grid ── */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  {
                    label: 'Period Spend',
                    value: formatINR(data.monthly_spend),
                    icon: TrendingUp,
                    accent: 'border-teal-500/40',
                    numColor: 'text-teal-300',
                    sub: PERIOD_LABELS[period],
                  },
                  {
                    label: 'Outstanding',
                    value: formatINR(data.outstanding_credit),
                    icon: CreditCard,
                    accent: 'border-white/10',
                    numColor: 'text-white',
                    sub: 'Pending payment',
                  },
                  {
                    label: 'Due Soon',
                    value: formatINR(data.due_soon),
                    icon: Clock,
                    accent: 'border-amber-500/40',
                    numColor: 'text-amber-300',
                    sub: 'Within 7 days',
                  },
                  {
                    label: 'Overdue',
                    value: formatINR(data.overdue),
                    icon: AlertTriangle,
                    accent: 'border-rose-500/40',
                    numColor: data.overdue > 0 ? 'text-rose-300' : 'text-white',
                    sub: 'Past 45-day term',
                  },
                  {
                    label: 'Active Orders',
                    value: String(data.active_orders),
                    icon: Package,
                    accent: 'border-blue-500/30',
                    numColor: 'text-blue-300',
                    sub: 'In progress',
                  },
                  {
                    label: 'Delivered',
                    value: String(data.delivered_orders),
                    icon: CheckCircle2,
                    accent: 'border-emerald-500/30',
                    numColor: 'text-emerald-300',
                    sub: 'All time',
                  },
                  {
                    label: 'Quote Requests',
                    value: String(data.quote_requests),
                    icon: FileText,
                    accent: 'border-purple-500/30',
                    numColor: 'text-purple-300',
                    sub: 'All time',
                  },
                ].map(({ label, value, icon: Icon, accent, numColor, sub }) => (
                  <div
                    key={label}
                    className={`bg-white/8 backdrop-blur-sm border ${accent} rounded-xl p-4 hover:bg-white/12 transition-colors`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-medium text-slate-400">{label}</p>
                      <Icon className={`w-3.5 h-3.5 ${numColor} opacity-70`} />
                    </div>
                    <p className={`text-xl font-bold tracking-tight ${numColor}`}>{value}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
                  </div>
                ))}
              </div>

              {/* Overdue alert banner */}
              {data.overdue > 0 && (
                <div className="flex items-start gap-3 px-4 py-3 bg-rose-500/15 border border-rose-500/30 rounded-xl backdrop-blur-sm">
                  <AlertTriangle className="w-4 h-4 text-rose-300 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-rose-200">
                      {formatINR(data.overdue)} in overdue payments
                    </p>
                    <p className="text-xs text-rose-400 mt-0.5">
                      Settle your 45-day credit invoices to avoid account suspension.
                    </p>
                  </div>
                  <a href="mailto:credit@primeserve.in" className="ml-auto text-xs font-semibold text-rose-300 hover:text-rose-200 shrink-0">
                    Contact →
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Below hero — only shown when data loaded */}
      {!loading && data && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ── Spend Trend ── */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-slate-800 mb-4">Spend Trend — Last 6 Months</h2>
              <div className="flex items-end gap-2 h-40">
                {data.spend_trend.map((pt) => {
                  const pct = trendMax > 0 ? Math.max(4, Math.round((pt.amount / trendMax) * 100)) : 4;
                  return (
                    <div key={pt.month} className="flex-1 flex flex-col items-center gap-1 group">
                      <span className="text-[10px] text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity font-semibold">
                        {formatINR(pt.amount)}
                      </span>
                      <div
                        className="w-full rounded-t-md bg-linear-to-t from-teal-600 to-teal-400 transition-all shadow-sm"
                        style={{ height: `${pct}%` }}
                        title={formatINR(pt.amount)}
                      />
                      <span className="text-[10px] text-slate-500 font-medium">{pt.month}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* ── Order Breakdown ── */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-slate-800 mb-4">Order Breakdown</h2>
              {Object.keys(data.status_breakdown).length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-8">No orders in this period</p>
              ) : (
                <div className="space-y-2.5">
                  {Object.entries(data.status_breakdown)
                    .sort((a, b) => b[1] - a[1])
                    .map(([status, count]) => {
                      const total = Object.values(data.status_breakdown).reduce((s, n) => s + n, 0);
                      const pct = Math.round((count / total) * 100);
                      return (
                        <div key={status}>
                          <div className="flex justify-between text-xs mb-1">
                            <span className={`px-1.5 py-0.5 rounded font-medium ${STATUS_STYLES[status] ?? 'bg-slate-50 text-slate-600'}`}>
                              {STATUS_LABELS[status] ?? status}
                            </span>
                            <span className="text-slate-500 font-semibold">{count} ({pct}%)</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-1.5">
                            <div
                              className="h-1.5 rounded-full bg-teal-500 transition-all"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          </div>

          {/* ── Recent Orders ── */}
          {data.recent_orders.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-800">Recent Orders</h2>
                <Link href="/buyer/orders" className="text-xs text-teal-600 hover:underline font-semibold flex items-center gap-1">
                  View all <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="divide-y divide-slate-100">
                {data.recent_orders.map((o) => (
                  <Link
                    key={o.id}
                    href={`/buyer/orders/${o.id}`}
                    className="flex items-center justify-between gap-4 px-5 py-3.5 hover:bg-slate-50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-bold text-teal-700">{o.order_number}</p>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {formatDate(o.created_at)} · {o.item_count} item{o.item_count !== 1 ? 's' : ''}
                        {o.payment_method === 'credit_45day' && (
                          <span className="ml-1.5 text-purple-600 font-semibold">· Credit</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2.5 shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[o.status] ?? 'bg-slate-50 text-slate-600'}`}>
                        {STATUS_LABELS[o.status] ?? o.status}
                      </span>
                      <p className="text-sm font-bold text-slate-900">{formatINR(o.total_amount)}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* ── Outstanding Credit Table ── */}
          {data.credit_rows.length > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-800">Outstanding Credit</h2>
                <Link href="/buyer/account/credit" className="text-xs text-teal-600 hover:underline font-semibold flex items-center gap-1">
                  Credit overview <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs text-slate-500 font-semibold">
                      <th className="px-5 py-2.5 text-left">Order</th>
                      <th className="px-5 py-2.5 text-right">Amount</th>
                      <th className="px-5 py-2.5 text-left hidden sm:table-cell">Delivered</th>
                      <th className="px-5 py-2.5 text-left">Due Date</th>
                      <th className="px-5 py-2.5 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {data.credit_rows.map((row) => (
                      <tr key={row.order_id} className="hover:bg-slate-50">
                        <td className="px-5 py-3 font-bold text-teal-700">
                          <Link href={`/buyer/orders/${row.order_id}`} className="hover:underline">
                            {row.order_number}
                          </Link>
                        </td>
                        <td className="px-5 py-3 text-right font-bold text-slate-900">
                          {formatINR(row.total_amount)}
                        </td>
                        <td className="px-5 py-3 text-slate-500 text-xs hidden sm:table-cell">
                          {row.delivered_at ? formatDate(row.delivered_at) : '—'}
                        </td>
                        <td className="px-5 py-3 text-slate-600 text-xs font-semibold">
                          {row.due_date
                            ? new Date(row.due_date).toLocaleDateString('en-IN')
                            : 'Pending delivery'}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold border ${
                            row.bucket === 'overdue'
                              ? 'bg-rose-50 text-rose-700 border-rose-200'
                              : row.bucket === 'due_soon'
                                ? 'bg-amber-50 text-amber-700 border-amber-200'
                                : 'bg-slate-50 text-slate-600 border-slate-200'
                          }`}>
                            {row.bucket === 'overdue'
                              ? `Overdue ${row.days_overdue}d`
                              : row.bucket === 'due_soon'
                                ? 'Due Soon'
                                : 'Upcoming'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ── Quick Links + Account Card ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-sm font-semibold text-slate-800 mb-3">Quick Actions</h2>
              <div className="space-y-1">
                {[
                  { label: 'Browse Marketplace', href: '/marketplace', icon: ShoppingBag, color: 'text-teal-600' },
                  { label: 'Request a Quote', href: '/buyer/account/quotes', icon: FileText, color: 'text-purple-600' },
                  { label: 'Company Details', href: '/buyer/account/company', icon: Building2, color: 'text-slate-600' },
                  { label: 'View All Orders', href: '/buyer/orders', icon: Package, color: 'text-blue-600' },
                ].map(({ label, href, icon: Icon, color }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-slate-50 transition-colors group"
                  >
                    <Icon className={`w-4 h-4 ${color} shrink-0`} />
                    <span className="text-sm text-slate-700 group-hover:text-slate-900 font-medium">{label}</span>
                    <ArrowRight className="w-3 h-3 text-slate-300 ml-auto group-hover:text-teal-500 transition-colors" />
                  </Link>
                ))}
              </div>
            </div>

            {/* Account context card — glass on dark */}
            <div className="relative overflow-hidden rounded-xl bg-linear-to-br from-teal-700 via-teal-800 to-slate-900 p-5 text-white shadow-xl">
              <div className="pointer-events-none absolute -right-8 -top-8 w-36 h-36 rounded-full bg-teal-400/20 blur-2xl" />
              <div className="pointer-events-none absolute -left-4 -bottom-6 w-24 h-24 rounded-full bg-white/5 blur-xl" />
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <Building2 className="w-4 h-4 text-teal-300" />
                  <p className="text-xs font-semibold text-teal-300 uppercase tracking-wider">Your Account</p>
                </div>
                {data.client_name ? (
                  <>
                    <p className="text-lg font-bold text-white tracking-tight">{data.client_name}</p>
                    {data.branch_name && (
                      <p className="text-sm text-teal-200/70 mt-0.5">{data.branch_name}</p>
                    )}
                  </>
                ) : (
                  <p className="text-slate-300 text-sm">No branch assigned yet.</p>
                )}
                <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 gap-3">
                  <div>
                    <p className="text-xs text-slate-400">Active Orders</p>
                    <p className="text-2xl font-bold text-white tracking-tight">{data.active_orders}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Total Delivered</p>
                    <p className="text-2xl font-bold text-white tracking-tight">{data.delivered_orders}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
