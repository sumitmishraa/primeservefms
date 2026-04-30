/**
 * Navbar — fixed top bar (64 px) with hamburger, logo, search, and right-side controls.
 *
 * - Left: hamburger (mobile only) + PrimeServe logo
 * - Center: search bar (hidden on mobile) — navigates to /marketplace?q=
 * - Right: cart icon (buyers only) + bell + user avatar dropdown
 */

'use client';

import Link from 'next/link';
import { Menu, ShoppingCart, Bell, Home } from 'lucide-react';
import type { UserProfile } from '@/types';
import UserMenu from './UserMenu';
import { useCartStore } from '@/stores/cartStore';

interface NavbarProps {
  /** Authenticated user — drives role-based visibility (e.g. cart icon) */
  user: UserProfile;
  /** Called when the hamburger icon is pressed on mobile */
  onMobileMenuToggle: () => void;
}

/**
 * Top navigation bar fixed at the top of every dashboard page.
 * The cart icon only appears for buyers. Notification and cart counts will
 * be wired to real stores in Phase 4 / Phase 5.
 *
 * @param user - The currently authenticated user
 * @param onMobileMenuToggle - Opens the MobileMenu slide-out panel
 */
export default function Navbar({ user, onMobileMenuToggle }: NavbarProps) {
  const cartCount = useCartStore((state) => state.items.length);
  const notificationCount = 0;

  const dashboardHref =
    user.role === 'admin'
      ? '/admin'
      : user.role === 'vendor'
        ? '/vendor'
        : '/buyer/marketplace';

  return (
    <header className="fixed top-0 inset-x-0 h-16 bg-white border-b border-slate-200 z-40 flex items-center px-4 gap-3">
      {/* ── Left: hamburger + logo ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 flex-shrink-0">
        <button
          onClick={onMobileMenuToggle}
          className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" aria-hidden="true" />
        </button>
        <Link
          href={dashboardHref}
          className="text-xl font-bold text-teal-600 tracking-tight focus:outline-none focus:ring-2 focus:ring-teal-500 rounded"
        >
          PrimeServe
        </Link>
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:border-teal-300 hover:bg-teal-50 hover:text-teal-700 sm:px-3"
        >
          <Home className="h-3.5 w-3.5" aria-hidden="true" />
          Back to Home
        </Link>
      </div>

      {/* ── Center: search bar (desktop) ──────────────────────────────────── */}
      {/* ── Right: cart, bell, avatar ─────────────────────────────────────── */}
      <div className="ml-auto flex items-center gap-1">
        {/* Cart — buyers only */}
        {user.role === 'buyer' && (
          <Link
            href="/buyer/cart"
            className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
            aria-label={
              cartCount > 0 ? `Cart — ${cartCount} items` : 'Cart — empty'
            }
          >
            <ShoppingCart className="w-5 h-5" aria-hidden="true" />
            {cartCount > 0 && (
              <span className="absolute top-1 right-1 min-w-4 h-4 bg-rose-500 text-white text-xs rounded-full flex items-center justify-center px-1 font-mono leading-none">
                {cartCount > 99 ? '99+' : cartCount}
              </span>
            )}
          </Link>
        )}

        {/* Bell notifications */}
        <button
          className="relative p-2 rounded-lg text-slate-600 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
          aria-label={
            notificationCount > 0
              ? `Notifications — ${notificationCount} unread`
              : 'Notifications'
          }
        >
          <Bell className="w-5 h-5" aria-hidden="true" />
          {notificationCount > 0 && (
            <span
              className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full"
              aria-hidden="true"
            />
          )}
        </button>

        {/* User avatar + dropdown */}
        <UserMenu user={user} />
      </div>
    </header>
  );
}
