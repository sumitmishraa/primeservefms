import Link from 'next/link';
import {
  BadgeCheck, Zap, TrendingUp, FileCheck, MessageCircle, ArrowRight,
  CalendarClock, Building2, Receipt, ShieldCheck, FileText, Check,
} from 'lucide-react';

// ─── Static content ─────────────────────────────────────────────────────────

const BENEFITS = [
  {
    Icon: Zap,
    tint: 'bg-teal-50 text-teal-600',
    title: 'Buy Now, Pay Later',
    body: 'Place orders today and pay up to 45 days after delivery — keep your working capital free.',
  },
  {
    Icon: TrendingUp,
    tint: 'bg-blue-50 text-blue-600',
    title: 'Expand Procurement',
    body: 'Stock more locations and scale faster without tying up upfront cash on supplies.',
  },
  {
    Icon: Building2,
    tint: 'bg-purple-50 text-purple-600',
    title: 'Track Per Branch',
    body: 'Get consolidated invoices that are neatly broken down by branch and location.',
  },
];

const STEPS = [
  {
    Icon: FileText,
    title: 'Submit your application',
    body: 'Share a few business details and upload your KYC documents. It takes about 5 minutes.',
  },
  {
    Icon: ShieldCheck,
    title: 'We review it',
    body: 'Our team verifies your documents and approves your credit line within 3–5 business days.',
  },
  {
    Icon: CalendarClock,
    title: 'Order on 45-day terms',
    body: 'Once approved, shop the marketplace and pay later — 45 days from delivery.',
  },
  {
    Icon: Receipt,
    title: 'Pay at month-end',
    body: 'Receive one consolidated invoice each month, broken down by branch. Simple and clear.',
  },
];

const REQUIRED_DOCS = [
  'GST Registration Certificate',
  'PAN Card (Company or Director)',
  'CIN / LLP Deed',
  'Cancelled Cheque',
];

const OPTIONAL_DOCS = [
  'Last 2 years ITR',
  '6-month Bank Statement',
  'MSME / Udyam Certificate',
];

const TIMELINE = [
  { label: 'Application Submitted', sub: 'Immediately' },
  { label: 'Document Verification', sub: '1–2 business days' },
  { label: 'Credit Decision', sub: '3–5 business days' },
  { label: 'Credit Line Activated', sub: 'Upon approval' },
];

// ─── Reusable CTA buttons ────────────────────────────────────────────────────

function ApplyButton({ className = '' }: { className?: string }) {
  return (
    <Link
      href="/buyer/account/credit-apply/start"
      className={`inline-flex items-center justify-center gap-2 px-6 py-3 bg-teal-600 text-white text-sm font-bold rounded-xl hover:bg-teal-700 active:bg-teal-800 transition-colors shadow-lg shadow-teal-500/20 ${className}`}
    >
      Apply Now
      <ArrowRight className="w-4 h-4" />
    </Link>
  );
}

