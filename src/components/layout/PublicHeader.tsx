'use client';

import { useState, useRef, useEffect, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Search,
  ShoppingCart,
  ChevronDown,
  Sparkles,
  FlaskConical,
  PenTool,
  Coffee,
  Wrench,
  Printer,
  User,
  Crown,
  Phone,
  Menu,
  X,
  Loader2,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCartStore } from '@/stores/cartStore';
import { PRODUCT_CATEGORIES, getSubcategoriesByCategory } from '@/lib/constants/categories';

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  Sparkles,
  FlaskConical,
  PenTool,
  Coffee,
  Wrench,
  Printer,
};

// Close-delay for hover menus — lets users cross the gap between trigger and dropdown
const HOVER_CLOSE_DELAY_MS = 200;

// Number of subcategories to show inside each dark-strip dropdown before "See more"
const STRIP_SUBCATEGORY_PREVIEW = 5;

export default function PublicHeader() {
  const router = useRouter();
  // Use useAuth (not useAuthStore) so the session-check useEffect actually
  // runs on public pages. Calling useAuthStore alone subscribes to the store
  // but never triggers /api/auth/me — which would leave isLoading stuck on
  // true for every visitor who lands on /, /pro, /about, etc.
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth();
  const cartCount = useCartStore((s) => s.items.length);

  // Until the /api/auth/me check has resolved we don't know which auth button
  // to show. Render a fixed-width placeholder to avoid both layout shift and
  // flashing the wrong button (e.g. showing "Sign In" to a logged-in user, or
  // — worse — flashing a Dashboard link to a logged-out visitor).
  const authResolved = !isAuthLoading;

  const [searchQuery, setSearchQuery] = useState('');
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openStripCategory, setOpenStripCategory] = useState<string | null>(null);

  const categoriesHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stripRef = useRef<HTMLDivElement>(null);

  // Close the strip dropdown on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (stripRef.current && !stripRef.current.contains(e.target as Node)) {
        setOpenStripCategory(null);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // Close strip dropdown on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpenStripCategory(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const openCategoriesMenu = () => {
    if (categoriesHoverTimer.current) {
      clearTimeout(categoriesHoverTimer.current);
      categoriesHoverTimer.current = null;
    }
    setCategoriesOpen(true);
  };

  const scheduleCloseCategoriesMenu = () => {
    if (categoriesHoverTimer.current) clearTimeout(categoriesHoverTimer.current);
    categoriesHoverTimer.current = setTimeout(() => {
      setCategoriesOpen(false);
    }, HOVER_CLOSE_DELAY_MS);
  };

  const handleSearch = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) router.push(`/marketplace?search=${encodeURIComponent(q)}`);
  };

  const dashboardHref =
    user?.role === 'admin'
      ? '/admin'
      : user?.role === 'vendor'
        ? '/vendor'
        : '/buyer';

  // Label the dashboard button by role so it can never be visually confused
  // with the adjacent "Pro Plan" CTA (the previous "Dashboard" wording was
  // ambiguous and users were clicking it expecting Pro).
  const dashboardLabel =
    user?.role === 'admin'
      ? 'Admin'
      : user?.role === 'vendor'
        ? 'Vendor'
        : 'My Account';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-slate-200 bg-white">
      {/* Top bar */}
      <div className="mx-auto flex h-[72px] max-w-7xl items-center gap-6 px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link href="/" className="flex shrink-0 items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900 font-heading text-base font-bold text-white">
            P
          </div>
          <span className="font-heading text-xl font-bold tracking-tight text-slate-900">
            Prime<span className="text-teal-600">Serve</span>
          </span>
        </Link>

        {/* Search — desktop */}
        <form
          onSubmit={handleSearch}
          className="hidden flex-1 md:block"
          role="search"
        >
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search products, categories..."
              className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 pl-11 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
            />
          </div>
        </form>

        {/* Desktop nav links */}
        <nav className="hidden items-center gap-6 lg:flex">
          <div
            className="relative z-50"
            onMouseEnter={openCategoriesMenu}
            onMouseLeave={scheduleCloseCategoriesMenu}
          >
            <button
              type="button"
              aria-expanded={categoriesOpen}
              aria-haspopup="true"
              className="flex items-center gap-1 text-sm font-semibold text-slate-700 hover:text-teal-600"
            >
              Categories
              <ChevronDown
                className={`h-4 w-4 transition-transform ${categoriesOpen ? 'rotate-180' : ''}`}
              />
            </button>

            <div
              onMouseEnter={openCategoriesMenu}
              onMouseLeave={scheduleCloseCategoriesMenu}
              className={`absolute left-1/2 top-full z-50 w-64 -translate-x-1/2 pt-3 transition-opacity duration-150 ${
                categoriesOpen
                  ? 'pointer-events-auto opacity-100'
                  : 'pointer-events-none opacity-0'
              }`}
              role="menu"
            >
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                {PRODUCT_CATEGORIES.map((cat) => {
                  const Icon = CATEGORY_ICONS[cat.icon] ?? Sparkles;
                  return (
                    <Link
                      key={cat.value}
                      href={`/marketplace?category=${cat.value}`}
                      onClick={() => setCategoriesOpen(false)}
                      role="menuitem"
                      className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 transition-colors hover:bg-teal-50 hover:text-teal-700"
                    >
                      <Icon className="h-4 w-4" />
                      <span>{cat.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
          </div>

          <Link href="/about" className="text-sm font-semibold text-slate-700 hover:text-teal-600">
            About Us
          </Link>
          <Link href="/contact" className="text-sm font-semibold text-slate-700 hover:text-teal-600">
            Contact Us
          </Link>
        </nav>

        {/* Right: phone + cart + Pro Plan + Sign In */}
        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <a
            href="tel:+919876543210"
            className="hidden items-center gap-2 text-sm font-semibold text-slate-700 hover:text-teal-600 xl:flex"
          >
            <Phone className="h-4 w-4" />
            +91 98765 43210
          </a>

          <Link
            href={isAuthenticated && user?.role === 'buyer' ? '/buyer/cart' : '/login?redirect=/buyer/cart'}
            className="relative flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 transition-colors hover:bg-slate-100 hover:text-teal-600"
            aria-label="Cart"
          >
            <ShoppingCart className="h-5 w-5" />
            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 font-mono text-[10px] font-bold leading-none text-white">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </Link>

          <Link
            href="/pro"
            className="hidden items-center gap-2 rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-teal-700 sm:flex"
          >
            <Crown className="h-4 w-4" />
            Pro Plan
          </Link>

          {!authResolved ? (
            // Loading placeholder — same width as the real button to prevent
            // a layout shift (and any flash of the wrong button) the moment
            // auth state resolves.
            <div
              aria-hidden="true"
              className="flex h-[38px] w-[112px] items-center justify-center rounded-lg border border-slate-200 sm:w-[124px]"
            >
              <Loader2 className="h-4 w-4 animate-spin text-slate-300" />
            </div>
          ) : isAuthenticated ? (
            <Link
              href={dashboardHref}
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-teal-500 hover:text-teal-600"
            >
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">{dashboardLabel}</span>
            </Link>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-teal-500 hover:text-teal-600"
            >
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Sign In</span>
            </Link>
          )}

          {/* Mobile menu toggle */}
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Secondary category strip — desktop (click-triggered subcategory dropdowns) */}
      <div className="hidden border-t border-slate-100 bg-slate-900 lg:block">
        <nav
          ref={stripRef}
          className="relative mx-auto flex h-12 max-w-7xl items-center gap-1 px-4 sm:px-6 lg:px-8"
        >
          {PRODUCT_CATEGORIES.slice(0, 6).map((cat) => {
            const subs = getSubcategoriesByCategory(cat.value);
            const isOpen = openStripCategory === cat.value;
            return (
              <div key={cat.value} className="relative">
                <button
                  type="button"
                  onClick={() =>
                    setOpenStripCategory((curr) => (curr === cat.value ? null : cat.value))
                  }
                  aria-expanded={isOpen}
                  aria-haspopup="true"
                  className={`flex items-center gap-1 rounded px-3 py-1.5 text-[13px] font-medium transition-colors ${
                    isOpen
                      ? 'bg-slate-800 text-white'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  {cat.label}
                  <ChevronDown
                    className={`h-3 w-3 opacity-60 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>

                <div
                  className={`absolute left-0 top-full z-50 w-72 pt-2 transition-all duration-150 ${
                    isOpen
                      ? 'pointer-events-auto translate-y-0 opacity-100'
                      : 'pointer-events-none -translate-y-1 opacity-0'
                  }`}
                  role="menu"
                >
                  <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-xl">
                    {subs.length > 0 ? (
                      <>
                        {subs.slice(0, STRIP_SUBCATEGORY_PREVIEW).map((sub) => (
                          <Link
                            key={sub.slug}
                            href={`/marketplace?category=${cat.value}&subcategory=${sub.slug}`}
                            onClick={() => setOpenStripCategory(null)}
                            role="menuitem"
                            className="block rounded-lg px-3 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 hover:text-teal-600"
                          >
                            {sub.label}
                          </Link>
                        ))}
                        <div className="my-1 h-px bg-slate-100" />
                        <Link
                          href={`/marketplace?category=${cat.value}`}
                          onClick={() => setOpenStripCategory(null)}
                          role="menuitem"
                          className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-50"
                        >
                          See more
                          <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
                        </Link>
                      </>
                    ) : (
                      <Link
                        href={`/marketplace?category=${cat.value}`}
                        onClick={() => setOpenStripCategory(null)}
                        role="menuitem"
                        className="flex items-center justify-between rounded-lg px-3 py-2 text-sm font-semibold text-teal-700 hover:bg-teal-50"
                      >
                        View products
                        <ChevronDown className="h-3.5 w-3.5 -rotate-90" />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </nav>
      </div>

      {/* Mobile slide-out menu */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute right-0 top-0 h-full w-[85%] max-w-sm overflow-y-auto bg-white p-6">
            <div className="mb-6 flex items-center justify-between">
              <span className="font-heading text-lg font-bold">
                Prime<span className="text-teal-600">Serve</span>
              </span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav className="space-y-1">
              <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase text-slate-400">
                Categories
              </p>
              {PRODUCT_CATEGORIES.map((cat) => (
                <Link
                  key={cat.value}
                  href={`/marketplace?category=${cat.value}`}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 hover:text-teal-600"
                >
                  {cat.label}
                </Link>
              ))}
              <div className="my-3 border-t border-slate-100" />
              <Link
                href="/about"
                onClick={() => setMobileOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                About Us
              </Link>
              <Link
                href="/contact"
                onClick={() => setMobileOpen(false)}
                className="block rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Contact Us
              </Link>
              <Link
                href="/pro"
                onClick={() => setMobileOpen(false)}
                className="mt-4 flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-3 text-sm font-semibold text-white hover:bg-teal-700"
              >
                <Crown className="h-4 w-4" /> Pro Plan
              </Link>
              {authResolved && (
                isAuthenticated ? (
                  <Link
                    href={dashboardHref}
                    onClick={() => setMobileOpen(false)}
                    className="mt-2 flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <User className="h-4 w-4" /> {dashboardLabel}
                  </Link>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setMobileOpen(false)}
                    className="mt-2 flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    <User className="h-4 w-4" /> Sign In
                  </Link>
                )
              )}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
