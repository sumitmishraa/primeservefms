'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CreditCard, AlertTriangle, CheckCircle, Clock,
  FileText, ShieldCheck, ChevronDown, ChevronUp,
  Building2, BadgeCheck, Loader2,
} from 'lucide-react';
import { formatINR, formatDate } from '@/lib/utils/formatting';
import type { CreditAccount } from '@/app/api/buyer/credit/route';

// ─── Types ────────────────────────────────────────────────────────────────────

type CreditOrderRow = CreditAccount['open_credit_orders'][number];

interface BranchSummary {
  branch_name: string;
  outstanding: number;
  due_soon: number;
  overdue: number;
  order_count: number;
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  pending: {
    label: 'Pending Activation', icon: Clock,
    gradient: 'from-amber-900/30 to-transparent',
    border: 'border-amber-500/20', dot: 'bg-amber-400',
    text: 'text-amber-300', sub: 'text-amber-400/70',
    description: "Your credit application is under review. We'll notify you within 3–5 business days.",
  },
  active: {
    label: 'Active Credit Line', icon: CheckCircle,
    gradient: 'from-emerald-900/30 to-transparent',
    border: 'border-emerald-500/20', dot: 'bg-emerald-400',
    text: 'text-emerald-300', sub: 'text-emerald-400/70',
    description: 'Your 45-day credit line is active. Pay within 45 days of delivery.',
  },
  suspended: {
    label: 'Credit Suspended', icon: AlertTriangle,
    gradient: 'from-rose-900/30 to-transparent',
    border: 'border-rose-500/20', dot: 'bg-rose-400',
    text: 'text-rose-300', sub: 'text-rose-400/70',
    description: 'Your credit account has been suspended. Please contact support to resolve.',
  },
};

const HOW_IT_WORKS = [
  { step: '1', text: 'Place an order and choose "45-Day Credit" at checkout.' },
  { step: '2', text: 'Your order is processed and delivered as normal.' },
  { step: '3', text: 'Payment is due within 45 days of delivery date.' },
  { step: '4', text: "Bank transfer (NEFT/IMPS) to PrimeServe's account before the due date." },
];

// ─── Branch breakdown ─────────────────────────────────────────────────────────

