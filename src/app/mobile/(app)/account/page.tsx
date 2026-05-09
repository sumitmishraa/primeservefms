'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { formatINR } from '@/lib/utils/formatting';

interface User { id: string; full_name: string; email: string | null; phone: string | null; role: string; company_name: string | null; }
interface Credit {
  credit_limit: number; credit_used: number; credit_available: number;
  outstanding_amount: number; due_date: string | null; overdue_amount: number; payment_terms: string;
}
interface Profile {
  full_name: string; email: string | null; phone: string | null;
  company_name: string | null; client_name: string | null; branch_name: string | null;
  gst_number: string | null; billing_address: string | null;
}

function formatDate(s: string) {
  return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function MobileAccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [credit, setCredit] = useState<Credit | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) { router.replace('/mobile/login'); return; }
        setUser(d.user);
        return Promise.all([
          fetch('/api/buyer/credit').then((r) => r.json()),
          fetch('/api/buyer/profile').then((r) => r.json()),
        ]);
      })
      .then((results) => {
        if (!results) return;
        const [creditData, profileData] = results;
        if (creditData?.data) setCredit(creditData.data);
        if (profileData?.data) setProfile(profileData.data);
        setLoading(false);
      })
      .catch(() => router.replace('/mobile/login'));
  }, [router]);

  async function handleLogout() {
    if (!confirm('Log out of PrimeServe?')) return;
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/mobile/login');
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-[3px] border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const usedPct = credit ? Math.min(100, Math.round((credit.credit_used / credit.credit_limit) * 100)) : 0;
  const isOverdue = (credit?.overdue_amount ?? 0) > 0;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-teal-600 px-4 pt-12 pb-6">
        <h1 className="text-white font-heading font-bold text-xl mb-4">My Account</h1>
        <div className="bg-white/10 rounded-2xl p-4 flex items-center gap-4">
          <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center flex-shrink-0">
            <span className="font-heading font-bold text-teal-600 text-2xl">
              {user?.full_name.charAt(0).toUpperCase()}
            </span>
          </div>
          <div>
            <p className="text-white font-heading font-bold text-lg leading-tight">{user?.full_name}</p>
            {profile?.client_name && (
              <p className="text-teal-100 text-xs mt-0.5">{profile.client_name}{profile.branch_name ? ` · ${profile.branch_name}` : ''}</p>
            )}
            {user?.email && <p className="text-teal-200 text-xs">{user.email}</p>}
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
        {/* Credit overview */}
        {credit && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">💳</span>
              <h2 className="font-heading font-bold text-slate-900">Credit Overview</h2>
            </div>

            {isOverdue && (
              <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 mb-3">
                <p className="text-rose-700 text-sm font-semibold">
                  ⚠️ Overdue: {formatINR(credit.overdue_amount)} — please clear immediately
                </p>
              </div>
            )}

            <div className="flex justify-between text-xs text-slate-500 mb-1.5">
              <span>Credit Used</span>
              <span className="font-semibold">{usedPct}%</span>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden mb-4">
              <div
                className={`h-full rounded-full transition-all ${isOverdue ? 'bg-rose-500' : usedPct > 80 ? 'bg-amber-500' : 'bg-teal-500'}`}
                style={{ width: `${usedPct}%` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Limit', value: formatINR(credit.credit_limit), color: 'text-slate-900' },
                { label: 'Used', value: formatINR(credit.credit_used), color: 'text-amber-600' },
                { label: 'Available', value: formatINR(credit.credit_available), color: 'text-emerald-600' },
              ].map((c) => (
                <div key={c.label} className="bg-slate-50 rounded-xl p-2.5 text-center">
                  <p className="text-slate-400 text-[10px] mb-1">{c.label}</p>
                  <p className={`font-mono font-bold text-xs ${c.color}`}>{c.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Outstanding & Dues */}
        {credit && (credit.outstanding_amount > 0 || credit.due_date) && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg">📅</span>
              <h2 className="font-heading font-bold text-slate-900">Outstanding & Dues</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-slate-400 text-xs mb-1">Outstanding</p>
                <p className={`font-mono font-bold text-base ${isOverdue ? 'text-rose-600' : 'text-slate-900'}`}>
                  {formatINR(credit.outstanding_amount)}
                </p>
              </div>
              {credit.due_date && (
                <div>
                  <p className="text-slate-400 text-xs mb-1">Due Date</p>
                  <p className={`font-semibold text-sm ${isOverdue ? 'text-rose-600' : 'text-slate-900'}`}>
                    {formatDate(credit.due_date)}
                  </p>
                </div>
              )}
            </div>
            <div className="border-t border-slate-100 mt-3 pt-3 flex justify-between">
              <span className="text-slate-400 text-xs">Payment Terms</span>
              <span className="text-slate-700 text-xs font-semibold">{credit.payment_terms || '45 Days'}</span>
            </div>
          </div>
        )}

        {/* Business details */}
        {profile && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
            <div className="px-4 pt-4 pb-2 flex items-center gap-2">
              <span className="text-lg">🏢</span>
              <h2 className="font-heading font-bold text-slate-900">Business Details</h2>
            </div>
            {[
              { label: 'Company', value: profile.company_name },
              { label: 'GST Number', value: profile.gst_number, mono: true },
              { label: 'Billing Address', value: profile.billing_address },
              { label: 'Email', value: profile.email },
              { label: 'Phone', value: profile.phone },
            ].filter((r) => r.value).map((row, i, arr) => (
              <div
                key={row.label}
                className={`px-4 py-3 flex justify-between items-start gap-4 ${i < arr.length - 1 ? 'border-b border-slate-100' : 'pb-4'}`}
              >
                <span className="text-slate-400 text-sm flex-shrink-0">{row.label}</span>
                <span className={`text-slate-900 text-sm font-semibold text-right ${row.mono ? 'font-mono' : ''}`}>{row.value}</span>
              </div>
            ))}
          </div>
        )}

        {/* Quick links */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          {[
            { href: '/mobile/orders', emoji: '📦', label: 'My Orders' },
            { href: '/mobile/products', emoji: '🛍️', label: 'Browse Marketplace' },
          ].map((item, i, arr) => (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3.5 ${i < arr.length - 1 ? 'border-b border-slate-100' : ''}`}
            >
              <span className="text-xl">{item.emoji}</span>
              <span className="flex-1 font-semibold text-slate-900 text-sm">{item.label}</span>
              <span className="text-slate-300 text-xl">›</span>
            </Link>
          ))}
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="w-full border-2 border-rose-200 text-rose-600 font-bold rounded-2xl py-3.5 text-base"
        >
          Log Out
        </button>

        <p className="text-center text-slate-400 text-xs pb-2">PrimeServe v1.0 · Made with ♥ in India</p>
      </div>
    </div>
  );
}
