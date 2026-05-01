import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarDays, FileText } from 'lucide-react';
import { PublicFooter, PublicHeader } from '@/components/layout';
import {
  LEGAL_POLICIES,
  getLegalPolicy,
  type LegalPolicyBlock,
} from '@/lib/legal/policies';

type LegalPolicyPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return LEGAL_POLICIES.map((policy) => ({ slug: policy.slug }));
}

export async function generateMetadata({
  params,
}: LegalPolicyPageProps): Promise<Metadata> {
  const { slug } = await params;
  const policy = getLegalPolicy(slug);

  if (!policy) {
    return {
      title: 'Legal Policy | PrimeServe',
    };
  }

  return {
    title: `${policy.title} | PrimeServe`,
    description: policy.summary,
  };
}

function renderPolicyBlocks(blocks: LegalPolicyBlock[]) {
  const elements: ReactNode[] = [];
  let listItems: string[] = [];
  let listIndex = 0;

  const flushList = () => {
    if (listItems.length === 0) return;

    elements.push(
      <ul
        key={`list-${listIndex}`}
        className="my-5 list-disc space-y-2 pl-6 text-sm leading-7 text-slate-700 marker:text-teal-600 sm:text-[15px]"
      >
        {listItems.map((item, itemIndex) => (
          <li key={`${listIndex}-${itemIndex}`}>{item}</li>
        ))}
      </ul>,
    );

    listIndex += 1;
    listItems = [];
  };

  blocks.forEach((block, index) => {
    if (block.type === 'listItem') {
      listItems.push(block.text);
      return;
    }

    flushList();

    if (block.type === 'heading') {
      elements.push(
        <h2
          key={`heading-${index}`}
          className="mt-10 border-t border-slate-200 pt-7 font-heading text-xl font-bold tracking-tight text-slate-900 first:mt-0 first:border-t-0 first:pt-0"
        >
          {block.text}
        </h2>,
      );
      return;
    }

    elements.push(
      <p
        key={`paragraph-${index}`}
        className="mt-4 text-sm leading-7 text-slate-700 sm:text-[15px]"
      >
        {block.text}
      </p>,
    );
  });

  flushList();
  return elements;
}

export default async function LegalPolicyPage({ params }: LegalPolicyPageProps) {
  const { slug } = await params;
  const policy = getLegalPolicy(slug);

  if (!policy) notFound();

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <PublicHeader />

      <main className="flex-1">
        <section className="bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950 px-4 py-14 sm:px-6 sm:py-16 lg:px-8">
          <div className="mx-auto max-w-5xl">
            <Link
              href="/legal"
              className="inline-flex items-center gap-2 text-sm font-semibold text-teal-200 transition-colors hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              All policies
            </Link>
            <div className="mt-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <span className="mb-3 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-teal-300">
                  <FileText className="h-3.5 w-3.5" />
                  Legal Policy
                </span>
                <h1 className="font-heading text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
                  {policy.title}
                </h1>
                <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-300">
                  {policy.summary}
                </p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-semibold text-slate-200">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                  <CalendarDays className="h-3.5 w-3.5 text-teal-300" />
                  Updated {policy.lastUpdated}
                </span>
                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                  Effective {policy.effectiveDate}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="py-10 sm:py-12">
          <div className="mx-auto grid max-w-7xl gap-8 px-4 sm:px-6 lg:grid-cols-[280px_1fr] lg:px-8">
            <aside className="lg:sticky lg:top-28 lg:self-start">
              <nav
                aria-label="Legal policies"
                className="rounded-xl border border-slate-200 bg-white p-3"
              >
                <p className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
                  Policies
                </p>
                <div className="space-y-1">
                  {LEGAL_POLICIES.map((item) => (
                    <Link
                      key={item.slug}
                      href={item.href}
                      aria-current={item.slug === policy.slug ? 'page' : undefined}
                      className={`block rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
                        item.slug === policy.slug
                          ? 'bg-teal-50 text-teal-700'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-teal-700'
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </nav>
            </aside>

            <article className="min-w-0">
              <div className="mb-8 rounded-xl border border-teal-100 bg-teal-50/50 p-5">
                <p className="text-sm leading-7 text-slate-700">
                  This policy applies to PrimeServe Facility Solutions business
                  buyers and platform users. For policy questions or operational
                  support, contact PrimeServe through the support details listed in
                  the relevant policy section.
                </p>
              </div>

              <div className="max-w-4xl">
                {renderPolicyBlocks(policy.blocks)}
              </div>
            </article>
          </div>
        </section>
      </main>

      <PublicFooter />
    </div>
  );
}
