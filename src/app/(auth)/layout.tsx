/**
 * Auth layout — wraps /login and /register with a split-screen design.
 *
 * Desktop (lg+):
 *   Left half  — Deep teal gradient, PrimeServe branding + 3 trust points
 *   Right half — White, centred form area (max-w-md)
 *
 * Mobile:
 *   Compact branding strip at top, form content below
 *
 */

import Link from 'next/link';
import { CheckCircle2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Trust points shown in the left branding panel
// ---------------------------------------------------------------------------

const TRUST_POINTS = [
  'Verified Vendors & Quality Products',
  'Bulk Pricing with GST Invoices',
  '394+ Products across 6 Categories',
] as const;

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">

      {/* ── Left panel: branding (desktop only) ──────────────────────────── */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-teal-600 via-teal-700 to-teal-900 flex-col items-center justify-center p-12 relative overflow-hidden">

        {/* Decorative circles */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-teal-500/20 rounded-full" />
        <div className="absolute -bottom-16 -right-16 w-96 h-96 bg-teal-800/30 rounded-full" />

        <div className="relative z-10 max-w-md text-center">
          {/* Logo */}
          <Link href="/" className="inline-block mb-6">
            <span className="text-4xl font-heading font-bold text-white tracking-tight">
              PrimeServe
            </span>
          </Link>

          {/* Tagline */}
          <p className="text-teal-100 text-lg mb-10 leading-relaxed">
            B2B Procurement, Simplified
          </p>

          {/* Trust points */}
          <ul className="space-y-4 text-left">
            {TRUST_POINTS.map((point) => (
              <li key={point} className="flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-teal-200 shrink-0 mt-0.5" />
                <span className="text-teal-50 text-sm leading-relaxed">{point}</span>
              </li>
            ))}
          </ul>

          {/* Stat pills */}
          <div className="mt-12 flex gap-4 justify-center">
            <div className="bg-white/10 rounded-xl px-5 py-3 text-center">
              <p className="text-2xl font-heading font-bold text-white">100+</p>
              <p className="text-xs text-teal-200 mt-0.5">Businesses</p>
            </div>
            <div className="bg-white/10 rounded-xl px-5 py-3 text-center">
              <p className="text-2xl font-heading font-bold text-white">394+</p>
              <p className="text-xs text-teal-200 mt-0.5">Products</p>
            </div>
            <div className="bg-white/10 rounded-xl px-5 py-3 text-center">
              <p className="text-2xl font-heading font-bold text-white">6</p>
              <p className="text-xs text-teal-200 mt-0.5">Categories</p>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right panel: form area ────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center bg-white px-4 py-8 lg:py-12 min-h-screen lg:min-h-0">

        {/* Mobile-only compact branding */}
        <div className="lg:hidden mb-8 text-center">
          <Link href="/">
            <span className="text-2xl font-heading font-bold text-teal-600 tracking-tight">
              PrimeServe
            </span>
          </Link>
          <p className="text-slate-500 text-xs mt-1">B2B Procurement, Simplified</p>
        </div>

        {/* Form content from page.tsx */}
        <div className="w-full max-w-md">
          {children}
        </div>
      </div>

    </div>
  );
}
