'use client';

import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  TrendingUp, CreditCard, AlertTriangle, Clock,
  CheckCircle2, Package, FileText, Plus, ChevronRight, Loader2,
  Download, ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { formatINR, formatDate } from '@/lib/utils/formatting';
import type { DashboardData } from '@/app/api/buyer/dashboard/route';

const BranchMapCard = dynamic(
  () => import('@/components/buyer/BranchMapCard'),
  { ssr: false, loading: () => (
    <div className="bg-white/5 border border-white/8 rounded-2xl h-80 animate-pulse flex items-center justify-center">
      <Loader2 className="w-6 h-6 animate-spin text-teal-500/50" />
    </div>
  )},
);

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = 'this_month' | 'last_3_months' | 'this_fy' | 'custom';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', approved: 'Approved', forwarded_to_vendor: 'Processing',
  dispatched: 'Dispatched', delivered: 'Delivered', cancelled: 'Cancelled',
};

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-amber-500/15 text-amber-300 border border-amber-500/20',
  approved: 'bg-blue-500/15 text-blue-300 border border-blue-500/20',
  forwarded_to_vendor: 'bg-purple-500/15 text-purple-300 border border-purple-500/20',
  dispatched: 'bg-orange-500/15 text-orange-300 border border-orange-500/20',
  delivered: 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20',
  cancelled: 'bg-rose-500/15 text-rose-300 border border-rose-500/20',
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function KpiCard({
  label, value, sub, subColor = 'text-slate-500', accentColor = 'border-l-slate-600',
  icon: Icon, iconBg = 'bg-white/8', iconColor = 'text-slate-400',
}: {
  label: string; value: string; sub?: string; subColor?: string;
  accentColor?: string; icon: React.ElementType; iconBg?: string; iconColor?: string;
}) {
  return (
    <div className={`bg-white/5 backdrop-blur-md border border-white/8 border-l-[3px] ${accentColor} rounded-2xl shadow-xl shadow-black/20 p-5 flex flex-col gap-3 transition-all duration-200 hover:bg-white/8`}>
      <div className="flex items-center justify-between">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">{label}</p>
        <div className={`w-8 h-8 rounded-xl ${iconBg} flex items-center justify-center`}>
          <Icon className={`w-4 h-4 ${iconColor}`} aria-hidden="true" />
        </div>
      </div>
      <div>
        <p className="text-2xl font-bold text-white tabular-nums tracking-tight">{value}</p>
        {sub && <p className={`text-xs mt-1 font-medium ${subColor}`}>{sub}</p>}
      </div>
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

      {/* ── Top bar: greeting + period selector ────────────────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-white">
            {greeting}{data?.client_name ? `, ${data.client_name.split(' ')[0]}` : ''}
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {data?.branch_name ? `${data.branch_name} · ` : ''}{data?.client_name ?? 'Your procurement overview'}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 p-1 bg-white/5 border border-white/8 rounded-xl">
            {(['this_month', 'last_3_months', 'this_fy', 'custom'] as Period[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => handlePeriodChange(p)}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all duration-150 ${
                  period === p
                    ? 'bg-teal-500/20 text-teal-400 border border-teal-500/30'
                    : 'text-slate-500 hover:text-slate-300'
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
            className="px-3 py-1.5 text-sm bg-white/5 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50"
          />
          <span className="text-slate-500 text-sm">to</span>
          <input
            type="date"
            value={customEnd}
            onChange={(e) => setCustomEnd(e.target.value)}
            className="px-3 py-1.5 text-sm bg-white/5 border border-white/10 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500/50"
          />
          <button
            type="button"
            onClick={applyCustomRange}
            className="px-4 py-1.5 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-500 transition-colors"
          >
            Apply
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="w-7 h-7 animate-spin text-teal-500" />
        </div>
      ) : (
        <>
          {/* ── Row 1: Primary KPIs ──────────────────────────────────────── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Total Spend"
              value={formatINR(data?.monthly_spend ?? 0)}
              sub="In selected period"
              icon={TrendingUp}
              iconBg="bg-teal-500/15"
              iconColor="text-teal-400"
              accentColor="border-l-teal-500/80"
            />
            <KpiCard
              label="Outstanding Credit"
              value={formatINR(data?.outstanding_credit ?? 0)}
              sub="Pending payment"
              icon={CreditCard}
              iconBg="bg-blue-500/15"
              iconColor="text-blue-400"
              accentColor="border-l-blue-500/60"
            />
            <KpiCard
              label="Due Soon"
              value={formatINR(data?.due_soon ?? 0)}
              sub="Within 7 days"
              subColor={(data?.due_soon ?? 0) > 0 ? 'text-amber-400' : 'text-slate-500'}
              icon={(data?.due_soon ?? 0) > 0 ? Clock : CheckCircle2}
              iconBg={(data?.due_soon ?? 0) > 0 ? 'bg-amber-500/15' : 'bg-emerald-500/15'}
              iconColor={(data?.due_soon ?? 0) > 0 ? 'text-amber-400' : 'text-emerald-400'}
              accentColor={(data?.due_soon ?? 0) > 0 ? 'border-l-amber-500/80' : 'border-l-slate-600'}
            />
            <KpiCard
              label="Overdue"
              value={formatINR(data?.overdue ?? 0)}
              sub={(data?.overdue ?? 0) > 0 ? 'Pay immediately' : 'All clear'}
              subColor={(data?.overdue ?? 0) > 0 ? 'text-rose-400' : 'text-emerald-400'}
              icon={(data?.overdue ?? 0) > 0 ? AlertTriangle : CheckCircle2}
              iconBg={(data?.overdue ?? 0) > 0 ? 'bg-rose-500/15' : 'bg-emerald-500/15'}
              iconColor={(data?.overdue ?? 0) > 0 ? 'text-rose-400' : 'text-emerald-400'}
              accentColor={(data?.overdue ?? 0) > 0 ? 'border-l-rose-500/80' : 'border-l-slate-600'}
            />
          </div>

          {/* ── Row 2: Operational KPIs ──────────────────────────────────── */}
          <div className="grid grid-cols-3 gap-4">
            <KpiCard
              label="Active Orders"
              value={String(data?.active_orders ?? 0)}
              sub="In progress"
              icon={Package}
              iconBg="bg-orange-500/15"
              iconColor="text-orange-400"
              accentColor="border-l-slate-600"
            />
            <KpiCard
              label="Delivered"
              value={String(data?.delivered_orders ?? 0)}
              sub="All time"
              icon={CheckCircle2}
              iconBg="bg-emerald-500/15"
              iconColor="text-emerald-400"
              accentColor="border-l-slate-600"
            />
            <KpiCard
              label="Quote Requests"
              value={String(data?.quote_requests ?? 0)}
              sub="All time"
              icon={FileText}
              iconBg="bg-blue-500/15"
              iconColor="text-blue-400"
              accentColor="border-l-slate-600"
            />
          </div>

          {/* ── Overdue alert ─────────────────────────────────────────────── */}
          {(data?.overdue ?? 0) > 0 && (
            <div className="flex items-center gap-3 p-4 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
              <p className="text-sm text-rose-300 font-medium flex-1">
                You have <strong className="text-rose-200">{formatINR(data?.overdue ?? 0)}</strong> overdue. Pay immediately to avoid account suspension.
              </p>
              <Link
                href="/buyer/account/credit"
                className="flex items-center gap-1 text-sm font-semibold text-rose-400 hover:text-rose-300 transition-colors shrink-0"
              >
                View <ChevronRight className="w-4 h-4" />
              </Link>
            </div>
          )}

          {/* ── Branch Map ────────────────────────────────────────────────── */}
          <BranchMapCard
            branches={data?.branch_breakdown ?? []}
            totalSpend={data?.monthly_spend ?? 0}
          />

          {/* ── Quick Actions ─────────────────────────────────────────────── */}
          <div className="bg-white/5 backdrop-blur-md border border-white/8 rounded-2xl shadow-xl shadow-black/20 p-6">
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-4">Quick Actions</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {[
                {
                  label: 'Download Invoice Summary',
                  sub: 'Get monthly statement',
                  icon: Download,
                  href: '/buyer/account/orders',
                  iconBg: 'bg-teal-500/15',
                  iconColor: 'text-teal-400',
                },
                {
                  label: 'View Outstanding Payments',
                  sub: `${formatINR(data?.outstanding_credit ?? 0)} pending`,
                  icon: CreditCard,
                  href: '/buyer/account/credit',
                  iconBg: 'bg-blue-500/15',
                  iconColor: 'text-blue-400',
                },
                {
                  label: 'Add New Branch',
                  sub: 'Expand your outlets',
                  icon: Plus,
                  href: '/buyer/account/details?tab=branches',
                  iconBg: 'bg-emerald-500/15',
                  iconColor: 'text-emerald-400',
                },
                {
                  label: 'Apply for Credit',
                  sub: '45-day payment terms',
                  icon: FileText,
                  href: '/buyer/account/credit-apply',
                  iconBg: 'bg-amber-500/15',
                  iconColor: 'text-amber-400',
                },
                {
                  label: 'Request Quotation',
                  sub: 'Get bulk pricing',
                  icon: Package,
                  href: '/buyer/account/quotes',
                  iconBg: 'bg-purple-500/15',
                  iconColor: 'text-purple-400',
                },
              ].map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/4 hover:bg-teal-500/10 border border-white/8 hover:border-teal-500/30 transition-all duration-150 group"
                >
                  <div className={`w-9 h-9 rounded-xl ${action.iconBg} flex items-center justify-center shrink-0`}>
                    <action.icon className={`w-4 h-4 ${action.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-200 truncate">{action.label}</p>
                    <p className="text-xs text-slate-500 truncate">{action.sub}</p>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-600 group-hover:text-teal-400 transition-colors shrink-0" />
                </Link>
              ))}
            </div>
          </div>

          {/* ── Bottom row: Recent Orders + Outstanding Credit ─────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

            {/* Recent Orders */}
            <div className="bg-white/5 backdrop-blur-md border border-white/8 rounded-2xl shadow-xl shadow-black/20">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Recent Orders</h2>
                <Link href="/buyer/account/orders" className="text-xs text-teal-400 hover:text-teal-300 transition-colors font-medium flex items-center gap-1">
                  View All <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {!data?.recent_orders?.length ? (
                <div className="flex flex-col items-center justify-center py-10 text-center p-6">
                  <Package className="w-8 h-8 text-slate-700 mb-2" />
                  <p className="text-sm text-slate-500">No orders yet</p>
                  <Link href="/buyer/marketplace" className="mt-3 text-sm text-teal-400 hover:text-teal-300 transition-colors font-medium">
                    Browse Marketplace →
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {data.recent_orders.map((order) => (
                    <div key={order.id} className="p-4 hover:bg-white/4 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <Link href={`/buyer/orders/${order.id}`} className="text-sm font-semibold text-teal-400 hover:text-teal-300 transition-colors tabular-nums">
                          {order.order_number}
                        </Link>
                        <div className="flex items-center gap-2">
                          <a
                            href={`/api/buyer/orders/${order.id}/invoice`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1 text-slate-600 hover:text-teal-400 hover:bg-teal-500/10 rounded transition-colors"
                            title="Download Invoice"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </a>
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${STATUS_STYLES[order.status] ?? 'bg-white/8 text-slate-400 border border-white/10'}`}>
                            {STATUS_LABELS[order.status] ?? order.status}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <div className="text-xs text-slate-500">
                          {order.branch_name && <span className="font-medium text-slate-400">{order.branch_name} · </span>}
                          {order.item_count} item{order.item_count !== 1 ? 's' : ''} · {formatDate(order.created_at)}
                        </div>
                        <span className="text-sm font-bold text-white tabular-nums tracking-tight">{formatINR(order.total_amount)}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Outstanding Credit */}
            <div className="bg-white/5 backdrop-blur-md border border-white/8 rounded-2xl shadow-xl shadow-black/20">
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
                <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Outstanding Credit</h2>
                <Link href="/buyer/account/credit" className="text-xs text-teal-400 hover:text-teal-300 transition-colors font-medium flex items-center gap-1">
                  View All <ChevronRight className="w-3.5 h-3.5" />
                </Link>
              </div>

              {!data?.credit_rows?.length ? (
                <div className="flex flex-col items-center justify-center py-10 text-center p-6">
                  <CheckCircle2 className="w-8 h-8 text-emerald-500/30 mb-2" />
                  <p className="text-sm text-slate-500">No outstanding credit orders</p>
                </div>
              ) : (
                <div className="divide-y divide-white/5">
                  {data.credit_rows.map((row) => {
                    const bucketStyle = row.bucket === 'overdue'
                      ? 'bg-rose-500/15 text-rose-300 border border-rose-500/20'
                      : row.bucket === 'due_soon'
                        ? 'bg-amber-500/15 text-amber-300 border border-amber-500/20'
                        : 'bg-white/8 text-slate-400 border border-white/10';
                    const bucketLabel = row.bucket === 'overdue'
                      ? `${row.days_overdue}d overdue`
                      : row.bucket === 'due_soon'
                        ? 'Due soon'
                        : 'Upcoming';

                    return (
                      <div key={row.order_id} className="p-4 hover:bg-white/4 transition-colors">
                        <div className="flex items-center justify-between mb-1">
                          <Link href={`/buyer/orders/${row.order_id}`} className="text-sm font-semibold text-teal-400 hover:text-teal-300 transition-colors tabular-nums">
                            {row.order_number}
                          </Link>
                          <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${bucketStyle}`}>
                            {bucketLabel}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-xs text-slate-500">Due: {row.due_date ? formatDate(row.due_date) : 'Not delivered yet'}</p>
                          <span className="text-sm font-bold text-white tabular-nums tracking-tight">{formatINR(row.total_amount)}</span>
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
            <div className="bg-white/5 backdrop-blur-md border border-white/8 rounded-2xl shadow-xl shadow-black/20 p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Top Ordered Products</h2>
                  <p className="text-xs text-slate-600 mt-0.5">By spend, all time</p>
                </div>
                <Link href="/buyer/marketplace" className="text-xs text-teal-400 hover:text-teal-300 transition-colors font-medium">
                  Browse Marketplace →
                </Link>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left border-b border-white/8">
                      <th className="pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500 pr-4">Product</th>
                      <th className="pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500 text-right pr-4">Qty Ordered</th>
                      <th className="pb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-500 text-right">Total Spend</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {data?.top_products?.map((p, i) => (
                      <tr key={p.product_name} className="hover:bg-white/4 transition-colors">
                        <td className="py-3 pr-4 font-medium text-slate-200">
                          <span className="text-xs text-slate-600 mr-2">{i + 1}.</span>
                          {p.product_name}
                        </td>
                        <td className="py-3 pr-4 text-right text-slate-400 tabular-nums">{p.total_qty.toLocaleString('en-IN')}</td>
                        <td className="py-3 text-right font-bold text-white tabular-nums tracking-tight">{formatINR(p.total_spend)}</td>
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
