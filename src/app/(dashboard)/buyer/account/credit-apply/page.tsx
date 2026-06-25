import Link from 'next/link';
import {
  BadgeCheck, Zap, TrendingUp, Building2, ArrowRight, MessageCircle,
  FilePlus2, ShieldCheck, Video, CheckCircle2, FileText, Check,
  CalendarClock,
} from 'lucide-react';

// ─── Static content ─────────────────────────────────────────────────────────

const BENEFITS = [
  { Icon: Zap,         title: 'Buy Now, Pay Later',  body: 'Order today and pay up to 45 days after delivery — keep your working capital free.' },
  { Icon: TrendingUp,  title: 'Expand Procurement',  body: 'Stock more locations and scale faster without tying up upfront cash on supplies.' },
  { Icon: Building2,   title: 'Track Per Branch',    body: 'One consolidated invoice each month, neatly broken down by branch and location.' },
];

const STEPS = [
  { Icon: FilePlus2,   title: 'Start your application', body: 'Click Apply Now and confirm your company & applicant details — most of it is pre-filled.' },
  { Icon: FileText,    title: 'Add your KYC',          body: 'Enter your GST, PAN and CIN/LLP numbers and upload the matching documents.' },
  { Icon: ShieldCheck, title: 'Verification & call',   body: 'We verify your documents and have a short credit discussion over Zoom or a call.' },
  { Icon: BadgeCheck,  title: 'Get your credit line',  body: 'Once approved, your 45-day credit line is activated and ready to use.' },
];

const REQUIRED_DOCS = [
  'GST Registration Certificate',
  'PAN Card (Company)',
  'CIN / LLP Deed',
  '6-Month Bank Statement',
];

const OPTIONAL_DOCS = [
  'MSME / Udyam Certificate',
  'Last 2 Years ITR',
];

const TIMELINE = [
  { Icon: CheckCircle2, label: 'Application Submitted', sub: 'We receive your details instantly' },
  { Icon: ShieldCheck,  label: 'Document Verification', sub: 'Under 24 hours' },
  { Icon: Video,        label: 'Credit Discussion',     sub: 'Zoom or call — within the next 24 hours' },
  { Icon: BadgeCheck,   label: 'Credit Term Approved',  sub: 'Your credit line is activated' },
];

// ─── Reusable CTAs ──────────────────────────────────────────────────────────

function ApplyButton() {
  return (
    <Link
      href="/buyer/account/credit-apply/start"
      className="ps-credit-cta inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-teal-500/20 transition-colors hover:bg-teal-700"
    >
      Apply Now <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

function EnquireButton() {
  return (
    <Link
      href="/contact"
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50"
    >
      <MessageCircle className="h-4 w-4" /> Enquire about credit terms
    </Link>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CreditApplyInfoPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-10 px-4 py-6 sm:px-6">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col gap-6 border-b border-slate-200 pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-2xl">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-teal-700">
            <BadgeCheck className="h-3.5 w-3.5" /> Primeserve Credit
          </span>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-900">Buy now, pay in 45 days</h1>
          <p className="mt-2 text-base leading-relaxed text-slate-600">
            Apply for a Primeserve credit line and order housekeeping supplies without upfront cash.
            Free up your working capital, stock every branch, and settle with one simple invoice each month.
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col xl:flex-row">
          <ApplyButton />
          <EnquireButton />
        </div>
      </div>

      {/* ── Benefits ────────────────────────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-bold text-slate-900">Why apply for credit?</h2>
        <p className="mb-5 mt-0.5 text-sm text-slate-500">The benefits that make Primeserve credit our customers&apos; favourite feature.</p>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {BENEFITS.map(({ Icon, title, body }) => (
            <div key={title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                <Icon className="h-5 w-5" />
              </div>
              <p className="mt-4 text-base font-bold text-slate-900">{title}</p>
              <p className="mt-1 text-sm leading-relaxed text-slate-500">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How to apply — flow diagram ─────────────────────────────────── */}
      <section>
        <h2 className="text-lg font-bold text-slate-900">How to apply — 4 simple steps</h2>
        <p className="mb-5 mt-0.5 text-sm text-slate-500">A clear path from application to an active credit line.</p>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
          {STEPS.map(({ Icon, title, body }, i) => (
            <div key={title} className="flex items-stretch gap-3 lg:flex-1 lg:flex-col">
              <div className="flex-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <span className="text-xs font-bold uppercase tracking-widest text-teal-600">Step {i + 1}</span>
                </div>
                <p className="mt-3 text-sm font-bold text-slate-900">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-slate-500">{body}</p>
              </div>
              {i < STEPS.length - 1 && (
                <div className="flex items-center justify-center text-slate-300">
                  <ArrowRight className="h-5 w-5 rotate-90 lg:rotate-0" />
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── Documents + Timeline ────────────────────────────────────────── */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Important documents */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-teal-100 bg-teal-50 text-teal-600">
              <FileText className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Important Documents You Will Need</h2>
              <p className="text-xs text-slate-500">Keep these ready before you start</p>
            </div>
          </div>

          <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Required</p>
          <ul className="mb-5 space-y-2.5">
            {REQUIRED_DOCS.map((doc) => (
              <li key={doc} className="flex items-center gap-2.5">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-100"><Check className="h-3 w-3 text-teal-600" /></span>
                <span className="text-sm text-slate-700">{doc}</span>
              </li>
            ))}
          </ul>

          <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Optional (strengthens your application)</p>
          <ul className="space-y-2.5">
            {OPTIONAL_DOCS.map((doc) => (
              <li key={doc} className="flex items-center gap-2.5">
                <span className="h-5 w-5 shrink-0 rounded-full border-2 border-slate-200" />
                <span className="text-sm text-slate-500">{doc}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Approval timeline */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-teal-100 bg-teal-50 text-teal-600">
              <CalendarClock className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Approval timeline</h2>
              <p className="text-xs text-slate-500">What to expect after you apply</p>
            </div>
          </div>

          <ol className="relative space-y-4 pl-2">
            <div className="absolute left-4.5 top-2 bottom-2 w-px bg-slate-200" />
            {TIMELINE.map(({ Icon, label, sub }, i) => (
              <li key={label} className="relative flex items-start gap-3">
                <div className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${i === 0 ? 'border-teal-200 bg-teal-50 text-teal-600' : 'border-slate-200 bg-white text-slate-400'}`}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="pt-1">
                  <p className="text-sm font-semibold text-slate-900">{label}</p>
                  <p className="text-xs text-slate-500">{sub}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── Bottom CTA (highlighted, light) ─────────────────────────────── */}
      <div className="flex flex-col items-center gap-5 rounded-2xl border border-teal-200 bg-teal-50 p-6 text-center sm:flex-row sm:justify-between sm:text-left">
        <div>
          <h2 className="text-lg font-bold text-slate-900">Ready to unlock 45-day credit?</h2>
          <p className="mt-0.5 text-sm text-slate-600">Apply in minutes, or talk to us first about the terms that suit your business.</p>
        </div>
        <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
          <ApplyButton />
          <EnquireButton />
        </div>
      </div>
    </div>
  );
}
