'use client';

import {
  ButtonLink,
  Card,
  DarkCard,
  MobilePage,
  RequireAuth,
  ScreenHeader,
  mobileIcons,
} from '@/components/mobile/PrimeserveMobile';

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

function CreditsContent() {
  return (
    <MobilePage>
      <ScreenHeader title="Credits" subtitle="45-day B2B payment terms" variant="dark" />

      <div className="space-y-5 px-5 py-5">
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
                      <p className="font-heading text-sm font-extrabold text-slate-900">
                        {step.title}
                      </p>
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
          <h2 className="mb-3 font-heading text-xl font-extrabold text-slate-900">
            Why use credit terms?
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {BENEFITS.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <Card key={benefit.title} className="p-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-2xl bg-[rgba(20,184,166,0.14)]">
                    <Icon className="h-4 w-4 text-[#0D9488]" />
                  </div>
                  <p className="mt-3 font-heading text-sm font-extrabold text-slate-900">
                    {benefit.title}
                  </p>
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
