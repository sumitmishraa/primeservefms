'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CreditCard, AlertTriangle, CheckCircle, Clock,
  FileText, ShieldCheck, ChevronDown, ChevronUp,
  Building2, BadgeCheck,
} from 'lucide-react';
import { formatINR, formatDate } from '@/lib/utils/formatting';
import type { CreditAccount } from '@/app/api/buyer/credit/route';

/* ─── Status config ─── */
const STATUS_CONFIG = {
  pending: {
    label: 'Pending Activation',
    icon: Clock,
    banner: 'bg-amber-50 border-amber-200',
    dot: 'bg-amber-400',
    text: 'text-amber-800',
    sub: 'text-amber-700',
    description: 'Your credit application is under review. We\'ll notify you within 3–5 business days.',
  },
  active: {
    label: 'Active Credit Line',
    icon: CheckCircle,
    banner: 'bg-emerald-50 border-emerald-200',
    dot: 'bg-emerald-500',
    text: 'text-emerald-800',
    sub: 'text-emerald-700',
    description: 'Your 45-day credit line is active. Pay within 45 days of delivery.',
  },
  suspended: {
    label: 'Credit Suspended',
    icon: AlertTriangle,
    banner: 'bg-rose-50 border-rose-200',
    dot: 'bg-rose-500',
    text: 'text-rose-800',
    sub: 'text-rose-700',
    description: 'Your credit account has been suspended. Please contact support to resolve.',
  },
};

