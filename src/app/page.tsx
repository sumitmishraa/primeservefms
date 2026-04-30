'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ChevronRight,
  Sparkles,
  Package,
  Building2,
  CreditCard,
  Headphones,
  TrendingUp,
  Truck,
  ShieldCheck,
  Quote,
  Star,
  ShoppingCart,
} from 'lucide-react';
import { PublicHeader, PublicFooter } from '@/components/layout';
import { PRODUCT_CATEGORIES } from '@/lib/constants/categories';

// Unsplash cover photo per category — keyed by the product_category enum value.
const CATEGORY_IMAGES: Record<string, string> = {
  housekeeping_materials:
    'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=900&auto=format&fit=crop&q=80',
  cleaning_chemicals:
    'https://images.unsplash.com/photo-1585421514738-01798e348b17?w=900&auto=format&fit=crop&q=80',
  office_stationeries:
    'https://images.unsplash.com/photo-1456735190827-d1262f71b8a3?w=900&auto=format&fit=crop&q=80',
  pantry_items:
    'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=900&auto=format&fit=crop&q=80',
  facility_and_tools:
    'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=900&auto=format&fit=crop&q=80',
  printing_solution:
    'https://images.unsplash.com/photo-1612815154858-60aa4c59eaa6?w=900&auto=format&fit=crop&q=80',
};

const FEATURED_PRODUCTS = [
  {
    name: 'Professional Floor Cleaner (5L)',
    category: 'Cleaning Chemicals',
    price: '₹485',
    unit: 'can',
    rating: 4.8,
    reviews: 243,
    image:
      'https://images.unsplash.com/photo-1626785774573-4b799315345d?w=900&auto=format&fit=crop&q=80',
  },
  {
    name: 'Premium Liquid Hand Soap (5L)',
    category: 'Cleaning Chemicals',
    price: '₹395',
    unit: 'can',
    rating: 4.7,
    reviews: 189,
    image:
      'https://images.unsplash.com/photo-1584820927498-cfe5211fd8bf?w=900&auto=format&fit=crop&q=80',
  },
  {
    name: 'A4 Copier Paper (500 sheets)',
    category: 'Office Stationeries',
    price: '₹245',
    unit: 'ream',
    rating: 4.9,
    reviews: 412,
    image:
      'https://images.unsplash.com/photo-1568871391080-9acfa1ffb7ab?w=900&auto=format&fit=crop&q=80',
  },
  {
    name: 'Microfiber Cleaning Cloths (12-pack)',
    category: 'Housekeeping Materials',
    price: '₹289',
    unit: 'pack',
    rating: 4.6,
    reviews: 156,
    image:
      'https://images.unsplash.com/photo-1527515637462-cff94eecc1ac?w=900&auto=format&fit=crop&q=80',
  },
  {
    name: 'Disposable Paper Cups (100 ct)',
    category: 'Pantry Items',
    price: '₹135',
    unit: 'pack',
    rating: 4.5,
    reviews: 98,
    image:
      'https://images.unsplash.com/photo-1538474705339-e87de81450e8?w=900&auto=format&fit=crop&q=80',
  },
  {
    name: 'Heavy-Duty Garbage Bags (30 ct)',
    category: 'Housekeeping Materials',
    price: '₹175',
    unit: 'roll',
    rating: 4.7,
    reviews: 267,
    image:
      'https://images.unsplash.com/photo-1580480055273-228ff5388ef8?w=900&auto=format&fit=crop&q=80',
  },
] as const;

const TRUST_PILLS = [
  { Icon: CreditCard, label: '45-Day Credit' },
  { Icon: Headphones, label: '24/7 Support' },
  { Icon: TrendingUp, label: 'Bulk Discounts' },
] as const;

