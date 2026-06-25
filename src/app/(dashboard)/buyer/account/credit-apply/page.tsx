import Link from 'next/link';
import {
  BadgeCheck, Zap, TrendingUp, Building2, ArrowRight, MessageCircle,
  FilePlus2, ShieldCheck, Video, CheckCircle2, FileText, Check,
  CalendarClock, Sparkles,
} from 'lucide-react';

// ─── Static content ─────────────────────────────────────────────────────────

const BENEFITS = [
  { Icon: Zap,         title: 'Buy Now, Pay Later',  body: 'Order today and pay up to 45 days after delivery — keep your working capital free.' },
  { Icon: TrendingUp,  title: 'Expand Procurement',  body: 'Stock more locations and scale faster without tying up upfront cash on supplies.' },
  { Icon: Building2,   title: 'Track Per Branch',    body: 'One consolidated invoice each month, neatly broken down by branch and location.' },
];

const STEPS = [
  { Icon: FilePlus2,     title: 'Start your application', body: 'Click Apply Now and confirm your company & applicant details — most of it is pre-filled.' },
  { Icon: FileText,      title: 'Add your KYC',          body: 'Enter your GST, PAN and CIN/LLP numbers and upload the matching documents.' },
  { Icon: ShieldCheck,   title: 'Verification & call',   body: 'We verify your documents and have a short credit discussion over Zoom or a call.' },
  { Icon: BadgeCheck,    title: 'Get your credit line',  body: 'Once approved, your 45-day credit line is activated and ready to use.' },
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
      className="ps-credit-cta inline-flex items-center justify-center gap-2 rounded-xl bg-teal-500 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-teal-500/30 transition-colors hover:bg-teal-400"
    >
      Apply Now <ArrowRight className="h-4 w-4" />
    </Link>
  );
}

