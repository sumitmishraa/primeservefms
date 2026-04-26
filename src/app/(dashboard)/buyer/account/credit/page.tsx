'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  CreditCard, Loader2, AlertTriangle, CheckCircle, Clock,
  ArrowRight, FileText, ShieldCheck,
} from 'lucide-react';
import { formatINR, formatDate } from '@/lib/utils/formatting';
import type { CreditAccount } from '@/app/api/buyer/credit/route';

const STATUS_CONFIG = {
  pending: {
    label: 'Pending Activation',
    icon: Clock,
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    dot: 'bg-amber-400',
    description: 'Your credit account is pending review by our team.',
  },
  active: {
    label: 'Active',
    icon: CheckCircle,
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    dot: 'bg-emerald-500',
    description: 'Your credit line is active. Pay within 45 days of delivery.',
  },
  suspended: {
    label: 'Suspended',
    icon: AlertTriangle,
    color: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
    dot: 'bg-rose-500',
    description: 'Your credit account has been suspended. Please contact support.',
  },
};

export default function AccountCreditPage() {
  const [credit, setCredit] = useState<CreditAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/buyer/credit');
        const json = await res.json() as { data: CreditAccount | null; error: string | null };
        if (!res.ok || json.error) throw new Error(json.error ?? 'Failed');
        setCredit(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center py-24">
      <Loader2 className="w-7 h-7 animate-spin text-teal-600" />
    </div>
  );

  if (error || !credit) return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center">
        <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-3" />
        <p className="text-slate-500 text-sm">{error || 'Could not load credit information.'}</p>
      </div>
    </div>
  );

  const cfg = STATUS_CONFIG[credit.status];
  const StatusIcon = cfg.icon;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-5">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Credit Overview</h1>
        <p className="text-sm text-slate-500 mt-1">Your 45-day credit line managed by PrimeServe</p>
      </div>

      {/* Hero — status + outstanding */}
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-teal-800 via-slate-900 to-slate-900 p-6 text-white shadow-xl">
        <div className="pointer-events-none absolute -right-12 -top-12 w-52 h-52 rounded-full bg-teal-500/20 blur-3xl" />
        <div className="pointer-events-none absolute -left-8 -bottom-8 w-36 h-36 rounded-full bg-white/5 blur-xl" />
        <div className="relative z-10">
          <div className="flex items-start justify-between mb-5">
            <div>
              <p className="text-teal-300 text-xs font-semibold uppercase tracking-wider mb-1">Outstanding Payable</p>
              <p className="text-4xl font-bold tracking-tight text-white">{formatINR(credit.outstanding)}</p>
              <p className="text-slate-400 text-xs mt-1">Total pending credit payments</p>
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Outstanding', value: formatINR(credit.outstanding), sub: 'Total pending', color: 'text-white' },
              { label: 'Due Soon', value: formatINR(credit.due_soon), sub: 'Within 7 days', color: 'text-amber-300' },
              { label: 'Overdue', value: formatINR(credit.overdue), sub: 'Past 45-day term', color: 'text-rose-300' },
            ].map(({ label, value, sub, color }) => (
              <div key={label} className="bg-white/5 rounded-xl p-3 border border-white/10">
                <p className="text-xs text-slate-400 mb-1">{label}</p>
                <p className={`text-base font-bold tracking-tight ${color}`}>{value}</p>
                <p className="text-xs text-slate-500 mt-0.5">{sub}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Overdue alert */}
      {credit.overdue > 0 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-rose-50 border border-rose-200 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-rose-800">Payment overdue</p>
            <p className="text-xs text-rose-600 mt-0.5">
              {formatINR(credit.overdue)} is past the 45-day payment term. Please settle immediately to avoid suspension.
            </p>
          </div>
          <a href="mailto:credit@primeserve.in" className="ml-auto text-xs text-rose-600 font-semibold hover:underline shrink-0">
            Contact →
          </a>
        </div>
      )}

      {/* Status detail */}
      <div className={`rounded-xl border p-4 flex items-start gap-3 ${cfg.bg} ${cfg.border}`}>
        <StatusIcon className={`w-5 h-5 mt-0.5 shrink-0 ${cfg.color}`} />
        <div>
          <p className={`text-sm font-semibold ${cfg.color}`}>{cfg.label}</p>
          <p className={`text-xs mt-0.5 ${cfg.color} opacity-80`}>{cfg.description}</p>
        </div>
      </div>

      {/* Open credit orders table */}
      {credit.open_credit_orders.length > 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-800">Open Credit Orders</h2>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {credit.open_credit_orders.length}
              </span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 text-xs text-slate-500 font-medium">
                  <th className="px-5 py-2.5 text-left">Order</th>
                  <th className="px-5 py-2.5 text-right">Amount</th>
                  <th className="px-5 py-2.5 text-left hidden sm:table-cell">Delivered</th>
                  <th className="px-5 py-2.5 text-left">Due Date</th>
                  <th className="px-5 py-2.5 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {credit.open_credit_orders.map((row) => (
                  <tr key={row.order_id} className="hover:bg-slate-50">
                    <td className="px-5 py-3 font-mono font-semibold text-teal-700">
                      <Link href={`/buyer/orders/${row.order_id}`} className="hover:underline">
                        {row.order_number}
                      </Link>
                    </td>
                    <td className="px-5 py-3 text-right font-mono font-bold text-slate-900">
                      {formatINR(row.total_amount)}
                    </td>
                    <td className="px-5 py-3 text-slate-500 hidden sm:table-cell text-xs">
                      {row.delivered_at ? formatDate(row.delivered_at) : '—'}
                    </td>
                    <td className="px-5 py-3 text-slate-600 font-mono text-xs">
                      {row.due_date
                        ? new Date(row.due_date).toLocaleDateString('en-IN')
                        : 'Pending delivery'}
                    </td>
                    <td className="px-5 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
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
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center">
          <ShieldCheck className="w-10 h-10 text-emerald-400 mx-auto mb-3" />
          <p className="text-slate-700 font-semibold text-sm">No outstanding credit orders</p>
          <p className="text-slate-400 text-xs mt-1">All your 45-day credit payments are settled.</p>
        </div>
      )}

      {/* How it works */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">How 45-Day Credit Works</h2>
        <div className="space-y-3">
          {[
            { step: '1', text: 'Place an order and choose "45-Day Credit" at checkout.' },
            { step: '2', text: 'Your order is processed and delivered as normal.' },
            { step: '3', text: 'Payment is due within 45 days of delivery.' },
            { step: '4', text: 'Contact us once you have settled the invoice.' },
          ].map(({ step, text }) => (
            <div key={step} className="flex items-start gap-3">
              <div className="w-6 h-6 rounded-full bg-teal-50 border border-teal-200 text-teal-700 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                {step}
              </div>
              <p className="text-sm text-slate-600">{text}</p>
            </div>
          ))}
        </div>
        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
          <p className="text-xs text-slate-400">
            For queries contact{' '}
            <a href="mailto:credit@primeserve.in" className="text-teal-600 hover:underline">
              credit@primeserve.in
            </a>
          </p>
          <a
            href="mailto:credit@primeserve.in"
            className="flex items-center gap-1 text-xs text-teal-600 font-semibold hover:text-teal-700 transition-colors"
          >
            Contact us <ArrowRight className="w-3 h-3" />
          </a>
        </div>
      </div>

      {/* Admin notes */}
      {credit.notes && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Admin Notes</p>
          <p className="text-sm text-slate-700">{credit.notes}</p>
        </div>
      )}
    </div>
  );
}
