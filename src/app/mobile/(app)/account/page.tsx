'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  Badge,
  ButtonLink,
  Card,
  LoadingScreen,
  MobilePage,
  RequireAuth,
  ScreenHeader,
  mobileIcons,
  useAuthStatus,
} from '@/components/mobile/PrimeserveMobile';
import { formatINR } from '@/lib/utils/formatting';

interface Profile {
  full_name: string;
  email: string | null;
  phone: string | null;
  company_name: string | null;
  client_name: string | null;
  branch_name: string | null;
  gst_number: string | null;
  billing_address: string | null;
}

interface Credit {
  status: 'pending' | 'active' | 'suspended';
  outstanding: number;
  due_soon: number;
  overdue: number;
}

const MENU_ITEMS = [
  { href: '/mobile/orders', label: 'My Orders', icon: mobileIcons.Box },
  { href: '/mobile/credits', label: 'Credit Terms', icon: mobileIcons.WalletCards },
  { href: '/mobile/products', label: 'Browse Marketplace', icon: mobileIcons.ShoppingCart },
  { href: '/mobile/categories', label: 'All Categories', icon: mobileIcons.Grid3X3 },
  { href: '/mobile/home', label: 'Help & Support', icon: mobileIcons.BadgeCheck },
  { href: '/mobile/home', label: 'Settings', icon: mobileIcons.Lock },
];

function InitialAvatar({ name }: { name: string }) {
  const initial = name.trim().charAt(0).toUpperCase() || 'P';
  return (
    <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-white/20 bg-white/20">
      <span className="font-heading text-3xl font-extrabold text-white">{initial}</span>
    </div>
  );
}

function AccountContent() {
  const router = useRouter();
  const { user } = useAuthStatus();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [credit, setCredit] = useState<Credit | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/buyer/profile').then((r) => r.json()).catch(() => null),
      fetch('/api/buyer/credit').then((r) => r.json()).catch(() => null),
    ])
      .then(([profileData, creditData]) => {
        setProfile(profileData?.data ?? null);
        setCredit(creditData?.data ?? null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/mobile/home');
  }

  if (loading) return <LoadingScreen label="Loading account" />;

  const displayName = profile?.full_name ?? user?.full_name ?? 'PrimeServe buyer';
  const company =
    profile?.client_name || profile?.company_name || user?.company_name || 'Business account';
  const branch = profile?.branch_name;

  return (
    <MobilePage>
      <ScreenHeader title="My Account" subtitle="Business profile and order access" variant="dark" />

      <div className="space-y-5 px-5 py-5">
        {/* Profile hero with initial avatar */}
        <div className="rounded-[28px] bg-[radial-gradient(100%_100%_at_90%_0%,rgba(94,234,212,0.28)_0%,rgba(20,184,166,0)_55%),linear-gradient(160deg,#0D9488_0%,#0B1220_100%)] p-5 text-white">
          <InitialAvatar name={displayName} />
          <h1 className="mt-4 font-heading text-3xl font-extrabold leading-tight">
            {displayName}
          </h1>
          <p className="mt-1 text-base font-medium text-slate-200">
            {company}
            {branch ? ` — ${branch}` : ''}
          </p>
          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-extrabold">
            <mobileIcons.CreditCard className="h-4 w-4" />
            45-day credit terms
          </div>
        </div>

        {/* Credit summary */}
        <div className="grid grid-cols-3 gap-2">
          {[
            {
              label: 'Credit',
              value: credit?.status ?? 'pending',
              tone:
                credit?.status === 'active' ? 'text-[#0D9488]' : 'text-amber-600',
            },
            { label: 'Outstanding', value: formatINR(credit?.outstanding ?? 0), tone: 'text-slate-900' },
            { label: 'Overdue', value: formatINR(credit?.overdue ?? 0), tone: 'text-rose-600' },
          ].map((item) => (
            <Card key={item.label} className="p-3 text-center">
              <p className="text-[10px] font-extrabold uppercase tracking-[0.13em] text-slate-400">
                {item.label}
              </p>
              <p className={`mt-2 truncate font-heading text-xs font-extrabold ${item.tone}`}>
                {item.value}
              </p>
            </Card>
          ))}
        </div>

        {/* Business details */}
        <Card className="overflow-hidden">
          <div className="p-4">
            <h2 className="font-heading text-xl font-extrabold text-slate-900">Business details</h2>
          </div>
          {[
            { label: 'Company', value: profile?.company_name || profile?.client_name },
            { label: 'GST Number', value: profile?.gst_number },
            { label: 'Billing Address', value: profile?.billing_address },
            { label: 'Email', value: profile?.email ?? user?.email },
            { label: 'Phone', value: profile?.phone ?? user?.phone },
          ]
            .filter((row) => row.value)
            .map((row) => (
              <div key={row.label} className="flex gap-4 border-t border-slate-100 px-4 py-3">
                <span className="w-28 shrink-0 text-sm font-semibold text-slate-400">
                  {row.label}
                </span>
                <span className="min-w-0 flex-1 text-right text-sm font-extrabold text-slate-900">
                  {row.value}
                </span>
              </div>
            ))}
        </Card>

        {/* Expanded menu */}
        <Card className="overflow-hidden">
          {MENU_ITEMS.map((item, index) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`ps-press flex items-center gap-3 px-4 py-4 ${index > 0 ? 'border-t border-slate-100' : ''}`}
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[rgba(20,184,166,0.14)]">
                  <Icon className="h-5 w-5 text-[#0D9488]" />
                </span>
                <span className="flex-1 font-heading text-base font-extrabold text-slate-900">
                  {item.label}
                </span>
                <mobileIcons.ArrowRight className="h-4 w-4 text-slate-300" />
              </Link>
            );
          })}
        </Card>

        {/* App info */}
        <div className="rounded-2xl border border-[rgba(45,212,191,0.28)] bg-[rgba(20,184,166,0.10)] p-4">
          <div className="flex items-center gap-2">
            <Badge>PrimeServe</Badge>
            <span className="text-xs font-bold text-slate-500">Mobile app v1.0</span>
          </div>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            Need profile updates or credit activation? Contact your PrimeServe admin.
          </p>
        </div>

        <button
          type="button"
          onClick={handleLogout}
          className="ps-press h-14 w-full rounded-2xl border border-rose-200 py-3.5 font-heading text-base font-extrabold text-rose-600"
        >
          Log out
        </button>

        <ButtonLink href="/mobile/products" className="w-full">
          Browse catalog
        </ButtonLink>
      </div>
    </MobilePage>
  );
}

export default function MobileAccountPage() {
  return (
    <RequireAuth>
      <AccountContent />
    </RequireAuth>
  );
}
