'use client';

import { useEffect, useState } from 'react';
import {
  ButtonLink,
  Card,
  DarkCard,
  MobilePage,
  RequireAuth,
  ScreenHeader,
  mobileIcons,
} from '@/components/mobile/PrimeserveMobile';
import { formatINR } from '@/lib/utils/formatting';

const HOW_IT_WORKS = [
  {
    title: 'Place an eligible order',
    body: 'Choose credit terms during checkout for business purchases over ₹500.',
    icon: mobileIcons.ShoppingCart,
  },
  {
    title: 'Receive a GST invoice',
    body: 'A full tax invoice with your GSTIN is generated for every credit purchase.',
    icon: mobileIcons.BadgeCheck,
  },
  {
    title: 'Settle within 45 days',
    body: 'Payment becomes due 45 days from the date of delivery confirmation.',
    icon: mobileIcons.CreditCard,
  },
];

const BENEFITS = [
  {
    icon: mobileIcons.Zap,
    title: 'Zero interest',
    body: 'Pay on time and never owe a paisa more than your invoice value.',
  },
  {
    icon: mobileIcons.ShieldCheck,
    title: 'GST-compliant',
    body: 'Every credit purchase generates a full tax invoice with GSTIN for clean ITC.',
  },
  {
    icon: mobileIcons.BadgeCheck,
    title: 'No hidden fees',
    body: 'What you see on the invoice is exactly what you pay. Always.',
  },
  {
    icon: mobileIcons.Star,
    title: 'Verified vendors',
    body: 'All products are sourced from PrimeServe-verified vendors only.',
  },
];

const CREDIT_TERMS = [
  ['Payment window', '45 days from delivery'],
  ['Interest', '0% if paid on time'],
  ['Late fee', '1.5% per month'],
  ['Invoicing', 'GST-compliant tax invoice'],
  ['Minimum order', '₹500 order value'],
];

type ApplicationStatus =
  | 'draft'
  | 'submitted'
  | 'under_review'
  | 'documents_verified'
  | 'meeting_scheduled'
  | 'approved'
  | 'rejected';

interface CreditApplication {
  id: string;
  status: ApplicationStatus;
  current_step: number | null;
  submitted_at: string | null;
  reviewed_at: string | null;
}

interface CreditAccount {
  id: string | null;
  status: 'pending' | 'active' | 'suspended';
  credit_limit: number | null;
  outstanding: number;
  due_soon: number;
  overdue: number;
}

const APPLICATION_STEPS: { key: ApplicationStatus; label: string }[] = [
  { key: 'submitted', label: 'Application submitted' },
  { key: 'under_review', label: 'Under review' },
  { key: 'documents_verified', label: 'Documents verified' },
  { key: 'meeting_scheduled', label: 'Meeting scheduled' },
  { key: 'approved', label: 'Approved' },
];

function stepIndex(status: ApplicationStatus) {
  return APPLICATION_STEPS.findIndex((s) => s.key === status);
}

function StatusBadge({ status }: { status: ApplicationStatus | 'active' | 'pending' | 'suspended' }) {
  const map: Record<string, { label: string; color: string }> = {
    draft: { label: 'Draft', color: 'bg-slate-100 text-slate-500' },
    submitted: { label: 'Submitted', color: 'bg-sky-50 text-sky-700' },
    under_review: { label: 'Under Review', color: 'bg-amber-50 text-amber-700' },
    documents_verified: { label: 'Docs Verified', color: 'bg-teal-50 text-teal-700' },
    meeting_scheduled: { label: 'Meeting Set', color: 'bg-purple-50 text-purple-700' },
    approved: { label: 'Approved', color: 'bg-emerald-50 text-emerald-700' },
    rejected: { label: 'Rejected', color: 'bg-rose-50 text-rose-700' },
    active: { label: 'Active', color: 'bg-emerald-50 text-emerald-700' },
    pending: { label: 'Pending', color: 'bg-amber-50 text-amber-700' },
    suspended: { label: 'Suspended', color: 'bg-rose-50 text-rose-700' },
  };
  const { label, color } = map[status] ?? { label: status, color: 'bg-slate-100 text-slate-500' };
  return (
    <span className={`rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide ${color}`}>
      {label}
    </span>
  );
}