function buildBranchSummary(rows: CreditOrderRow[]): BranchSummary[] {
  const map = new Map<string, BranchSummary>();
  for (const row of rows) {
    const key = row.branch_name ?? 'Main Branch';
    const existing = map.get(key) ?? { branch_name: key, outstanding: 0, due_soon: 0, overdue: 0, order_count: 0 };
    existing.outstanding += row.total_amount;
    if (row.bucket === 'due_soon') existing.due_soon += row.total_amount;
    if (row.bucket === 'overdue') existing.overdue += row.total_amount;
    existing.order_count++;
    map.set(key, existing);
  }
  return Array.from(map.values()).sort((a, b) => b.outstanding - a.outstanding);
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AccountCreditPage() {
  const [credit,  setCredit]  = useState<CreditAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [howOpen, setHowOpen] = useState(false);

  useEffect(() => {
    fetch('/api/buyer/credit')
      .then((r) => r.json())
      .then((j: { data: CreditAccount | null; error: string | null }) => {
        if (j.error) throw new Error(j.error);
        setCredit(j.data);
      })
      .catch((e: Error) => setError(e.message ?? 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-7 h-7 animate-spin text-teal-500" />
    </div>
  );

  if (error || !credit) return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-white">Credit Overview</h1>
        <p className="text-sm text-slate-500 mt-0.5">Your 45-day credit line managed by PrimeServe.</p>
      </div>
      <div className="bg-white/5 border border-white/8 rounded-2xl p-12 text-center">
        <CreditCard className="w-10 h-10 text-slate-700 mx-auto mb-3" />
        <p className="text-slate-400 font-medium text-sm">No credit account found</p>
        <p className="text-slate-600 text-xs mt-1 mb-5">Apply for a PrimeServe credit line to pay on 45-day terms.</p>
        <Link href="/buyer/account/credit-apply" className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-teal-600 text-white rounded-xl hover:bg-teal-500 transition-colors">
          <BadgeCheck className="w-4 h-4" /> Apply for Credit
        </Link>
      </div>
    </div>
  );

  const cfg        = STATUS_CONFIG[credit.status];
  const StatusIcon = cfg.icon;
  const utilPct    = credit.credit_limit && credit.credit_limit > 0
    ? Math.min(100, Math.round((credit.outstanding / credit.credit_limit) * 100))
    : null;
  const branchSummary = buildBranchSummary(credit.open_credit_orders);
  const showBranches  = branchSummary.length > 1;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Credit Overview</h1>
        <p className="text-sm text-slate-500 mt-0.5">Your 45-day credit line managed by PrimeServe.</p>
      </div>

      {/* ── Status banner ────────────────────────────────────────────────── */}
      <div className={`relative rounded-2xl border ${cfg.border} overflow-hidden`}>
        {/* Gradient */}
        <div className={`absolute inset-0 bg-linear-to-r ${cfg.gradient} pointer-events-none`} />
        <div className="absolute inset-0 bg-navy-900/60 backdrop-blur-md pointer-events-none" />

        <div className="relative p-6">
          {/* Status row */}
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
            <div className="flex items-start gap-3">
              <StatusIcon className={`w-5 h-5 mt-0.5 shrink-0 ${cfg.text}`} />
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <span className={`font-semibold text-sm ${cfg.text}`}>{cfg.label}</span>
                  <span className={`inline-block w-2 h-2 rounded-full ${cfg.dot} animate-pulse`} />
                </div>
                <p className={`text-xs ${cfg.sub}`}>{cfg.description}</p>
              </div>
            </div>
            <Link
              href="/buyer/account/credit-apply"
              className="shrink-0 text-xs font-semibold text-teal-400 bg-teal-500/10 border border-teal-500/30 px-3 py-1.5 rounded-lg hover:bg-teal-500/20 transition-colors"
            >
              Apply for Higher Limit →
            </Link>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Outstanding',  value: credit.outstanding, note: 'total pending',     bold: true  },
              { label: 'Due Soon',     value: credit.due_soon,    note: 'within 7 days',     bold: false },
              { label: 'Overdue',      value: credit.overdue,     note: 'past 45-day term',  bold: false },
            ].map(({ label, value, bold }) => (
              <div key={label} className="bg-white/5 rounded-xl p-4 border border-white/8">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500 mb-2">{label}</p>
                <p className={`text-2xl font-bold tabular-nums tracking-tight ${
                  label === 'Overdue' && value > 0 ? 'text-rose-300' :
                  label === 'Due Soon' && value > 0 ? 'text-amber-300' : 'text-white'
                }`}>{formatINR(value)}</p>
              </div>
            ))}
          </div>

          {/* Utilisation bar */}
          {utilPct !== null && credit.credit_limit && (
            <div className="mt-4 bg-white/5 rounded-xl p-4 border border-white/8">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-slate-400 font-medium">Credit Utilisation</span>
                <span className="text-xs font-bold text-white tabular-nums">
                  {formatINR(credit.outstanding)} / {formatINR(credit.credit_limit)}
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-white/8 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    utilPct >= 90
                      ? 'bg-linear-to-r from-rose-500 to-rose-400'
                      : utilPct >= 70
                        ? 'bg-linear-to-r from-amber-500 to-amber-400'
                        : 'bg-linear-to-r from-teal-600 to-teal-400'
                  }`}
                  style={{ width: `${utilPct}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1.5">
                {utilPct}% of {formatINR(credit.credit_limit)} limit used
              </p>
            </div>
          )}
        </div>
      </div>

      {/* ── Overdue alert ── */}
      {credit.overdue > 0 && (
        <div className="flex items-start gap-3 px-4 py-3.5 bg-rose-500/10 border border-rose-500/20 rounded-2xl">
          <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-rose-300">Payment overdue</p>
            <p className="text-xs text-rose-400/70 mt-0.5">
              {formatINR(credit.overdue)} is past the 45-day term. Settle immediately to avoid account suspension.
            </p>
          </div>
          <a href="mailto:credit@primeserve.in" className="text-xs font-semibold text-rose-400 hover:text-rose-300 transition-colors shrink-0">
            Contact →
          </a>
        </div>
      )}

      {/* ── Admin notes ── */}
      {credit.notes && (
        <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl px-4 py-3">
          <p className="text-xs font-semibold text-amber-400 uppercase tracking-widest mb-1">Note from PrimeServe</p>
          <p className="text-sm text-amber-300/80">{credit.notes}</p>
        </div>
      )}

      {/* ── Per-Branch Credit Summary ── */}
      {showBranches && (
        <div className="bg-white/5 backdrop-blur-md border border-white/8 rounded-2xl overflow-hidden">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-white/8">
            <Building2 className="w-4 h-4 text-slate-500" />
            <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Branch Credit Summary</h2>
            <span className="text-xs text-slate-600 bg-white/5 border border-white/8 px-2 py-0.5 rounded-full">
              {branchSummary.length} locations
            </span>
          </div>
          <div className="divide-y divide-white/5">
            {branchSummary.map((branch) => {
              const hasOverdue = branch.overdue > 0;
              const hasDueSoon = branch.due_soon > 0 && !hasOverdue;
              const leftBorder = hasOverdue ? 'border-l-rose-500/70' : hasDueSoon ? 'border-l-amber-500/70' : 'border-l-emerald-500/40';
              return (
                <div key={branch.branch_name} className={`flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4 border-l-[3px] ${leftBorder} hover:bg-white/4 transition-colors`}>
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                    <span className="text-sm font-medium text-slate-200 truncate">{branch.branch_name}</span>
                    <span className="text-xs text-slate-600">{branch.order_count} order{branch.order_count !== 1 ? 's' : ''}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-6 gap-y-1 sm:justify-end">
                    <div className="text-right">
                      <p className="text-[10px] text-slate-600 uppercase tracking-wide">Outstanding</p>
                      <p className="text-sm font-bold text-white tabular-nums tracking-tight">{formatINR(branch.outstanding)}</p>
                    </div>
                    {branch.due_soon > 0 && (
                      <div className="text-right">
                        <p className="text-[10px] text-slate-600 uppercase tracking-wide">Due Soon</p>
                        <p className="text-sm font-bold text-amber-300 tabular-nums tracking-tight">{formatINR(branch.due_soon)}</p>
                      </div>
                    )}
                    {branch.overdue > 0 && (
                      <div className="text-right">
                        <p className="text-[10px] text-slate-600 uppercase tracking-wide">Overdue</p>
                        <p className="text-sm font-bold text-rose-300 tabular-nums tracking-tight">{formatINR(branch.overdue)}</p>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Open credit orders table ── */}
      {credit.open_credit_orders.length > 0 ? (
        <div className="bg-white/5 backdrop-blur-md border border-white/8 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/8">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-500" />
              <h2 className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Open Credit Orders</h2>
              <span className="text-xs text-slate-600 bg-white/5 border border-white/8 px-2 py-0.5 rounded-full">
                {credit.open_credit_orders.length}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/8">
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">Order</th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500 hidden md:table-cell">Branch</th>
                  <th className="px-5 py-3 text-right text-[10px] font-semibold uppercase tracking-widest text-slate-500">Amount</th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500 hidden sm:table-cell">Delivered</th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">Due Date</th>
                  <th className="px-5 py-3 text-left text-[10px] font-semibold uppercase tracking-widest text-slate-500">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {credit.open_credit_orders.map((row) => (
                  <tr key={row.order_id} className="hover:bg-white/4 transition-colors">
                    <td className="px-5 py-3">
                      <Link href={`/buyer/orders/${row.order_id}`} className="font-semibold text-teal-400 hover:text-teal-300 transition-colors text-xs tabular-nums">
                        {row.order_number}
                      </Link>
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell">
                      {row.branch_name ? (
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3 h-3 text-slate-500 shrink-0" />
                          <span className="text-xs text-slate-400">{row.branch_name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-white text-sm tabular-nums tracking-tight">
                      {formatINR(row.total_amount)}
                    </td>
                    <td className="px-5 py-3 text-slate-500 hidden sm:table-cell text-xs">
                      {row.delivered_at ? formatDate(row.delivered_at) : '—'}
                    </td>
                    <td className="px-5 py-3 text-slate-400 text-xs tabular-nums">
                      {row.due_date
                        ? new Date(row.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                        : 'Pending delivery'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border ${
                        row.bucket === 'overdue'
                          ? 'bg-rose-500/15 text-rose-300 border-rose-500/20'
                          : row.bucket === 'due_soon'
                            ? 'bg-amber-500/15 text-amber-300 border-amber-500/20'
                            : 'bg-white/5 text-slate-400 border-white/10'
                      }`}>
                        {row.bucket === 'overdue'
                          ? `${row.days_overdue}d overdue`
                          : row.bucket === 'due_soon'
                            ? 'Due soon'
                            : 'Upcoming'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="bg-white/5 border border-white/8 rounded-2xl p-10 text-center">
          <ShieldCheck className="w-10 h-10 text-emerald-400/40 mx-auto mb-3" />
          <p className="text-slate-400 font-semibold text-sm">All clear — no outstanding credit orders</p>
          <p className="text-slate-600 text-xs mt-1">All your 45-day credit payments are settled.</p>
        </div>
      )}

      {/* ── How credit works (collapsible) ── */}
      <div className="bg-white/5 backdrop-blur-md border border-white/8 rounded-2xl overflow-hidden">
        <button
          onClick={() => setHowOpen((o) => !o)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/4 transition-colors"
        >
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-300">How 45-Day Credit Works</span>
          </div>
          {howOpen
            ? <ChevronUp className="w-4 h-4 text-slate-500" />
            : <ChevronDown className="w-4 h-4 text-slate-500" />
          }
        </button>

        {howOpen && (
          <div className="px-5 pb-5 border-t border-white/8 pt-4 space-y-3">
            {HOW_IT_WORKS.map(({ step, text }) => (
              <div key={step} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-teal-500/15 border border-teal-500/30 text-teal-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {step}
                </div>
                <p className="text-sm text-slate-400 pt-0.5">{text}</p>
              </div>
            ))}
            <div className="pt-3 mt-1 border-t border-white/8 flex items-center justify-between">
              <p className="text-xs text-slate-600">
                Questions?{' '}
                <a href="mailto:credit@primeserve.in" className="text-teal-400 hover:text-teal-300 transition-colors">
                  credit@primeserve.in
                </a>
              </p>
              <Link href="/buyer/account/credit-apply" className="text-xs font-semibold text-teal-400 hover:text-teal-300 transition-colors">
                Apply for Higher Limit →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