const BENEFITS = [
  {
    Icon: CreditCard,
    title: 'Flexible Credit Terms',
    body: 'Extend your cash flow with 30–60 day credit terms on every order.',
  },
  {
    Icon: TrendingUp,
    title: 'Volume-Based Pricing',
    body: 'The more you order, the less you pay. Tiered pricing on every SKU.',
  },
  {
    Icon: ShieldCheck,
    title: 'Verified Vendors Only',
    body: 'Every supplier is pre-vetted for quality, compliance, and consistency.',
  },
  {
    Icon: Truck,
    title: 'Same-Day Delivery',
    body: 'On-time, city-wide dispatch so you never run out of the essentials.',
  },
  {
    Icon: Headphones,
    title: 'Dedicated Account Manager',
    body: 'A single point of contact for procurement, issues, and insights.',
  },
  {
    Icon: Sparkles,
    title: 'Transparent Margins',
    body: "No hidden markups. See exactly what you're paying and why.",
  },
] as const;

const TESTIMONIALS = [
  {
    quote:
      'PrimeServe replaced 12 different vendors for our office. One invoice, one delivery, one account manager. It changed how we procure.',
    name: 'Ananya Sharma',
    role: 'Head of Admin, Indigo Ventures',
  },
  {
    quote:
      'The credit terms saved us. We stopped worrying about cash flow cycles and started focusing on growing our business instead.',
    name: 'Rahul Menon',
    role: 'Founder, BrightOffices',
  },
  {
    quote:
      "Quality is consistently great, pricing is transparent, and delivery is always on time. We haven't looked elsewhere in months.",
    name: 'Priya Iyer',
    role: 'Facilities Lead, SparkTech',
  },
] as const;

