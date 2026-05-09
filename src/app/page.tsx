'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, PointerEvent as ReactPointerEvent } from 'react';
import Link from 'next/link';
import {
  ArrowRight,
  ChevronLeft,
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
} from 'lucide-react';
import { PublicHeader, PublicFooter } from '@/components/layout';
import { PRODUCT_CATEGORIES } from '@/lib/constants/categories';
import ProductCard from '@/components/marketplace/ProductCard';
import type { CartableProduct } from '@/components/marketplace/AddToCartButton';

// Category cover images — keyed by the product_category enum value.
const CATEGORY_IMAGES: Record<string, string> = {
  housekeeping_materials: '/images/categories/housekeeping-materials.png',
  cleaning_chemicals: '/images/categories/cleaning-chemicals.png',
  office_stationeries: '/images/categories/office-stationeries.png',
  pantry_items: '/images/categories/pantry-items.png',
  facility_and_tools: '/images/categories/facility-tools.png',
  printing_solution: '/images/categories/printing-solution.png',
};

interface ProductsApiResponse {
  products: CartableProduct[];
  total: number;
  page: number;
  per_page: number;
}

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
  const [featuredProducts, setFeaturedProducts] = useState<CartableProduct[]>([]);
  const [featuredLoading, setFeaturedLoading] = useState(true);
  const [featuredScrollDone, setFeaturedScrollDone] = useState(false);
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [sectionVisible, setSectionVisible] = useState(false);
  const featuredRailRef = useRef<HTMLDivElement>(null);
  const featuredPausedRef = useRef(false);
  const featuredResumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const featuredDragRef = useRef({
    active: false,
    didDrag: false,
    scrollLeft: 0,
    startX: 0,
  });
  const featuredScrollDoneRef = useRef(false);
  const featuredSectionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadFeaturedProducts() {
      setFeaturedLoading(true);
      try {
        const queryFor = (category: string) => {
          const params = new URLSearchParams({
            is_approved: 'true',
            is_active: 'true',
            page: '1',
            per_page: '12',
            category,
          });
          return fetch(`/api/products?${params.toString()}`);
        };

        const responses = await Promise.all([
          queryFor('housekeeping_materials'),
          queryFor('office_stationeries'),
        ]);
        const payloads = await Promise.all(
          responses.map((res) => res.json() as Promise<{ data: ProductsApiResponse | null; error: string | null }>),
        );

        const [housekeeping = [], stationery = []] = payloads.map((payload) =>
          (payload.data?.products ?? []).filter((product) => product.thumbnail_url),
        );
        const preferredProducts = [
          ...housekeeping.slice(0, 5),
          ...stationery.slice(0, 5),
          ...housekeeping.slice(5),
          ...stationery.slice(5),
        ];
        const uniqueProducts = Array.from(
          new Map(preferredProducts.map((product) => [product.id, product])).values(),
        );

        if (!cancelled) setFeaturedProducts(uniqueProducts.slice(0, 10));
      } catch {
        if (!cancelled) setFeaturedProducts([]);
      } finally {
        if (!cancelled) setFeaturedLoading(false);
      }
    }

    void loadFeaturedProducts();
    return () => {
      cancelled = true;
    };
  }, []);


  const pauseFeaturedAutoScroll = useCallback((resumeAfterMs?: number) => {
    featuredPausedRef.current = true;
    if (featuredResumeTimerRef.current) {
      clearTimeout(featuredResumeTimerRef.current);
      featuredResumeTimerRef.current = null;
    }
    if (resumeAfterMs) {
      featuredResumeTimerRef.current = setTimeout(() => {
        featuredPausedRef.current = false;
        featuredResumeTimerRef.current = null;
      }, resumeAfterMs);
    }
  }, []);

  const resumeFeaturedAutoScroll = useCallback(() => {
    if (featuredResumeTimerRef.current) {
      clearTimeout(featuredResumeTimerRef.current);
      featuredResumeTimerRef.current = null;
    }
    featuredPausedRef.current = false;
  }, []);

  const scrollFeaturedBy = useCallback((direction: 1 | -1) => {
    const rail = featuredRailRef.current;
    if (!rail) return;
    pauseFeaturedAutoScroll(2400);
    rail.scrollBy({
      left: direction * Math.min(rail.clientWidth * 0.85, 620),
      behavior: 'smooth',
    });
  }, [pauseFeaturedAutoScroll]);

  const beginFeaturedDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'mouse' && event.button !== 0) return;
    const rail = featuredRailRef.current;
    if (!rail) return;

    pauseFeaturedAutoScroll();
    featuredDragRef.current = {
      active: true,
      didDrag: false,
      scrollLeft: rail.scrollLeft,
      startX: event.clientX,
    };
    rail.setPointerCapture(event.pointerId);
  }, [pauseFeaturedAutoScroll]);

  const moveFeaturedDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const rail = featuredRailRef.current;
    const drag = featuredDragRef.current;
    if (!rail || !drag.active) return;

    const deltaX = event.clientX - drag.startX;
    if (Math.abs(deltaX) > 4) drag.didDrag = true;
    rail.scrollLeft = drag.scrollLeft - deltaX;
  }, []);

  const endFeaturedDrag = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const rail = featuredRailRef.current;
    const drag = featuredDragRef.current;
    if (!rail || !drag.active) return;

    drag.active = false;
    if (rail.hasPointerCapture(event.pointerId)) rail.releasePointerCapture(event.pointerId);
    pauseFeaturedAutoScroll(1600);
  }, [pauseFeaturedAutoScroll]);

  const stopFeaturedClickAfterDrag = useCallback((event: ReactMouseEvent<HTMLDivElement>) => {
    if (!featuredDragRef.current.didDrag) return;
    event.preventDefault();
    event.stopPropagation();
    featuredDragRef.current.didDrag = false;
  }, []);

  useEffect(() => {
    const section = featuredSectionRef.current;
    if (!section) return undefined;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry?.isIntersecting) setSectionVisible(true); },
      { threshold: 0.1 },
    );
    obs.observe(section);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (featuredProducts.length === 0) return undefined;

    featuredScrollDoneRef.current = false;
    setFeaturedScrollDone(false);

    let frame = 0;
    let lastTime = performance.now();
    const pixelsPerSecond = 60;

    const tick = (time: number) => {
      const rail = featuredRailRef.current;
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (rail && !featuredPausedRef.current && !prefersReducedMotion) {
        const deltaSeconds = Math.min((time - lastTime) / 1000, 0.05);
        const maxScroll = rail.scrollWidth - rail.clientWidth;

        rail.scrollLeft = Math.min(rail.scrollLeft + pixelsPerSecond * deltaSeconds, maxScroll);

        if (rail.scrollLeft >= maxScroll - 2) {
          featuredScrollDoneRef.current = true;
          setFeaturedScrollDone(true);
          window.cancelAnimationFrame(frame);
          return;
        }
      }

      lastTime = time;
      frame = window.requestAnimationFrame(tick);
    };

    frame = window.requestAnimationFrame(tick);
    return () => {
      window.cancelAnimationFrame(frame);
      if (featuredResumeTimerRef.current) clearTimeout(featuredResumeTimerRef.current);
    };
  }, [featuredProducts.length]);

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
                <div className="relative aspect-[2/1] w-full overflow-hidden bg-white">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={CATEGORY_IMAGES[cat.value]}
                    alt={cat.label}
                    className="h-full w-full object-contain"
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
      <section ref={featuredSectionRef} className="bg-slate-50/60 py-16 sm:py-20">
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

          <div
            className={`featured-marquee group relative -mx-4 px-4 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8${sectionVisible ? ' featured-section-visible' : ''}`}
            onMouseEnter={() => pauseFeaturedAutoScroll()}
            onMouseLeave={resumeFeaturedAutoScroll}
            onFocus={() => pauseFeaturedAutoScroll()}
            onBlur={resumeFeaturedAutoScroll}
            onWheel={() => pauseFeaturedAutoScroll(1800)}
          >
            {featuredLoading ? (
              <div className="flex gap-6 overflow-hidden pb-6">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div
                    key={index}
                    className="h-[430px] w-[280px] shrink-0 animate-pulse rounded-xl border border-slate-200 bg-white sm:w-[300px]"
                  >
                    <div className="aspect-square rounded-t-xl bg-slate-100" />
                    <div className="space-y-3 p-4">
                      <div className="h-3 w-1/3 rounded bg-slate-100" />
                      <div className="h-4 w-5/6 rounded bg-slate-100" />
                      <div className="h-5 w-1/2 rounded bg-slate-100" />
                      <div className="h-10 rounded-lg bg-slate-100" />
                    </div>
                  </div>
                ))}
              </div>
            ) : featuredProducts.length > 0 ? (
              <>
                <div
                  ref={featuredRailRef}
                  className="featured-scroll-rail scrollbar-hide flex gap-6 overflow-x-auto overscroll-x-contain scroll-smooth pb-6"
                  onPointerDown={beginFeaturedDrag}
                  onPointerMove={moveFeaturedDrag}
                  onPointerUp={endFeaturedDrag}
                  onPointerCancel={endFeaturedDrag}
                  onClickCapture={stopFeaturedClickAfterDrag}
                  onScroll={() => {
                    const rail = featuredRailRef.current;
                    if (!rail) return;
                    const first = rail.firstElementChild as HTMLElement | null;
                    if (!first) return;
                    const cardStep = first.offsetWidth + 24;
                    setActiveCardIndex(Math.min(
                      Math.round(rail.scrollLeft / cardStep),
                      featuredProducts.length,
                    ));
                  }}
                >
                  {featuredProducts.map((product) => (
                    <div
                      key={product.id}
                      className="featured-product-card w-[280px] shrink-0 sm:w-[300px] [&>article]:h-full"
                    >
                      <ProductCard product={product} />
                    </div>
                  ))}
                  {/* See more card */}
                  <div className="featured-product-card w-[280px] shrink-0 sm:w-[300px]">
                    <Link
                      href="/marketplace"
                      className={`flex h-full min-h-[430px] flex-col items-center justify-center gap-5 rounded-xl border border-teal-200 bg-gradient-to-br from-teal-50 to-teal-100/70 p-8 text-center transition-all duration-300 hover:-translate-y-1 hover:border-teal-400 hover:shadow-xl hover:shadow-teal-100${featuredScrollDone ? ' featured-see-more-pulse' : ''}`}
                    >
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-500/15 ring-2 ring-teal-300/40 transition-all duration-300 group-hover:bg-teal-500/25">
                        <ArrowRight className="h-8 w-8 text-teal-600" />
                      </div>
                      <div>
                        <p className="font-heading text-xl font-bold text-teal-900">Browse All</p>
                        <p className="font-heading text-xl font-bold text-teal-900">Products</p>
                      </div>
                      <p className="text-sm text-teal-700/80">500+ SKUs across 6 categories</p>
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-teal-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm shadow-teal-500/30">
                        Shop Now
                        <ArrowRight className="h-4 w-4" />
                      </span>
                    </Link>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => scrollFeaturedBy(-1)}
                  className="absolute left-4 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-lg shadow-slate-900/10 transition-all hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 lg:flex"
                  aria-label="Scroll featured products left"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button
                  type="button"
                  onClick={() => scrollFeaturedBy(1)}
                  className="absolute right-4 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border border-slate-200 bg-white/95 text-slate-700 shadow-lg shadow-slate-900/10 transition-all hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 lg:flex"
                  aria-label="Scroll featured products right"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>

                {/* Progress dots */}
                <div className="relative z-10 mt-2 flex justify-center gap-2">
                  {Array.from({ length: featuredProducts.length + 1 }).map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => {
                        const rail = featuredRailRef.current;
                        const first = rail?.firstElementChild as HTMLElement | null;
                        if (!rail || !first) return;
                        pauseFeaturedAutoScroll(2000);
                        rail.scrollTo({ left: i * (first.offsetWidth + 24), behavior: 'smooth' });
                      }}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === activeCardIndex
                          ? 'w-6 bg-teal-500'
                          : 'w-1.5 bg-slate-300 hover:bg-slate-400'
                      }`}
                      aria-label={i < featuredProducts.length ? `Go to product ${i + 1}` : 'See all products'}
                    />
                  ))}
                </div>
              </>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-white px-6 py-10 text-center">
                <p className="text-sm font-medium text-slate-600">
                  Featured products will appear here once housekeeping and stationery products are available.
                </p>
              </div>
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
