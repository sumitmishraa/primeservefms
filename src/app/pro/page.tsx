import Link from 'next/link';
import { Crown, Check, X, ArrowRight, Sparkles } from 'lucide-react';
import { PublicHeader, PublicFooter } from '@/components/layout';

interface PricingPlan {
  name: string;
  price: string;
  period: string;
  save?: string;
  highlight?: boolean;
  features: string[];
}

const PLANS: PricingPlan[] = [
  {
    name: 'Monthly',
    price: '₹999',
    period: '/month',
    features: [
      '5% additional discount on all orders',
      'Extended 45-day credit terms',
      'Priority customer support',
      'Free delivery on orders ₹2,000+',
      'Early access to new products',
    ],
  },
  {
    name: 'Quarterly',
    price: '₹2,499',
    period: '/quarter',
    save: 'Save ₹498 (16% off)',
    highlight: true,
    features: [
      '8% additional discount on all orders',
      'Extended 60-day credit terms',
      'Dedicated account manager',
      'Free delivery on all orders',
      'Early access to new products',
      'Volume-based rewards program',
    ],
  },
  {
    name: 'Annual',
    price: '₹7,999',
    period: '/year',
    save: 'Save ₹3,989 (33% off)',
    features: [
      '12% additional discount on all orders',
      'Extended 60-day credit terms',
      'Dedicated account manager',
      'Free delivery on all orders',
      'Early access + exclusive products',
      'Volume-based rewards program',
    ],
  },
];

type CellValue = string | { check: true } | { check: false };
interface ComparisonRow {
  feature: string;
  free: CellValue;
  pro: CellValue;
}

const COMPARISON: ComparisonRow[] = [
  { feature: 'Bulk pricing discounts', free: { check: true }, pro: { check: true } },
  { feature: 'Additional Pro discount', free: { check: false }, pro: '5–12%' },
  { feature: 'Credit terms', free: '30 days', pro: '45–60 days' },
  { feature: 'Delivery fee', free: 'Orders ₹5,000+', pro: 'Free (all orders)' },
  { feature: 'Account manager', free: { check: false }, pro: { check: true } },
  { feature: 'Priority support', free: { check: false }, pro: { check: true } },
  { feature: 'Custom invoicing', free: { check: false }, pro: 'Annual only' },
  { feature: 'Reward points', free: { check: false }, pro: { check: true } },
];

function Cell({ value }: { value: CellValue }) {
  if (typeof value === 'string') {
    return <span className="font-semibold text-teal-700">{value}</span>;
  }
  return value.check ? (
    <Check className="mx-auto h-5 w-5 text-teal-600" />
  ) : (
    <X className="mx-auto h-5 w-5 text-slate-300" />
  );
}

export default function ProPlanPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <PublicHeader />

      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950 px-4 py-20 sm:px-6 lg:px-8">
        <div className="pointer-events-none absolute -top-24 right-0 h-96 w-96 rounded-full bg-teal-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-0 h-80 w-80 rounded-full bg-amber-500/10 blur-3xl" />

        <div className="relative mx-auto max-w-5xl text-center">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full bg-amber-500/20 px-4 py-1.5 text-xs font-semibold text-amber-200">
            <Crown className="h-4 w-4" /> PrimeServe Pro
          </span>

          <h1 className="font-heading text-4xl font-extrabold leading-tight tracking-tight text-white sm:text-5xl lg:text-6xl">
            Unlock Maximum
            <br />
            <span className="text-teal-300">Business Savings</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-teal-50/80">
            Get exclusive discounts, extended credit terms, dedicated support,
            and free delivery with PrimeServe Pro.
          </p>
        </div>
      </section>

      {/* Pricing tiers */}
      <section className="relative -mt-16 pb-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 md:grid-cols-3">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`relative flex flex-col rounded-2xl border p-8 ${
                  plan.highlight
                    ? 'border-teal-500 bg-white shadow-2xl shadow-teal-500/10'
                    : 'border-slate-200 bg-white shadow-sm'
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-4 left-1/2 -translate-x-1/2 rounded-full bg-teal-600 px-4 py-1 text-xs font-semibold text-white">
                    Most Popular
                  </span>
                )}

                <p className="font-heading text-xl font-bold text-slate-900">
                  {plan.name}
                </p>
                <div className="mt-4 flex items-baseline gap-1">
                  <span className="font-heading text-5xl font-extrabold text-slate-900">
                    {plan.price}
                  </span>
                  <span className="text-base font-medium text-slate-500">
                    {plan.period}
                  </span>
                </div>

                {plan.save && (
                  <p className="mt-2 text-sm font-semibold text-emerald-600">
                    {plan.save}
                  </p>
                )}

                <ul className="mt-6 flex-1 space-y-3">
                  {plan.features.map((f) => (
                    <li
                      key={f}
                      className="flex items-start gap-2.5 text-sm text-slate-700"
                    >
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-teal-600" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>

                <Link
                  href="/register"
                  className={`mt-8 inline-flex items-center justify-center gap-2 rounded-lg px-5 py-3 text-sm font-semibold transition-colors ${
                    plan.highlight
                      ? 'bg-teal-600 text-white hover:bg-teal-700'
                      : 'border border-slate-200 bg-white text-slate-700 hover:border-teal-500 hover:text-teal-600'
                  }`}
                >
                  Get Started
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Free vs Pro comparison */}
      <section className="border-t border-slate-100 bg-slate-50/60 py-20">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 text-center">
            <h2 className="font-heading text-3xl font-bold text-slate-900 sm:text-4xl">
              Free vs Pro Plan
            </h2>
            <p className="mt-3 text-base text-slate-500">
              See what you unlock when you upgrade to Pro.
            </p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="w-1/2 px-6 py-4 text-left font-heading text-base font-bold text-slate-900">
                    Feature
                  </th>
                  <th className="w-1/4 px-6 py-4 text-center font-heading text-base font-bold text-slate-500">
                    Free
                  </th>
                  <th className="w-1/4 px-6 py-4 text-center font-heading text-base font-bold text-slate-900">
                    <span className="inline-flex items-center gap-1.5">
                      Pro
                      <Sparkles className="h-4 w-4 text-amber-500" />
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row, i) => (
                  <tr
                    key={row.feature}
                    className={i % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}
                  >
                    <td className="px-6 py-4 font-medium text-slate-800">
                      {row.feature}
                    </td>
                    <td className="px-6 py-4 text-center text-slate-600">
                      <Cell value={row.free} />
                    </td>
                    <td className="px-6 py-4 text-center">
                      <Cell value={row.pro} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-10 flex flex-col items-center gap-3 text-center">
            <Link
              href="/register"
              className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-6 py-3 text-sm font-semibold text-white hover:bg-teal-700"
            >
              Upgrade to Pro
              <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="text-xs text-slate-500">
              Cancel anytime. Taxes applied as per GST norms.
            </p>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
