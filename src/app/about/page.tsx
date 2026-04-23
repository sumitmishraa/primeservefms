import Link from 'next/link';
import {
  ArrowRight,
  Target,
  Eye,
  HeartHandshake,
  Building2,
  Package,
  TrendingUp,
} from 'lucide-react';
import { PublicHeader, PublicFooter } from '@/components/layout';

const PILLARS = [
  {
    Icon: Target,
    title: 'Our Mission',
    body: 'Make B2B procurement transparent, predictable, and painless — so businesses spend less time chasing vendors and more time growing.',
  },
  {
    Icon: Eye,
    title: 'Our Vision',
    body: 'Become India’s most trusted supply-side platform for facility management, stationery, and pantry essentials.',
  },
  {
    Icon: HeartHandshake,
    title: 'Our Values',
    body: 'Fair pricing, honest margins, on-time delivery, and long-term partnerships over short-term wins.',
  },
];

const STATS = [
  { Icon: Building2, value: '100+', label: 'Businesses Served' },
  { Icon: Package, value: '500+', label: 'Products Listed' },
  { Icon: TrendingUp, value: '98%', label: 'On-Time Delivery' },
];

export default function AboutPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <PublicHeader />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950 px-4 py-20 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="relative mx-auto max-w-4xl text-center">
          <span className="mb-4 inline-block text-[11px] font-semibold uppercase tracking-wider text-teal-300">
            About PrimeServe
          </span>
          <h1 className="font-heading text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            Built by procurement teams,
            <br />
            <span className="text-teal-300">for procurement teams</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-300">
            PrimeServe was born from the chaos of managing 12 vendors for a
            single office. One dashboard. One invoice. One account manager.
            That&apos;s the promise.
          </p>
        </div>
      </section>

      {/* Mission / Vision / Values */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-3">
            {PILLARS.map(({ Icon, title, body }) => (
              <div
                key={title}
                className="flex flex-col rounded-2xl border border-slate-200 bg-white p-7"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-600">
                  <Icon className="h-6 w-6" />
                </div>
                <h2 className="font-heading text-xl font-bold text-slate-900">
                  {title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="border-y border-slate-100 bg-slate-50/60 py-16">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-4 sm:grid-cols-3">
            {STATS.map(({ Icon, value, label }) => (
              <div
                key={label}
                className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white p-8 text-center"
              >
                <Icon className="mb-3 h-8 w-8 text-teal-600" />
                <p className="font-heading text-3xl font-extrabold text-slate-900">
                  {value}
                </p>
                <p className="mt-1 text-sm text-slate-500">{label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Story */}
      <section className="py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
          <h2 className="font-heading text-3xl font-bold text-slate-900 sm:text-4xl">
            Our story
          </h2>
          <div className="mt-6 space-y-4 text-base leading-relaxed text-slate-600">
            <p>
              Every growing business hits the same wall: dozens of small
              vendors, inconsistent pricing, late deliveries, and invoices that
              never match the PO. Finance teams burn hours reconciling,
              admins spend days chasing WhatsApp replies, and founders lose
              sight of where the money is actually going.
            </p>
            <p>
              PrimeServe replaces that chaos with a single B2B marketplace.
              500+ professional-grade products, bulk pricing with full GST
              compliance, 45–60 day credit terms, and one point of contact who
              actually picks up the phone.
            </p>
            <p>
              We&apos;re building the kind of procurement platform we wished
              existed when we were on the other side of the invoice.
            </p>
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              href="/marketplace"
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-700"
            >
              Browse the Catalog
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/contact"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-6 py-3 text-sm font-semibold text-slate-700 hover:border-teal-500 hover:text-teal-600"
            >
              Get in Touch
            </Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
