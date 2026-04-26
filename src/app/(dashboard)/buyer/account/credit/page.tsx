'use client';

import { useEffect, useState } from 'react';
import {
  CreditCard,
  Loader2,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';
import { formatINR } from '@/lib/utils/formatting';
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
    description: 'Your credit line is active and ready to use at checkout.',
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
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-10 text-center">
      <CreditCard className="w-10 h-10 text-slate-300 mx-auto mb-3" />
      <p className="text-slate-500 text-sm">{error || 'Could not load credit information.'}</p>
    </div>
  );

  const cfg = STATUS_CONFIG[credit.status];
  const StatusIcon = cfg.icon;
  const usagePercent = credit.credit_limit > 0
    ? Math.min(100, Math.round((credit.used_amount / credit.credit_limit) * 100))
    : 0;
  const barColor = usagePercent >= 90 ? 'bg-rose-500' : usagePercent >= 70 ? 'bg-amber-500' : 'bg-teal-500';

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div>
        <h1 className="text-2xl font-bold text-slate-900 font-heading">Credit Overview</h1>
        <p className="text-sm text-slate-500 mt-1">Your 45-day credit line managed by PrimeServe</p>
      </div>

      {/* Hero — available credit + status */}
      <div className="bg-linear-to-br from-slate-900 to-slate-800 rounded-2xl p-6 text-white relative overflow-hidden">
        {/* Decorative background ring */}
        <div className="absolute -right-10 -top-10 w-40 h-40 rounded-full bg-teal-500 opacity-10" />
        <div className="absolute -right-4 -bottom-8 w-24 h-24 rounded-full bg-teal-400 opacity-10" />

        <div className="relative z-10">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-slate-400 text-xs font-medium uppercase tracking-wider mb-1">Available Credit</p>
              <p className="text-4xl font-bold font-mono text-white">{formatINR(credit.available)}</p>
            </div>
            <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.border} ${cfg.color}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
              {cfg.label}
            </div>
          </div>

          {credit.credit_limit > 0 && (
            <>
              <div className="w-full bg-white/10 rounded-full h-2 mb-2">
                <div
                  className={`h-2 rounded-full transition-all ${barColor}`}
                  style={{ width: `${usagePercent}%` }}
                />
              </div>
              <div className="flex justify-between text-xs text-slate-400">
                <span>{formatINR(credit.used_amount)} used</span>
                <span>{formatINR(credit.credit_limit)} total limit</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Three stat cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Credit Limit', value: formatINR(credit.credit_limit), icon: ShieldCheck, color: 'text-slate-700', sub: 'Admin assigned' },
          { label: 'Amount Used', value: formatINR(credit.used_amount), icon: TrendingUp, color: 'text-rose-600', sub: 'Pending payment' },
          { label: 'Available', value: formatINR(credit.available), icon: CreditCard, color: 'text-teal-700', sub: 'Ready to use' },
        ].map(({ label, value, icon: Icon, color, sub }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-slate-500">{label}</p>
              <Icon className={`w-3.5 h-3.5 ${color} opacity-60`} />
            </div>
            <p className={`text-lg font-bold font-mono ${color}`}>{value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{sub}</p>
          </div>
        ))}
      </div>

      {/* Usage warning */}
      {usagePercent >= 80 && (
        <div className="flex items-start gap-3 px-4 py-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold">High credit utilisation ({usagePercent}%)</p>
            <p className="text-xs mt-0.5 text-amber-700">
              Contact your account manager to increase your credit limit.
            </p>
          </div>
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

      {/* How it works */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-slate-800 mb-4">How 45-Day Credit Works</h2>
        <div className="space-y-3">
          {[
            { step: '1', text: 'Place an order and choose "45-Day Credit" at checkout.' },
            { step: '2', text: 'Your order is processed and delivered as normal.' },
            { step: '3', text: 'Payment is due within 45 days of delivery.' },
            { step: '4', text: 'Once paid, your available credit is restored.' },
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
            To request a limit increase, contact us at{' '}
            <a href="mailto:credit@primeserve.in" className="text-teal-600 hover:underline">
              credit@primeserve.in
            </a>
          </p>
          <a
            href="mailto:credit@primeserve.in"
            className="flex items-center gap-1 text-xs text-teal-600 font-semibold hover:text-teal-700 transition-colors"
          >
            Request increase <ArrowRight className="w-3 h-3" />
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
