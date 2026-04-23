import Link from 'next/link';
import {
  ArrowRight,
  Sparkles,
  FlaskConical,
  PenTool,
  Coffee,
  Wrench,
  Printer,
} from 'lucide-react';
import { PublicHeader, PublicFooter } from '@/components/layout';
import {
  PRODUCT_CATEGORIES,
  getSubcategoriesByCategory,
} from '@/lib/constants/categories';

const ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Sparkles,
  FlaskConical,
  PenTool,
  Coffee,
  Wrench,
  Printer,
};

export default function CategoriesPage() {
  return (
    <div className="flex min-h-screen flex-col bg-white">
      <PublicHeader />

      {/* Hero */}
      <section className="bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950 px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <span className="mb-4 inline-block text-[11px] font-semibold uppercase tracking-wider text-teal-300">
            Browse All Categories
          </span>
          <h1 className="font-heading text-4xl font-extrabold tracking-tight text-white sm:text-5xl">
            Everything your workplace needs
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-base text-slate-300 sm:text-lg">
            500+ SKUs across 6 curated categories, priced for bulk procurement.
          </p>
        </div>
      </section>

      {/* Category cards */}
      <section className="py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid gap-6 lg:grid-cols-2">
            {PRODUCT_CATEGORIES.map((cat) => {
              const Icon = ICONS[cat.icon] ?? Sparkles;
              const subs = getSubcategoriesByCategory(cat.value);
              return (
                <Link
                  key={cat.value}
                  href={`/marketplace?category=${cat.value}`}
                  className="group flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-7 transition-all hover:border-teal-500 hover:bg-teal-50/30"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-600 transition-colors group-hover:bg-teal-600 group-hover:text-white">
                      <Icon className="h-6 w-6" />
                    </div>
                    <span className="font-mono text-xs font-semibold text-slate-400">
                      {cat.productCount}+ products
                    </span>
                  </div>

                  <div>
                    <h2 className="font-heading text-xl font-bold text-slate-900">
                      {cat.label}
                    </h2>
                    <p className="mt-1.5 text-sm leading-relaxed text-slate-500">
                      {cat.description}
                    </p>
                  </div>

                  {subs.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {subs.slice(0, 5).map((s) => (
                        <span
                          key={s.slug}
                          className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] font-medium text-slate-600"
                        >
                          {s.label}
                        </span>
                      ))}
                      {subs.length > 5 && (
                        <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-500">
                          +{subs.length - 5} more
                        </span>
                      )}
                    </div>
                  )}

                  <div className="mt-auto inline-flex items-center gap-1.5 text-sm font-semibold text-teal-600">
                    Browse {cat.label}
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
