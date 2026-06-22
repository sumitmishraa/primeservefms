'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp, TrendingDown, CreditCard, AlertTriangle, Clock,
  CheckCircle2, Package, FileText, Plus, ChevronRight, Loader2,
  Download, LayoutDashboard, ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatINR, formatDate } from '@/lib/utils/formatting';
import type { DashboardData } from '@/app/api/buyer/dashboard/route';

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = 'this_month' | 'last_3_months' | 'this_fy' | 'custom';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', approved: 'Approved', forwarded_to_vendor: 'Processing',
  dispatched: 'Dispatched', delivered: 'Delivered', cancelled: 'Cancelled',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-50 text-amber-700 border border-amber-200',
  approved: 'bg-blue-50 text-blue-700 border border-blue-200',
  forwarded_to_vendor: 'bg-purple-50 text-purple-700 border border-purple-200',
  dispatched: 'bg-orange-50 text-orange-700 border border-orange-200',
  delivered: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
  cancelled: 'bg-rose-50 text-rose-700 border border-rose-200',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, subColor = 'text-slate-500', borderColor = 'border-slate-200',
  icon: Icon, iconColor = 'text-slate-400',
}: {
  label: string; value: string; sub?: string; subColor?: string;
  borderColor?: string; icon: React.ElementType; iconColor?: string;
}) {
  return (
    <div className={`bg-white rounded-xl border ${borderColor} shadow-sm p-5 flex flex-col gap-3`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
        <Icon className={`w-4 h-4 ${iconColor}`} aria-hidden="true" />
      </div>
      <div>
        <p className="text-2xl font-bold text-slate-900 font-mono">{value}</p>
        {sub && <p className={`text-xs mt-1 ${subColor}`}>{sub}</p>}
      </div>
    </div>
  );
}

function SpendBar({ name, amount, max, pct }: { name: string; amount: number; max: number; pct?: string }) {
  const width = max > 0 ? Math.round((amount / max) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <div className="w-28 shrink-0 truncate text-sm text-slate-700 font-medium" title={name}>{name}</div>
      <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-teal-500 rounded-full transition-all duration-500" style={{ width: `${width}%` }} />
      </div>
      <div className="w-20 text-right shrink-0">
        <span className="text-sm font-semibold text-slate-800 font-mono">{formatINR(amount)}</span>
        {pct && <span className="text-xs text-slate-400 ml-1">({pct}%)</span>}
      </div>
    </div>
  );
}

function SpendTrendBar({ month, amount, maxAmount }: { month: string; amount: number; maxAmount: number }) {
  const height = maxAmount > 0 ? Math.max(4, Math.round((amount / maxAmount) * 100)) : 4;
  return (
    <div className="flex flex-col items-center gap-1.5 flex-1">
      <span className="text-xs text-slate-500 font-mono">{amount > 0 ? formatINR(amount) : '—'}</span>
      <div className="w-full flex items-end justify-center" style={{ height: 80 }}>
        <div
          className="w-full max-w-10 rounded-t-lg bg-teal-500 transition-all duration-500"
          style={{ height: `${height}%` }}
        />
      </div>
      <span className="text-[10px] text-slate-400 text-center">{month}</span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BuyerDashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('this_month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  const load = useCallback(async (
    p: Period,
    cid?: string | null,
    bid?: string | null,
    cs?: string,
    ce?: string,
  ) => {
    setLoading(true);
    try {
      let url = `/api/buyer/dashboard?period=${p}`;
      if (p === 'custom' && cs && ce) url += `&start=${cs}&end=${ce}`;
      if (cid) url += `&client_id=${cid}`;
      if (bid) url += `&branch_id=${bid}`;
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

  useEffect(() => {
    load(period, selectedClientId, selectedBranchId);
  }, [load, period, selectedClientId, selectedBranchId]);

  function handlePeriodChange(p: Period) {
    setPeriod(p);
    setShowCustom(p === 'custom');
  }

  function applyCustomRange() {
    if (!customStart || !customEnd) { toast.error('Select start and end date'); return; }
    load('custom', selectedClientId, selectedBranchId, customStart, customEnd);
  }

  const trendMax = Math.max(...(data?.spend_trend?.map((p) => p.amount) ?? [1]), 1);
  const branchMax = Math.max(...(data?.branch_breakdown?.map((b) => b.spend) ?? [1]), 1);

  const PERIOD_LABELS: Record<Period, string> = {
    this_month: 'This Month', last_3_months: 'Last 3 Months', this_fy: 'This FY', custom: 'Custom',
  };

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

      {/* ── Top bar: greeting + filters ────────────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{greeting}{data?.client_name ? `, ${data.client_name.split(' ')[0]}` : ''}</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {data?.branch_name ? `${data.branch_name} · ` : ''}{data?.client_name ?? 'Your procurement overview'}
          </p>
        </div>

        {/* Period selector */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-xl">
            {(['this_month', 'last_3_months', 'this_fy', 'custom'] as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handlePeriodChange(p)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  period === p ? 'bg-white text-teal-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {PERIOD_LABELS[p]}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Custom date range */}
      {showCustom && (
        <div className="flex items-center gap-3 flex-wrap">
          <input
            type="date"
            value={customStart}
            onChange={(e) => setCustomStart(e.target.value)}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <span className="text-slate-400 text-sm">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="px-3 py-1.5 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
          <button
            type="button"
            onClick={applyCustomRange}
            className="px-4 py-1.5 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition-colors"
          >
            Apply
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-7 h-7 animate-spin text-teal-600" />
        </div>
      ) : (
        <>
          {/* ── Row 1: Primary KPIs ──────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Total Spend"
              value={formatINR(data?.monthly_spend ?? 0)}
              sub={`In selected period`}
              icon={TrendingUp}
              iconColor="text-teal-500"
              borderColor="border-l-4 border-l-teal-500 border-slate-200"
            />
            <KpiCard
              label="Outstanding Credit"
              value={formatINR(data?.outstanding_credit ?? 0)}
              sub="Pending payment"
              icon={CreditCard}
              iconColor="text-slate-400"
              borderColor="border-l-4 border-l-slate-400 border-slate-200"
            />
            <KpiCard
              label="Due Soon"
              value={formatINR(data?.due_soon ?? 0)}
              sub="Within 7 days"
              subColor={(data?.due_soon ?? 0) > 0 ? 'text-amber-600 font-semibold' : 'text-slate-400'}
              icon={(data?.due_soon ?? 0) > 0 ? Clock : CheckCircle2}
              iconColor={(data?.due_soon ?? 0) > 0 ? 'text-amber-500' : 'text-emerald-500'}
              borderColor={(data?.due_soon ?? 0) > 0 ? 'border-l-4 border-l-amber-400 border-slate-200' : 'border-slate-200'}
            />
            <KpiCard
              label="Overdue"
              value={formatINR(data?.overdue ?? 0)}
              sub={(data?.overdue ?? 0) > 0 ? 'Pay immediately' : 'All clear'}
              subColor={(data?.overdue ?? 0) > 0 ? 'text-rose-600 font-semibold' : 'text-emerald-600'}
              icon={(data?.overdue ?? 0) > 0 ? AlertTriangle : CheckCircle2}
              iconColor={(data?.overdue ?? 0) > 0 ? 'text-rose-500' : 'text-emerald-500'}
              borderColor={(data?.overdue ?? 0) > 0 ? 'border-l-4 border-l-rose-500 border-slate-200' : 'border-slate-200'}
            />
          </div>

          {/* ── Row 2: Operational KPIs ──────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-4">
            <KpiCard
              label="Active Orders"
              value={String(data?.active_orders ?? 0)}
              sub="In progress"
              icon={Package}
              iconColor="text-orange-400"
              borderColor="border-slate-200"
            />
            <KpiCard
              label="Delivered"
              value={String(data?.delivered_orders ?? 0)}
              sub="All time"
              icon={CheckCircle2}
              iconColor="text-emerald-400"
              borderColor="border-slate-200"
            />
            <KpiCard
              label="Quote Requests"
              value={String(data?.quote_requests ?? 0)}
              sub="All time"
              icon={FileText}
              iconColor="text-blue-400"
              borderColor="border-slate-200"
            />
          </div>

          {/* ── Overdue alert ─────────────────────────────────────────────── */}
          {(data?.overdue ?? 0) > 0 && (
            <div className="flex items-center gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl">
              <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0" />
              <p className="text-sm text-rose-700 font-medium flex-1">
                You have <strong>{formatINR(data?.overdue ?? 0)}</strong> overdue. Pay immediately to avoid account suspension.
              </p>
              <Link
                href="/buyer/account/credit"
                className="flex items-center gap-1 text-sm font-semibold text-rose-600 hover:text-rose-800 shrink-0"
              >
                View <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {/* ── Middle row: Spend by Branch + Quick Actions ───────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">

            {/* Spend by Branch */}
            <div className="lg:col-span-3 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">Spend by Branch</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Current period</p>
                </div>
                <Link href="/buyer/account/details?tab=branches" className="text-xs text-teal-600 hover:underline font-medium">
                  Manage Branches
                </Link>
              </div>
              {!data?.branch_breakdown?.length ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <LayoutDashboard className="w-8 h-8 text-slate-200 mb-2" />
                  <p className="text-sm text-slate-400">No branch data for this period</p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {data.branch_breakdown.slice(0, 6).map((b) => (
                    <SpendBar
                      key={b.branch_id}
                      name={b.branch_name}
                      amount={b.spend}
                      max={branchMax}
                      pct={branchMax > 0 ? String(Math.round((b.spend / (data?.monthly_spend || branchMax)) * 100)) : undefined}
                    />
                  ))}
                </div>
              )}
            </div>

            {/* Quick Actions */}
            <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-slate-800 mb-4">Quick Actions</h2>
              <div className="space-y-2">
                {[
                  {
                    label: 'Download Invoice Summary',
                    sub: 'Get monthly statement',
                    icon: Download,
                    href: '/buyer/account/orders',
                    color: 'text-teal-600 bg-teal-50',
                  },
                  {
                    label: 'View Outstanding Payments',
                    sub: `${formatINR(data?.outstanding_credit ?? 0)} pending`,
                    icon: CreditCard,
                    href: '/buyer/account/credit',
                    color: 'text-blue-600 bg-blue-50',
                  },
                  {
                    label: 'Add New Branch',
                    sub: 'Expand your outlets',
                    icon: Plus,
                    href: '/buyer/account/details?tab=branches',
                    color: 'text-emerald-600 bg-emerald-50',
                  },
                  {
                    label: 'Apply for Credit',
                    sub: '45-day payment terms',
                    icon: FileText,
                    href: '/buyer/account/credit-apply',
                    color: 'text-amber-600 bg-amber-50',
                  },
                  {
                    label: 'Request Quotation',
                    sub: 'Get bulk pricing',
                    icon: Package,
                    href: '/buyer/account/quotes',
                    color: 'text-purple-600 bg-purple-50',
                  },
                ].map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className="flex items-center gap-3 p-3 rounded-lg hover:bg-slate-50 transition-colors group"
                  >
                    <div className={`w-9 h-9 rounded-lg ${action.color} flex items-center justify-center shrink-0`}>
                      <action.icon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{action.label}</p>
                      <p className="text-xs text-slate-400 truncate">{action.sub}</p>
                    </div>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
                  </Link>
                ))}
              </div>
            </div>
          </div>

          {/* ── Spend Trend ───────────────────────────────────────────────── */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-sm font-semibold text-slate-800">Spend Trend</h2>
                <p className="text-xs text-slate-400 mt-0.5">Last 6 months</p>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full bg-teal-500" />
                <span className="text-xs text-slate-500">Monthly spend</span>
              </div>
            </div>
            <div className="flex items-end gap-2">
              {(data?.spend_trend ?? []).map((point) => (
                <SpendTrendBar key={point.month} month={point.month} amount={point.amount} maxAmount={trendMax} />
              ))}
            </div>
          </div>

          {/* ── Bottom row: Recent Orders + Outstanding Credit ─────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Recent Orders */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-800">Recent Orders</h2>
                <Link href="/buyer/account/orders" className="text-xs text-teal-600 hover:underline font-medium flex items-center gap-1">
                  View All <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {!data?.recent_orders?.length ? (
                <div className="flex flex-col items-center justify-center py-10 text-center p-6">
                  <Package className="w-8 h-8 text-slate-200 mb-2" />
                  <p className="text-sm text-slate-400">No orders yet</p>
                  <Link href="/buyer/marketplace" className="mt-3 text-sm text-teal-600 hover:underline font-medium">Browse Marketplace →</Link>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.recent_orders.map((order) => (
                    <div key={order.id} className="p-4 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <Link href={`/buyer/orders/${order.id}`} className="font-mono text-sm font-medium text-teal-700 hover:underline">
                          {order.order_number}
                        </Link>
                        <div className="flex items-center gap-2">
                          <a
                            href={`/api/buyer/orders/${order.id}/invoice`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded transition-colors"
                            title="Download Invoice"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_STYLES[order.status] ?? 'bg-slate-100 text-slate-600'}`}>
                            {STATUS_LABELS[order.status] ?? order.status}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-slate-500">
                          {order.branch_name && <span className="font-medium text-slate-600">{order.branch_name} · </span>}
                          {order.item_count} item{order.item_count !== 1 ? 's' : ''} · {formatDate(order.created_at)}
                        </div>
                        <span className="font-mono text-sm font-semibold text-slate-900">{formatINR(order.total_amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Outstanding Credit */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
              <div className="flex items-center justify-between p-5 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-800">Outstanding Credit</h2>
                <Link href="/buyer/account/credit" className="text-xs text-teal-600 hover:underline font-medium flex items-center gap-1">
                  View All <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {!data?.credit_rows?.length ? (
                <div className="flex flex-col items-center justify-center py-10 text-center p-6">
                  <CheckCircle2 className="w-8 h-8 text-emerald-200 mb-2" />
                  <p className="text-sm text-slate-400">No outstanding credit orders</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-100">
                  {data.credit_rows.map((row) => {
                    const bucketStyle = row.bucket === 'overdue'
                      ? 'bg-rose-50 text-rose-700 border border-rose-200'
                      : row.bucket === 'due_soon'
                        ? 'bg-amber-50 text-amber-700 border border-amber-200'
                        : 'bg-slate-50 text-slate-600 border border-slate-200';
                    const bucketLabel = row.bucket === 'overdue'
                      ? `${row.days_overdue}d overdue`
                      : row.bucket === 'due_soon'
                        ? 'Due soon'
                        : 'Upcoming';

                    return (
                      <div key={row.order_id} className="p-4">
                        <div className="flex items-center justify-between mb-1">
                          <Link href={`/buyer/orders/${row.order_id}`} className="font-mono text-sm font-medium text-teal-700 hover:underline">
                            {row.order_number}
                          </Link>
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${bucketStyle}`}>
                            {bucketLabel}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-slate-400">Due: {row.due_date ? formatDate(row.due_date) : 'Not delivered yet'}</p>
                          <span className="font-mono text-sm font-semibold text-slate-900">{formatINR(row.total_amount)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* ── Top Products ──────────────────────────────────────────────── */}
          {(data?.top_products?.length ?? 0) > 0 && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-sm font-semibold text-slate-800">Top Ordered Products</h2>
                  <p className="text-xs text-slate-400 mt-0.5">By spend, all time</p>
                </div>
                <Link href="/buyer/marketplace" className="text-xs text-teal-600 hover:underline font-medium">
                  Browse Marketplace →
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-slate-100">
                      <th className="pb-2 text-xs font-semibold text-slate-500 pr-4">Product</th>
                      <th className="pb-2 text-xs font-semibold text-slate-500 text-right pr-4">Qty Ordered</th>
                      <th className="pb-2 text-xs font-semibold text-slate-500 text-right">Total Spend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {data?.top_products?.map((p, i) => (
                      <tr key={p.product_name} className="hover:bg-slate-50">
                        <td className="py-3 pr-4 font-medium text-slate-800">
                          <span className="text-xs text-slate-400 mr-2">{i + 1}.</span>
                          {p.product_name}
                        </td>
                        <td className="py-3 pr-4 text-right font-mono text-slate-600">{p.total_qty.toLocaleString('en-IN')}</td>
                        <td className="py-3 text-right font-mono font-semibold text-slate-900">{formatINR(p.total_spend)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