export default function HomePage() {
  const featuredRailRef = useRef<HTMLDivElement>(null);
  const featuredPausedRef = useRef(false);
  const [featuredAtEnd, setFeaturedAtEnd] = useState(false);

  const updateFeaturedArrow = useCallback(() => {
    const rail = featuredRailRef.current;
    if (!rail) return;
    setFeaturedAtEnd(rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 12);
  }, []);

  useEffect(() => {
    updateFeaturedArrow();
    const timer = setInterval(() => {
      const rail = featuredRailRef.current;
      if (!rail || featuredPausedRef.current) return;
      const nearEnd = rail.scrollLeft + rail.clientWidth >= rail.scrollWidth - 8;
      if (nearEnd) {
        setFeaturedAtEnd(true);
        return;
      }
      rail.scrollBy({ left: 300, behavior: 'smooth' });
    }, 2200);
    return () => clearInterval(timer);
  }, [updateFeaturedArrow]);

  const scrollFeaturedNext = () => {
    featuredRailRef.current?.scrollBy({ left: 340, behavior: 'smooth' });
    window.setTimeout(updateFeaturedArrow, 450);
  };

  return (
    <div className="flex min-h-screen flex-col bg-white">
      <PublicHeader />

      {/* ───── Dark Hero ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-900 to-teal-950">
        {/* Decorative glow */}
        <div className="pointer-events-none absolute -top-40 right-0 h-[600px] w-[600px] rounded-full bg-teal-500/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 left-0 h-[500px] w-[500px] rounded-full bg-teal-600/10 blur-3xl" />

        <div className="relative mx-auto grid max-w-7xl gap-10 px-4 py-16 sm:px-6 lg:grid-cols-2 lg:gap-16 lg:px-8 lg:py-24">
          {/* Left: copy */}
          <div className="flex flex-col justify-center">
            <span className="mb-5 inline-flex w-fit items-center gap-2 rounded-full border border-teal-500/30 bg-teal-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-teal-300">
              <span className="h-1.5 w-1.5 rounded-full bg-teal-400" />
              India&apos;s #1 B2B Facility Supplies
            </span>

            <h1 className="font-heading text-4xl font-extrabold leading-[1.05] tracking-tight text-white sm:text-5xl lg:text-[56px]">
              Stop Managing <span className="text-teal-400">Vendors</span>
              <br />
              Start Managing Your <span className="text-teal-400">Margin</span>
            </h1>

            <p className="mt-6 max-w-xl text-base leading-relaxed text-slate-300 sm:text-lg">
              Replace 12 chaotic vendors with one transparent platform. Source
              professional-grade housekeeping, cleaning, and pantry supplies at
              bulk prices with 45-day credit and 100% GST compliance.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/marketplace"
                className="group inline-flex items-center gap-2 rounded-lg bg-teal-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-teal-500/20 transition-all hover:bg-teal-400"
              >
                Browse Products
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </Link>
            </div>

            <div className="mt-10 flex flex-wrap gap-2">
              {TRUST_PILLS.map(({ Icon, label }) => (
                <span
                  key={label}
                  className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-slate-200 backdrop-blur-sm"
                >
                  <Icon className="h-3.5 w-3.5 text-teal-400" />
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Right: visual grid */}
          <div className="relative flex items-center justify-center">
            <div className="grid w-full max-w-md grid-cols-3 gap-3">
              {/* Row 1 */}
              <div className="hero-stat-card flex aspect-square flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center backdrop-blur-sm">
                <Package className="hero-stat-icon mb-2 h-6 w-6 text-teal-400" />
                <p className="font-heading text-lg font-extrabold text-white">500+</p>
                <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  Products
                </p>
              </div>
              <div className="hero-stat-card flex aspect-square flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center backdrop-blur-sm">
                <Building2 className="hero-stat-icon mb-2 h-6 w-6 text-teal-400" />
                <p className="font-heading text-lg font-extrabold text-white">100+</p>
                <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  Businesses
                </p>
              </div>
              <div className="hero-stat-card flex aspect-square flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center backdrop-blur-sm">
                <Sparkles className="hero-stat-icon mb-2 h-6 w-6 text-teal-400" />
                <p className="font-heading text-sm font-extrabold text-white">GST</p>
                <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  Compliant
                </p>
              </div>

              {/* Row 2 */}
              <div className="hero-stat-card flex aspect-square flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center backdrop-blur-sm">
                <Truck className="hero-stat-icon mb-2 h-6 w-6 text-teal-400" />
                <p className="font-heading text-[11px] font-extrabold text-white">
                  Fast
                </p>
                <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  Delivery
                </p>
              </div>
              <div className="hero-stat-card hero-stat-card-active flex aspect-square flex-col items-center justify-center rounded-2xl border border-teal-400/30 bg-teal-500/15 p-4 text-center backdrop-blur-sm">
                <CreditCard className="hero-stat-icon mb-2 h-7 w-7 text-teal-300" />
                <p className="font-heading text-lg font-extrabold text-white">45 Day</p>
                <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-teal-200">
                  Credit Terms
                </p>
              </div>
              <div className="hero-stat-card flex aspect-square flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center backdrop-blur-sm">
                <ShieldCheck className="hero-stat-icon mb-2 h-6 w-6 text-teal-400" />
                <p className="font-heading text-[11px] font-extrabold text-white">
                  Secure
                </p>
                <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  Payments
                </p>
              </div>

              {/* Row 3 */}
              <div className="hero-stat-card flex aspect-square flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center backdrop-blur-sm">
                <Headphones className="hero-stat-icon mb-2 h-6 w-6 text-teal-400" />
                <p className="font-heading text-[11px] font-extrabold text-white">
                  24/7
                </p>
                <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  Support
                </p>
              </div>
              <div className="hero-stat-card flex aspect-square flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center backdrop-blur-sm">
                <TrendingUp className="hero-stat-icon mb-2 h-6 w-6 text-teal-400" />
                <p className="font-heading text-lg font-extrabold text-white">98%</p>
                <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  On-time
                </p>
              </div>
              <div className="hero-stat-card flex aspect-square flex-col items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] p-4 text-center backdrop-blur-sm">
                <Sparkles className="hero-stat-icon mb-2 h-6 w-6 text-teal-400" />
                <p className="font-heading text-[11px] font-extrabold text-white">
                  Verified
                </p>
                <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  Vendors
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ───── Categories strip ────────────────────────────────────── */}
      <section className="bg-white py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 flex flex-col items-center text-center">
            <span className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-teal-600">
              Shop by Category
            </span>
            <h2 className="font-heading text-3xl font-bold text-slate-900 sm:text-4xl">
              Everything your workplace needs
            </h2>
            <p className="mt-3 max-w-2xl text-base text-slate-500">
              Six curated categories. 500+ SKUs. Bulk pricing on every single item.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {PRODUCT_CATEGORIES.map((cat) => (
              <Link
                key={cat.value}
                href={`/marketplace?category=${cat.value}`}
                className="group flex flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-200 hover:-translate-y-1 hover:border-teal-500 hover:shadow-lg"
              >
                <div className="relative h-48 w-full overflow-hidden bg-slate-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={CATEGORY_IMAGES[cat.value]}
                    alt={cat.label}
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    loading="lazy"
                  />
                </div>
                <div className="flex flex-1 flex-col p-6">
                  <h3 className="font-heading text-base font-bold text-slate-900">
                    {cat.label}
                  </h3>
                  <p className="mt-1.5 line-clamp-2 text-sm text-slate-500">
                    {cat.description}
                  </p>
                  <div className="mt-4 flex items-center justify-between text-xs">
                    <span className="font-mono font-semibold text-slate-400">
                      {cat.productCount}+ products
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-teal-600 opacity-0 transition-opacity group-hover:opacity-100">
                      Browse
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ───── Featured Products ─────────────────────────────────── */}
      <section className="bg-slate-50/60 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-10 flex flex-col items-center text-center">
            <span className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-teal-600">
              Handpicked
            </span>
            <h2 className="font-heading text-3xl font-bold text-slate-900 sm:text-4xl">
              Featured Products
            </h2>
            <p className="mt-3 max-w-2xl text-base text-slate-500">
              Top-rated supplies trusted by enterprise facilities.
            </p>
          </div>

          {/* Horizontal snap scroller. Negative margins + matching padding
              let cards bleed to the viewport edge so the last/first card
              hints there's more to scroll. Custom scrollbar utilities are
              inlined as arbitrary variants so we don't depend on a plugin. */}
          <div
            className="relative -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8"
            onMouseEnter={() => { featuredPausedRef.current = true; }}
            onMouseLeave={() => { featuredPausedRef.current = false; }}
            onFocus={() => { featuredPausedRef.current = true; }}
            onBlur={() => { featuredPausedRef.current = false; }}
          >
            <div
              ref={featuredRailRef}
              onScroll={updateFeaturedArrow}
              className="flex snap-x snap-mandatory scroll-smooth gap-6 overflow-x-auto pb-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {FEATURED_PRODUCTS.map((product) => (
                <div
                  key={product.name}
                  className="group flex w-[280px] shrink-0 snap-start flex-col overflow-hidden rounded-xl border border-slate-200 bg-white transition-all duration-200 hover:-translate-y-1 hover:border-teal-300 hover:shadow-lg sm:w-[300px]"
                >
                  <Link
                    href="/marketplace"
                    className="relative block aspect-[4/3] w-full overflow-hidden bg-slate-100"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={product.image}
                      alt={product.name}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                      loading="lazy"
                    />
                    <span className="absolute left-3 top-3 rounded-full bg-teal-100 px-2.5 py-0.5 text-[11px] font-semibold text-teal-700">
                      In Stock
                    </span>
                  </Link>

                  <div className="flex flex-1 flex-col gap-1.5 p-5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                      {product.category}
                    </p>
                    <Link
                      href="/marketplace"
                      className="line-clamp-2 font-heading text-sm font-bold leading-snug text-slate-900 transition-colors hover:text-teal-700"
                    >
                      {product.name}
                    </Link>

                    <div className="flex items-center gap-1.5 text-xs">
                      <div className="flex">
                        {[0, 1, 2, 3, 4].map((i) => (
                          <Star
                            key={i}
                            className={`h-3.5 w-3.5 ${
                              i < Math.round(product.rating)
                                ? 'fill-amber-400 text-amber-400'
                                : 'fill-slate-200 text-slate-200'
                            }`}
                          />
                        ))}
                      </div>
                      <span className="text-slate-500">
                        {product.rating} ({product.reviews})
                      </span>
                    </div>

                    <p className="mt-1 font-heading text-lg font-bold text-teal-700">
                      {product.price}
                      <span className="ml-1 text-xs font-normal text-slate-500">
                        / {product.unit}
                      </span>
                    </p>

                    <Link
                      href="/marketplace"
                      className="mt-3 inline-flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700"
                    >
                      <ShoppingCart className="h-4 w-4" />
                      Add to Cart
                    </Link>
                  </div>
                </div>
              ))}

              {/* "See more" terminator card — same dimensions as a product
                  card so it slots cleanly into the scroll rhythm. */}
              <Link
                href="/marketplace"
                className="group flex w-[280px] shrink-0 snap-start flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-teal-300 bg-teal-50/40 p-8 text-center transition-all hover:-translate-y-1 hover:border-teal-500 hover:bg-teal-50 sm:w-[300px]"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-full bg-teal-100 text-teal-700 transition-transform group-hover:scale-110">
                  <ArrowRight className="h-6 w-6" />
                </div>
                <p className="font-heading text-base font-bold text-teal-700">
                  See more products
                </p>
                <p className="text-xs text-teal-700/70">
                  Browse the full catalogue
                </p>
              </Link>
            </div>
            {!featuredAtEnd && (
              <button
                type="button"
                onClick={scrollFeaturedNext}
                className="absolute right-0 top-1/2 hidden h-11 w-11 -translate-y-1/2 translate-x-6 items-center justify-center rounded-full border border-teal-100 bg-white text-teal-700 shadow-lg shadow-slate-900/10 transition-all hover:-translate-y-[calc(50%+2px)] hover:border-teal-300 hover:bg-teal-50 focus:outline-none focus:ring-2 focus:ring-teal-500 lg:flex xl:translate-x-10"
                aria-label="Show more featured products"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ───── Benefits grid ──────────────────────────────────────── */}
      <section className="border-y border-slate-100 bg-slate-50/60 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 flex flex-col items-center text-center">
            <span className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-teal-600">
              Why PrimeServe
            </span>
            <h2 className="font-heading text-3xl font-bold text-slate-900 sm:text-4xl">
              Built for procurement teams that care about margins
            </h2>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {BENEFITS.map(({ Icon, title, body }) => (
              <div
                key={title}
                className="flex flex-col rounded-xl border border-slate-200 bg-white p-6 transition-colors duration-200 hover:border-teal-500 hover:bg-teal-50/20"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-600">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="font-heading text-base font-bold text-slate-900">
                  {title}
                </h3>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-500">{body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ───── Testimonials ───────────────────────────────────────── */}
      <section className="border-t border-slate-100 bg-slate-50/60 py-16 sm:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-12 flex flex-col items-center text-center">
            <span className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-teal-600">
              Trusted by businesses
            </span>
            <h2 className="font-heading text-3xl font-bold text-slate-900 sm:text-4xl">
              What our customers say
            </h2>
          </div>

          <div className="grid gap-4 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <figure
                key={t.name}
                className="flex flex-col rounded-xl border border-slate-200 bg-white p-6"
              >
                <Quote className="h-5 w-5 text-teal-500" />
                <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-slate-700">
                  {t.quote}
                </blockquote>
                <figcaption className="mt-6 border-t border-slate-100 pt-4">
                  <p className="font-heading text-sm font-bold text-slate-900">
                    {t.name}
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">{t.role}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