function EnquireButton({ className = '' }: { className?: string }) {
  return (
    <Link
      href="/contact"
      className={`inline-flex items-center justify-center gap-2 px-6 py-3 border border-slate-200 bg-white text-slate-700 text-sm font-semibold rounded-xl hover:bg-slate-50 hover:border-slate-300 transition-colors ${className}`}
    >
      <MessageCircle className="w-4 h-4" />
      Enquire about credit terms
    </Link>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CreditApplyInfoPage() {
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      {/* ── Hero header ─────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-teal-200 bg-linear-to-br from-teal-50 via-white to-white p-6 sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-600/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-teal-700">
              <BadgeCheck className="w-3.5 h-3.5" />
              Primeserve Credit
            </span>
            <h1 className="mt-3 text-2xl sm:text-3xl font-bold text-slate-900">
              Buy now, pay in 45 days
            </h1>
            <p className="mt-2 text-sm sm:text-base text-slate-600 leading-relaxed">
              Apply for a Primeserve credit line and order housekeeping supplies without
              upfront cash. Free up your working capital, stock every branch, and settle
              with one simple invoice each month.
            </p>
          </div>

          {/* CTAs — top right */}
          <div className="flex flex-col sm:flex-row gap-3 lg:flex-col lg:items-stretch shrink-0">
            <ApplyButton />
            <EnquireButton />
          </div>
        </div>
      </div>

      {/* ── Benefits ────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-bold text-slate-900 mb-1">Why apply for credit?</h2>
        <p className="text-sm text-slate-500 mb-5">The benefits that make Primeserve credit our customers&apos; favourite feature.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {BENEFITS.map(({ Icon, tint, title, body }) => (
            <div key={title} className="bg-white border border-slate-200 rounded-xl shadow-sm p-5">
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${tint}`}>
                <Icon className="w-5 h-5" />
              </div>
              <p className="mt-4 text-base font-bold text-slate-900">{title}</p>
              <p className="mt-1 text-sm text-slate-600 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-bold text-slate-900 mb-1">How to apply — 4 simple steps</h2>
        <p className="text-sm text-slate-500 mb-5">From application to your first credit order, here&apos;s the full journey.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {STEPS.map(({ Icon, title, body }, i) => (
            <div key={title} className="relative bg-white border border-slate-200 rounded-xl shadow-sm p-5">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-9 h-9 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0">
                  <Icon className="w-4.5 h-4.5" />
                </div>
                <span className="text-xs font-bold uppercase tracking-widest text-teal-600">
                  Step {i + 1}
                </span>
              </div>
              <p className="text-sm font-bold text-slate-900">{title}</p>
              <p className="mt-1 text-sm text-slate-600 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Documents + Timeline ───────────────────────────────────────── */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* What you'll need */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center">
              <FileCheck className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">What you&apos;ll need</h2>
              <p className="text-xs text-slate-500">Keep these ready before you start</p>
            </div>
          </div>

          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2.5">Required</p>
          <ul className="space-y-2.5 mb-5">
            {REQUIRED_DOCS.map((doc) => (
              <li key={doc} className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-teal-600" />
                </span>
                <span className="text-sm text-slate-700">{doc}</span>
              </li>
            ))}
          </ul>

          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-2.5">Optional (strengthens your application)</p>
          <ul className="space-y-2.5">
            {OPTIONAL_DOCS.map((doc) => (
              <li key={doc} className="flex items-center gap-2.5">
                <span className="w-5 h-5 rounded-full border-2 border-slate-200 shrink-0" />
                <span className="text-sm text-slate-500">{doc}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Approval timeline */}
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center">
              <CalendarClock className="w-5 h-5 text-teal-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Approval timeline</h2>
              <p className="text-xs text-slate-500">What to expect after you apply</p>
            </div>
          </div>

          <div className="relative pl-2">
            <div className="absolute left-1.75 top-2 bottom-2 w-px bg-slate-200" />
            {TIMELINE.map((step, i) => (
              <div key={step.label} className="relative flex items-start gap-4 pb-5 last:pb-0">
                <div className={`relative z-10 mt-0.5 w-3.5 h-3.5 rounded-full border-2 shrink-0 ${i === 0 ? 'border-teal-500 bg-teal-50' : 'border-slate-300 bg-white'}`} />
                <div>
                  <p className={`text-sm font-semibold ${i === 0 ? 'text-teal-600' : 'text-slate-700'}`}>{step.label}</p>
                  <p className="text-xs text-slate-400">{step.sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Bottom CTA band ────────────────────────────────────────────── */}
      <div className="rounded-2xl bg-linear-to-br from-teal-600 to-teal-700 p-6 sm:p-8 shadow-lg shadow-teal-500/20">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold text-white">Ready to unlock 45-day credit?</h2>
            <p className="mt-1 text-sm text-teal-50">
              Apply in minutes, or talk to us first about the terms that suit your business.
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 shrink-0">
            <Link
              href="/buyer/account/credit-apply/start"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white text-teal-700 text-sm font-bold rounded-xl hover:bg-teal-50 transition-colors"
            >
              Apply Now
              <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 border border-white/30 text-white text-sm font-semibold rounded-xl hover:bg-white/10 transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              Enquire about credit terms
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
