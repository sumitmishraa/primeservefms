'use client';

/**
 * Account > Credit Overview
 * Shows the buyer's admin-assigned credit limit, usage, and available balance.
 */

import { useEffect, useState } from 'react';
import { CreditCard, Loader2, TrendingUp, AlertTriangle, CheckCircle, Clock } from 'lucide-react';
import { formatINR } from '@/lib/utils/formatting';
import type { CreditAccount } from '@/app/api/buyer/credit/route';

const STATUS_CONFIG = {
  pending: {
    label: 'Pending Activation',
    icon: Clock,
    color: 'text-amber-700',
    bg: 'bg-amber-50',
    border: 'border-amber-200',
    description: 'Your credit account is pending review by our team. We will notify you once it is activated.',
  },
  active: {
    label: 'Active',
    icon: CheckCircle,
    color: 'text-emerald-700',
    bg: 'bg-emerald-50',
    border: 'border-emerald-200',
    description: 'Your credit line is active. You can use it during checkout.',
  },
  suspended: {
    label: 'Suspended',
    icon: AlertTriangle,
    color: 'text-rose-700',
    bg: 'bg-rose-50',
    border: 'border-rose-200',
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
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-7 h-7 animate-spin text-teal-600" />
    </div>
  );

  if (error || !credit) return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 text-center text-slate-500">
      {error || 'Could not load credit information. Please try again.'}
    </div>
  );

  const statusCfg = STATUS_CONFIG[credit.status];
  const StatusIcon = statusCfg.icon;
  const usagePercent = credit.credit_limit > 0
    ? Math.min(100, Math.round((credit.used_amount / credit.credit_limit) * 100))
    : 0;
  const usageColor = usagePercent >= 90 ? 'bg-rose-500' : usagePercent >= 70 ? 'bg-amber-500' : 'bg-teal-500';

  return (
    <div className="space-y-5">
      {/* Status banner */}
      <div className={`rounded-xl border p-4 flex items-start gap-3 ${statusCfg.bg} ${statusCfg.border}`}>
        <StatusIcon className={`w-5 h-5 mt-0.5 shrink-0 ${statusCfg.color}`} />
        <div>
          <p className={`text-sm font-semibold ${statusCfg.color}`}>{statusCfg.label}</p>
          <p className={`text-xs mt-0.5 ${statusCfg.color} opacity-80`}>{statusCfg.description}</p>
        </div>
      </div>

      {/* Credit summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Credit Limit', value: formatINR(credit.credit_limit), icon: CreditCard, color: 'text-slate-700', iconColor: 'text-slate-400' },
          { label: 'Used', value: formatINR(credit.used_amount), icon: TrendingUp, color: 'text-rose-600', iconColor: 'text-rose-400' },
          { label: 'Available', value: formatINR(credit.available), icon: CheckCircle, color: 'text-teal-700', iconColor: 'text-teal-500' },
        ].map(({ label, value, icon: Icon, color, iconColor }) => (
          <div key={label} className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-medium text-slate-500">{label}</p>
              <Icon className={`w-4 h-4 ${iconColor}`} />
            </div>
            <p className={`text-2xl font-bold font-mono ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Usage bar */}
      {credit.credit_limit > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-slate-700">Credit Utilisation</h2>
            <span className="text-sm font-bold text-slate-900 font-mono">{usagePercent}%</span>
          </div>
          <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
            <div
              className={`h-3 rounded-full transition-all ${usageColor}`}
              style={{ width: `${usagePercent}%` }}
            />
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-xs text-slate-400">{formatINR(credit.used_amount)} used</span>
            <span className="text-xs text-slate-400">{formatINR(credit.credit_limit)} limit</span>
          </div>
          {usagePercent >= 80 && (
            <div className="mt-3 flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
              You have used over 80% of your credit limit. Contact your account manager to increase it.
            </div>
          )}
        </div>
      )}

      {/* Info */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <h2 className="text-sm font-semibold text-slate-700 mb-3">How Credit Works</h2>
        <ul className="space-y-2 text-sm text-slate-500">
          <li className="flex gap-2"><span className="text-teal-500 font-bold">·</span> Credit limits are assigned by your PrimeServe account manager.</li>
          <li className="flex gap-2"><span className="text-teal-500 font-bold">·</span> Choose &ldquo;45-Day Credit&rdquo; at checkout when your account is active.</li>
          <li className="flex gap-2"><span className="text-teal-500 font-bold">·</span> Payments are due within 45 days of delivery.</li>
          <li className="flex gap-2"><span className="text-teal-500 font-bold">·</span> To request a higher limit, email <a href="mailto:credit@primeserve.in" className="text-teal-600 hover:underline">credit@primeserve.in</a></li>
        </ul>
        {credit.notes && (
          <div className="mt-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <p className="text-xs font-medium text-slate-600 mb-1">Admin Notes</p>
            <p className="text-sm text-slate-700">{credit.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
}
