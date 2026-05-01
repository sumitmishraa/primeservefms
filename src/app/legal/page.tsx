import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, FileText } from 'lucide-react';
import { PublicFooter, PublicHeader } from '@/components/layout';
import { POLICY_LINKS } from '@/lib/legal/policy-links';

export const metadata: Metadata = {
  title: 'Legal Policies | PrimeServe',
  description: 'PrimeServe legal policies for terms, privacy, credit, shipping, and refunds.',
};

export default function LegalIndexPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <PublicHeader />

      <main className="flex-1">
        <section className="bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950 px-4 py-16 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-4xl text-center">
            <span className="mb-3 inline-block text-[11px] font-semibold uppercase tracking-wider text-teal-300">
              Legal
            </span>
            <h1 className="font-heading text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
              PrimeServe policies
            </h1>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Review the policies that govern ordering, credit, delivery, privacy,
              returns, and refunds on the PrimeServe platform.
            </p>
          </div>
        </section>

        <section className="py-14 sm:py-16">
          <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
            <div className="grid gap-4 sm:grid-cols-2">
              {POLICY_LINKS.map((policy) => (
                <Link
                  key={policy.slug}
                  href={policy.href}
                  className="group flex min-h-40 flex-col rounded-xl border border-slate-200 bg-white p-6 transition-colors hover:border-teal-400 hover:bg-teal-50/30"
                >
                  <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                    <FileText className="h-5 w-5" />
                  </div>
                  <h2 className="font-heading text-lg font-bold text-slate-900">
                    {policy.label}
                  </h2>
                  <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500">
                    {policy.summary}
                  </p>
                  <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-teal-700">
                    Open policy
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