function EnquireButton() {
  return (
    <Link
      href="/contact"
      className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/5 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/10"
    >
      <MessageCircle className="h-4 w-4" /> Enquire about credit terms
    </Link>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function CreditApplyInfoPage() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <div className="relative overflow-hidden rounded-3xl bg-linear-to-br from-slate-900 via-slate-900 to-teal-950 p-6 sm:p-10">
        {/* Decorative glows */}
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-24 h-96 w-96 rounded-full bg-teal-600/10 blur-3xl" />

        <div className="relative space-y-12">
          {/* ── Hero ─────────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
            <div className="max-w-2xl ps-slide-up">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-400/30 bg-teal-500/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-teal-300 backdrop-blur-sm">
                <BadgeCheck className="h-3.5 w-3.5" /> Primeserve Credit
              </span>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-white sm:text-4xl">
                Buy now, pay in 45 days
              </h1>
              <p className="mt-3 text-base leading-relaxed text-slate-300">
                Apply for a Primeserve credit line and order housekeeping supplies without upfront cash.
                Free up your working capital, stock every branch, and settle with one simple invoice each month.
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
              <ApplyButton />
              <EnquireButton />
            </div>
          </div>

          {/* ── Benefits ─────────────────────────────────────────────────── */}
          <section>
            <h2 className="mb-1 text-lg font-bold text-white">Why apply for credit?</h2>
            <p className="mb-5 text-sm text-slate-400">The benefits that make Primeserve credit our customers&apos; favourite feature.</p>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {BENEFITS.map(({ Icon, title, body }) => (
                <div key={title} className="ps-slide-up rounded-2xl border border-white/10 bg-white/4 p-5 backdrop-blur-sm transition-colors hover:border-teal-400/30 hover:bg-teal-500/[0.07]">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-teal-400/30 bg-teal-500/15 text-teal-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-base font-bold text-white">{title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">{body}</p>
                </div>
              ))}
            </div>
          </section>

          {/* ── How to apply — flow diagram ──────────────────────────────── */}
          <section>
            <h2 className="mb-1 text-lg font-bold text-white">How to apply — 4 simple steps</h2>
            <p className="mb-5 text-sm text-slate-400">A clear path from application to an active credit line.</p>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-stretch">
              {STEPS.map(({ Icon, title, body }, i) => (
                <div key={title} className="flex items-stretch gap-3 lg:flex-1 lg:flex-col">
                  <div className="ps-slide-up flex-1 rounded-2xl border border-white/10 bg-white/4 p-5 backdrop-blur-sm">
                    <div className="flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-500 text-white">
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <span className="text-xs font-bold uppercase tracking-widest text-teal-300">Step {i + 1}</span>
                    </div>
                    <p className="mt-3 text-sm font-bold text-white">{title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-slate-400">{body}</p>
                  </div>
                  {/* Arrow connector */}
                  {i < STEPS.length - 1 && (
                    <div className="flex items-center justify-center text-teal-400/70">
                      <ArrowRight className="h-5 w-5 rotate-90 lg:rotate-0" />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>

          {/* ── Documents + Timeline ─────────────────────────────────────── */}
          <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {/* Important documents */}
            <div className="ps-slide-up rounded-2xl border border-white/10 bg-white/4 p-6 backdrop-blur-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-teal-400/30 bg-teal-500/15 text-teal-300">
                  <FileText className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Important Documents You Will Need</h2>
                  <p className="text-xs text-slate-400">Keep these ready before you start</p>
                </div>
              </div>

              <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-teal-300">Required</p>
              <ul className="mb-5 space-y-2.5">
                {REQUIRED_DOCS.map((doc) => (
                  <li key={doc} className="flex items-center gap-2.5">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-teal-500/20"><Check className="h-3 w-3 text-teal-300" /></span>
                    <span className="text-sm text-slate-200">{doc}</span>
                  </li>
                ))}
              </ul>

              <p className="mb-2.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400">Optional (strengthens your application)</p>
              <ul className="space-y-2.5">
                {OPTIONAL_DOCS.map((doc) => (
                  <li key={doc} className="flex items-center gap-2.5">
                    <span className="h-5 w-5 shrink-0 rounded-full border-2 border-white/15" />
                    <span className="text-sm text-slate-400">{doc}</span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Approval timeline */}
            <div className="ps-slide-up rounded-2xl border border-white/10 bg-white/4 p-6 backdrop-blur-sm">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-teal-400/30 bg-teal-500/15 text-teal-300">
                  <CalendarClock className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-white">Approval timeline</h2>
                  <p className="text-xs text-slate-400">What to expect after you apply</p>
                </div>
              </div>

              <ol className="relative space-y-4 pl-2">
                <div className="absolute left-4.5 top-2 bottom-2 w-px bg-white/10" />
                {TIMELINE.map(({ Icon, label, sub }, i) => (
                  <li key={label} className="relative flex items-start gap-3">
                    <div className={`relative z-10 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border ${i === 0 ? 'border-teal-400/40 bg-teal-500/20 text-teal-300' : 'border-white/10 bg-slate-900 text-slate-400'}`}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="pt-1">
                      <p className="text-sm font-semibold text-white">{label}</p>
                      <p className="text-xs text-slate-400">{sub}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </section>

          {/* ── Bottom CTA ───────────────────────────────────────────────── */}
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-teal-400/30 bg-teal-500/10 p-6 text-center backdrop-blur-sm sm:flex-row sm:justify-between sm:text-left">
            <div className="flex items-center gap-3">
              <Sparkles className="hidden h-6 w-6 text-teal-300 sm:block" />
              <div>
                <h2 className="text-lg font-bold text-white">Ready to unlock 45-day credit?</h2>
                <p className="mt-0.5 text-sm text-slate-300">Apply in minutes, or talk to us first about the terms that suit your business.</p>
              </div>
            </div>
            <div className="flex shrink-0 flex-col gap-3 sm:flex-row">
              <ApplyButton />
              <EnquireButton />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