function ApplicationTimeline({ status }: { status: ApplicationStatus }) {
  const current = stepIndex(status);
  return (
    <div className="mt-4 space-y-3">
      {APPLICATION_STEPS.map((step, i) => {
        const done = i <= current;
        const active = i === current;
        return (
          <div key={step.key} className="flex items-center gap-3">
            <div
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold ${
                done
                  ? active
                    ? 'bg-[#14B8A6] text-white'
                    : 'bg-[rgba(20,184,166,0.18)] text-[#0D9488]'
                  : 'bg-slate-100 text-slate-300'
              }`}
            >
              {done && !active ? (
                <mobileIcons.BadgeCheck className="h-4 w-4" />
              ) : (
                i + 1
              )}
            </div>
            <span className={`text-sm font-bold ${done ? 'text-slate-800' : 'text-slate-300'}`}>
              {step.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function CreditsContent() {
  const [application, setApplication] = useState<CreditApplication | null | undefined>(undefined);
  const [account, setAccount] = useState<CreditAccount | null | undefined>(undefined);
  const [loadingStatus, setLoadingStatus] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/buyer/credit-application').then((r) => (r.ok ? r.json() : null)).catch(() => null),
      fetch('/api/buyer/credit').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]).then(([appData, creditData]) => {
      setApplication(appData?.data ?? null);
      setAccount(creditData?.data ?? null);
      setLoadingStatus(false);
    });
  }, []);

  const appStatus = application?.status;
  const isApproved = account?.status === 'active' || appStatus === 'approved';
  const isRejected = appStatus === 'rejected';
  const hasApplied = !!application && appStatus !== 'draft';
  const isDraft = appStatus === 'draft';

  return (
    <MobilePage>
      <ScreenHeader title="Credits" subtitle="45-day B2B payment terms" variant="dark" />

      <div className="space-y-5 px-5 py-5">
        {/* ── Credit status card (synced from web) ── */}
        {loadingStatus ? (
          <Card className="flex items-center gap-3 p-4">
            <mobileIcons.CreditCard className="h-5 w-5 animate-pulse text-slate-300" />
            <span className="text-sm font-semibold text-slate-400">Checking your credit status…</span>
          </Card>
        ) : isApproved ? (
          /* Approved — show live account stats */
          <Card className="overflow-hidden">
            <div className="border-b border-slate-100 p-4">
              <div className="flex items-center justify-between">
                <p className="font-heading text-base font-extrabold text-slate-900">Your Credit Account</p>
                <StatusBadge status="active" />
              </div>
              {account?.credit_limit && (
                <p className="mt-1 text-xs font-semibold text-slate-400">
                  Credit limit: <span className="font-extrabold text-slate-700">{formatINR(account.credit_limit)}</span>
                </p>
              )}
            </div>
            <div className="grid grid-cols-3 divide-x divide-slate-100">
              {[
                { label: 'Outstanding', value: formatINR(account?.outstanding ?? 0) },
                { label: 'Due in 7d', value: formatINR(account?.due_soon ?? 0) },
                { label: 'Overdue', value: formatINR(account?.overdue ?? 0), alert: (account?.overdue ?? 0) > 0 },
              ].map(({ label, value, alert }) => (
                <div key={label} className="p-3 text-center">
                  <p className={`font-heading text-sm font-extrabold ${alert ? 'text-rose-600' : 'text-slate-900'}`}>
                    {value}
                  </p>
                  <p className="mt-0.5 text-[10px] font-semibold text-slate-400">{label}</p>
                </div>
              ))}
            </div>
          </Card>
        ) : isRejected ? (
          /* Rejected */
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-rose-50">
                <mobileIcons.ShieldCheck className="h-5 w-5 text-rose-500" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-heading text-sm font-extrabold text-slate-900">Application not approved</p>
                  <StatusBadge status="rejected" />
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  Please contact your PrimeServe account manager to discuss your application.
                </p>
                <a
                  href="mailto:support@primeserve.in"
                  className="mt-3 inline-flex items-center gap-1.5 text-sm font-extrabold text-[#0D9488]"
                >
                  Contact support
                  <mobileIcons.ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </Card>
        ) : hasApplied ? (
          /* Application in progress — show timeline */
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <p className="font-heading text-base font-extrabold text-slate-900">Application status</p>
              {appStatus && <StatusBadge status={appStatus} />}
            </div>
            <p className="mt-1 text-xs font-semibold text-slate-400">
              Applied from web — tracking your progress below
            </p>
            {appStatus && <ApplicationTimeline status={appStatus} />}
          </Card>
        ) : isDraft ? (
          /* Started on web but not submitted */
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-amber-50">
                <mobileIcons.WalletCards className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <p className="font-heading text-sm font-extrabold text-slate-900">Application in draft</p>
                <p className="mt-1 text-sm text-slate-500">
                  You started a credit application on the web. Complete it to get approved.
                </p>
                <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                  Visit <span className="font-extrabold text-slate-700">primeserve.in</span> on desktop to submit your documents.
                </p>
              </div>
            </div>
          </Card>
        ) : (
          /* No application at all */
          <Card className="p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[rgba(20,184,166,0.12)]">
                <mobileIcons.WalletCards className="h-5 w-5 text-[#0D9488]" />
              </div>
              <div className="flex-1">
                <p className="font-heading text-sm font-extrabold text-slate-900">Apply for credit terms</p>
                <p className="mt-1 text-sm text-slate-500">
                  Get approved for 45-day credit. Apply via the web app — your status will appear here automatically.
                </p>
                <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                  Open <span className="font-extrabold text-slate-700">primeserve.in</span> on desktop and go to <span className="font-extrabold">Credits → Apply</span>.
                </p>
              </div>
            </div>
          </Card>
        )}

        {/* Hero card */}
        <DarkCard className="relative overflow-hidden p-5">
          <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-[#14B8A6]/20 blur-2xl" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 rounded-full border border-[rgba(45,212,191,0.28)] bg-white/10 px-3 py-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#2DD4BF]" />
              <span className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#5EEAD4]">
                Active for all buyers
              </span>
            </div>
            <h1 className="mt-4 font-heading text-3xl font-extrabold leading-tight text-white">
              Buy today,
              <br />
              pay within <span className="text-[#2DD4BF]">45 days</span>
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              PrimeServe&apos;s 45-day credit terms are built for recurring B2B procurement.
              Place orders today and settle invoices at the end of your billing cycle.
            </p>
          </div>
        </DarkCard>

        {/* How it works */}
        <Card className="p-4">
          <h2 className="font-heading text-xl font-extrabold text-slate-900">How it works</h2>
          <p className="mt-1 text-xs font-semibold text-slate-400">Three simple steps</p>
          <div className="mt-4 space-y-4">
            {HOW_IT_WORKS.map((step, index) => {
              const Icon = step.icon;
              return (
                <div key={step.title} className="flex gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[rgba(20,184,166,0.14)] font-heading text-sm font-extrabold text-[#0D9488]">
                    {index + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-[#0D9488]" />
                      <p className="font-heading text-sm font-extrabold text-slate-900">{step.title}</p>
                    </div>
                    <p className="mt-1 text-sm leading-6 text-slate-500">{step.body}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>

        {/* Benefits grid */}
        <div>
          <h2 className="mb-3 font-heading text-xl font-extrabold text-slate-900">Why use credit terms?</h2>
          <div className="grid grid-cols-2 gap-3">
            {BENEFITS.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <Card key={benefit.title} className="p-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[rgba(20,184,166,0.14)]">
                    <Icon className="h-4 w-4 text-[#0D9488]" />
                  </div>
                  <p className="mt-3 font-heading text-sm font-extrabold text-slate-900">{benefit.title}</p>
                  <p className="mt-1 text-[11px] leading-5 text-slate-500">{benefit.body}</p>
                </Card>
              );
            })}
          </div>
        </div>

        {/* Credit terms table */}
        <Card className="overflow-hidden">
          <div className="border-b border-slate-100 p-4">
            <h2 className="font-heading text-base font-extrabold text-slate-900">Credit terms</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {CREDIT_TERMS.map(([label, value]) => (
              <div key={label} className="flex items-center justify-between px-4 py-3">
                <span className="text-sm font-semibold text-slate-500">{label}</span>
                <span className="text-right text-sm font-extrabold text-slate-900">{value}</span>
              </div>
            ))}
          </div>
        </Card>

        <ButtonLink href="/mobile/products" className="w-full">
          Browse products
        </ButtonLink>
      </div>
    </MobilePage>
  );
}

export default function MobileCreditsPage() {
  return (
    <RequireAuth>
      <CreditsContent />
    </RequireAuth>
  );
}
