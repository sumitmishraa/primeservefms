/**
 * Auth layout — split-screen for /login and /register.
 *
 * Desktop (lg+):
 *   Left half  — Dark teal panel with PrimeServe branding + feature cards
 *   Right half — White form area with optional dev-mode notice
 *
 * Mobile:
 *   Brand strip + form stacked vertically
 */

import Link from 'next/link';
import { Truck, ShieldCheck, CreditCard, ArrowLeft } from 'lucide-react';
import { PreviewDomainNotice } from '@/components/auth';

const FEATURES = [
  {
    Icon: Truck,
    title: 'Fast Delivery',
    body: 'Same-day delivery across the city',
  },
  {
    Icon: ShieldCheck,
    title: 'Secure Payments',
    body: '100% secure transactions',
  },
  {
    Icon: CreditCard,
    title: 'Business Credit',
    body: 'Flexible credit terms for businesses',
  },
] as const;

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* ─── Left panel ─────────────────────────────────────────── */}
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950 px-12 py-16 lg:flex lg:w-1/2 lg:flex-col lg:justify-center">
        {/* Decorative glows */}
        <div className="pointer-events-none absolute -top-24 -left-24 h-72 w-72 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-teal-500/10 blur-3xl" />

        <div className="relative z-10 max-w-md">
          {/* Logo */}
          <Link href="/" className="mb-10 inline-flex items-center gap-2">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-white font-heading text-lg font-bold text-slate-900">
              P
            </div>
            <span className="font-heading text-2xl font-bold tracking-tight text-white">
              Prime<span className="text-teal-300">Serve</span>
            </span>
          </Link>

          {/* Tagline */}
          <h2 className="font-heading text-4xl font-extrabold leading-tight tracking-tight text-white">
            Join <span className="text-teal-300">PrimeServe</span> Today
          </h2>

          <p className="mt-4 text-base leading-relaxed text-teal-50/80">
            Access bulk pricing, credit terms, and premium office supplies for
            your business.
          </p>

          {/* Feature cards */}
          <ul className="mt-10 space-y-4">
            {FEATURES.map(({ Icon, title, body }) => (
              <li
                key={title}
                className="flex items-start gap-4 rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-sm"
              >
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-400/15 text-teal-300">
                  <Icon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-heading text-sm font-bold text-white">
                    {title}
                  </p>
                  <p className="mt-0.5 text-xs text-teal-50/70">{body}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ─── Right panel (form) ─────────────────────────────────── */}
      <div className="flex flex-1 flex-col bg-white">
        {/* Top bar: back to home */}
        <div className="flex items-center justify-between px-4 pt-6 sm:px-8 lg:px-12">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-teal-600"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>

          <div className="lg:hidden">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 font-heading text-sm font-bold text-white">
                P
              </div>
              <span className="font-heading text-base font-bold tracking-tight text-slate-900">
                Prime<span className="text-teal-600">Serve</span>
              </span>
            </Link>
          </div>
        </div>

        <div className="flex flex-1 items-center justify-center px-4 py-10 sm:px-8 lg:px-12">
          <div className="w-full max-w-md space-y-4">
            <PreviewDomainNotice />
            {children}
          </div>
        </div>
      </div>
    </div>
  );
}