/* ─── How it works steps ─── */
const HOW_IT_WORKS = [
  { step: '1', text: 'Place an order and choose "45-Day Credit" at checkout.' },
  { step: '2', text: 'Your order is processed and delivered as normal.' },
  { step: '3', text: 'Payment is due within 45 days of delivery date.' },
  { step: '4', text: "Bank transfer (NEFT/IMPS) to PrimeServe's account before the due date." },
];

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

  /* ── Loading ── */
  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <div className="w-7 h-7 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  /* ── Error / no account ── */
  if (error || !credit) return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold font-heading text-slate-900">Credit Overview</h1>
        <p className="text-sm text-slate-500 mt-0.5">Your 45-day credit line managed by PrimeServe.</p>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-12 text-center">
        <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-600 font-medium text-sm">No credit account found</p>
        <p className="text-slate-400 text-xs mt-1 mb-5">Apply for a PrimeServe credit line to pay on 45-day terms.</p>
        <Link
          href="/buyer/account/credit-apply"
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
        >
          <BadgeCheck className="w-4 h-4" /> Apply for Credit
        </Link>
      </div>
    </div>
  );

  const cfg         = STATUS_CONFIG[credit.status];
  const StatusIcon  = cfg.icon;
  const utilPct     = credit.credit_limit && credit.credit_limit > 0
    ? Math.min(100, Math.round((credit.outstanding / credit.credit_limit) * 100))
    : null;

  return (
    <div className="space-y-5">

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold font-heading text-slate-900">Credit Overview</h1>
        <p className="text-sm text-slate-500 mt-0.5">Your 45-day credit line managed by PrimeServe.</p>
      </div>

      {/* ── Status banner ── */}
      <div className={`rounded-xl border p-5 ${cfg.banner}`}>
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">

          {/* Left: status pill + description */}
          <div className="flex items-start gap-3">
            <StatusIcon className={`w-5 h-5 mt-0.5 shrink-0 ${cfg.text}`} />
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className={`font-semibold text-sm ${cfg.text}`}>{cfg.label}</span>
                <span className={`inline-block w-2 h-2 rounded-full ${cfg.dot}`} />
              </div>
              <p className={`text-xs ${cfg.sub}`}>{cfg.description}</p>
            </div>
          </div>

          {/* Right: Apply for Higher Limit */}
          <Link
            href="/buyer/account/credit-apply"
            className="shrink-0 text-xs font-semibold text-teal-700 bg-white border border-teal-200 px-3 py-1.5 rounded-lg hover:bg-teal-50 transition-colors"
          >
            Apply for Higher Limit →
          </Link>
        </div>

        {/* ── KPI row ── */}
        <div className="grid grid-cols-3 gap-3 mt-4">
          {[
            { label: 'Outstanding',   value: formatINR(credit.outstanding), note: 'total pending',    bold: true  },
            { label: 'Due Soon',      value: formatINR(credit.due_soon),    note: 'within 7 days',   bold: false },
            { label: 'Overdue',       value: formatINR(credit.overdue),     note: 'past 45-day term', bold: false },
          ].map(({ label, value, note }) => (
            <div key={label} className="bg-white/70 rounded-lg p-3 border border-white">
              <p className="text-xs text-slate-500 mb-1">{label}</p>
              <p className="text-sm font-bold font-mono text-slate-900">{value}</p>
              <p className="text-xs text-slate-400 mt-0.5">{note}</p>
            </div>
          ))}
        </div>

        {/* ── Utilisation bar (only if limit is stored) ── */}
        {utilPct !== null && credit.credit_limit && (
          <div className="mt-4 bg-white/70 rounded-lg p-3 border border-white">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-600 font-medium">Credit Utilisation</span>
              <span className="text-xs font-mono font-bold text-slate-800">
                {formatINR(credit.outstanding)} / {formatINR(credit.credit_limit)}
              </span>
            </div>
            <div className="h-2.5 rounded-full bg-slate-200 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  utilPct >= 90 ? 'bg-rose-500' : utilPct >= 70 ? 'bg-amber-500' : 'bg-teal-500'
                }`}
                style={{ width: `${utilPct}%` }}
              />
            </div>
            <p className="text-xs text-slate-500 mt-1.5">{utilPct}% of ₹{(credit.credit_limit / 100000).toFixed(1)}L limit used</p>
          </div>
        )}
      </div>

      {/* ── Overdue alert ── */}
      {credit.overdue > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-rose-800">Payment overdue</p>
            <p className="text-xs text-rose-600 mt-0.5">
              {formatINR(credit.overdue)} is past the 45-day term. Settle immediately to avoid account suspension.
            </p>
          </div>
          <a
            href="mailto:credit@primeserve.in"
            className="text-xs font-semibold text-rose-700 hover:underline shrink-0"
          >
            Contact →
          </a>
        </div>
      )}

      {/* ── Admin notes ── */}
      {credit.notes && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3">
          <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Note from PrimeServe</p>
          <p className="text-sm text-amber-800">{credit.notes}</p>
        </div>
      )}

      {/* ── Open credit orders table ── */}
      {credit.open_credit_orders.length > 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-800">Open Credit Orders</h2>
              <span className="text-xs text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                {credit.open_credit_orders.length}
              </span>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-500 font-medium border-b border-slate-100">
                  <th className="px-5 py-3 text-left">Order</th>
                  <th className="px-5 py-3 text-left hidden md:table-cell">Branch</th>
                  <th className="px-5 py-3 text-right">Amount</th>
                  <th className="px-5 py-3 text-left hidden sm:table-cell">Delivered</th>
                  <th className="px-5 py-3 text-left">Due Date</th>
                  <th className="px-5 py-3 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {credit.open_credit_orders.map((row) => (
                  <tr key={row.order_id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3">
                      <Link
                        href={`/buyer/orders/${row.order_id}`}
                        className="font-mono font-semibold text-teal-700 hover:underline text-xs"
                      >
                        {row.order_number}
                      </Link>
                    </td>
                    <td className="px-5 py-3 hidden md:table-cell">
                      {row.branch_name ? (
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="text-xs text-slate-600">{row.branch_name}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-slate-900 text-xs">
                      {formatINR(row.total_amount)}
                    </td>
                    <td className="px-5 py-3 text-slate-500 hidden sm:table-cell text-xs">
                      {row.delivered_at ? formatDate(row.delivered_at) : '—'}
                    </td>
                    <td className="px-5 py-3 text-slate-600 font-mono text-xs">
                      {row.due_date
                        ? new Date(row.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
                        : 'Pending delivery'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium border ${
                        row.bucket === 'overdue'
                          ? 'bg-rose-50 text-rose-700 border-rose-200'
                          : row.bucket === 'due_soon'
                            ? 'bg-amber-50 text-amber-700 border-amber-200'
                            : 'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>
                        {row.bucket === 'overdue'
                          ? `⚠ Overdue ${row.days_overdue}d`
                          : row.bucket === 'due_soon'
                            ? '⏰ Due Soon'
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
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center">
          <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
          <p className="text-slate-700 font-semibold text-sm">All clear — no outstanding credit orders</p>
          <p className="text-slate-400 text-xs mt-1">All your 45-day credit payments are settled.</p>
        </div>
      )}

      {/* ── How credit works (collapsible) ── */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <button
          onClick={() => setHowOpen((o) => !o)}
          className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition-colors"
        >
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-slate-400" />
            <span className="text-sm font-semibold text-slate-800">How 45-Day Credit Works</span>
          </div>
          {howOpen
            ? <ChevronUp className="w-4 h-4 text-slate-400" />
            : <ChevronDown className="w-4 h-4 text-slate-400" />
          }
        </button>

        {howOpen && (
          <div className="px-5 pb-5 border-t border-slate-100 pt-4 space-y-3">
            {HOW_IT_WORKS.map(({ step, text }) => (
              <div key={step} className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-teal-50 border border-teal-200 text-teal-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                  {step}
                </div>
                <p className="text-sm text-slate-600 pt-0.5">{text}</p>
              </div>
            ))}
            <div className="pt-3 mt-1 border-t border-slate-100 flex items-center justify-between">
              <p className="text-xs text-slate-400">
                Questions? Email{' '}
                <a href="mailto:credit@primeserve.in" className="text-teal-600 hover:underline">
                  credit@primeserve.in
                </a>
              </p>
              <Link
                href="/buyer/account/credit-apply"
                className="text-xs font-semibold text-teal-600 hover:text-teal-700 transition-colors"
              >
                Apply for Higher Limit →
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
