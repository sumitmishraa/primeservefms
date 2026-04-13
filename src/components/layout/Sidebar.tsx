/**
 * Sidebar — role-aware left navigation panel.
 *
 * Shows different nav items for buyer, vendor, and admin.
 * The active item is detected via usePathname().
 * Optional onNavClick prop lets MobileMenu close itself when a link is clicked.
 */

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Store,
  Package,
  RefreshCw,
  ShoppingCart,
  User,
  LayoutDashboard,
  BarChart3,
  Users,
  Settings,
  Upload,
  BookUser,
  Building2,
  type LucideIcon,
} from 'lucide-react';
import type { UserProfile } from '@/types';
import type { UserRole } from '@/types';
import { useCartStore } from '@/stores/cartStore';

// ---------------------------------------------------------------------------
// Nav item definitions per role
// ---------------------------------------------------------------------------

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const BUYER_NAV: NavItem[] = [
  { label: 'Marketplace', href: '/marketplace', icon: Store },
  { label: 'My Orders', href: '/buyer/orders', icon: Package },
  { label: 'Quick Reorder', href: '/buyer/reorder', icon: RefreshCw },
  { label: 'Cart', href: '/buyer/cart', icon: ShoppingCart },
  { label: 'My Profile', href: '/buyer/profile', icon: User },
];

const ADMIN_NAV: NavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: LayoutDashboard },
  { label: 'Clients', href: '/admin/clients', icon: Building2 },
  { label: 'Product Catalog', href: '/admin/products', icon: Package },
  { label: 'Import Products', href: '/admin/products/import', icon: Upload },
  { label: 'Orders', href: '/admin/orders', icon: ShoppingCart },
  { label: 'Buyers', href: '/admin/buyers', icon: Users },
  { label: 'Vendor Directory', href: '/admin/vendors', icon: BookUser },
  { label: 'Analytics', href: '/admin/analytics', icon: BarChart3 },
  { label: 'Settings', href: '/admin/settings', icon: Settings },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Returns the correct nav array for the given role.
 * Vendors have no app dashboard — return empty nav.
 * @param role - The user's role
 */
function getNavItems(role: UserRole): NavItem[] {
  if (role === 'admin') return ADMIN_NAV;
  if (role === 'buyer') return BUYER_NAV;
  return [];
}

/**
 * Finds the single active nav href using longest-prefix matching.
 * When two nav items could match the same pathname (e.g. /admin/products and
 * /admin/products/import), the most specific one wins.
 *
 * @param pathname - Current URL pathname
 * @param items - Nav items for the current role
 * @returns The href of the active item, or null if none match
 */
function getActivePath(pathname: string, items: NavItem[]): string | null {
  // Exact match always wins immediately
  for (const item of items) {
    if (pathname === item.href) return item.href;
  }
  // Prefix match — pick the longest (most specific) match
  let best: string | null = null;
  for (const item of items) {
    // Root dashboard items only ever match exactly (handled above)
    if (item.href === '/admin' || item.href === '/vendor' || item.href === '/buyer') continue;
    if (pathname.startsWith(item.href + '/')) {
      if (!best || item.href.length > best.length) best = item.href;
    }
  }
  return best;
}

/**
 * Returns Tailwind classes for the role badge colour.
 * @param role - The user's role
 */
function getRoleBadgeClass(role: UserRole): string {
  if (role === 'vendor') return 'bg-purple-100 text-purple-700';
  if (role === 'admin') return 'bg-rose-100 text-rose-700';
  return 'bg-blue-100 text-blue-700';
}

/**
 * Returns the display label for a role.
 * @param role - The user's role
 */
function getRoleLabel(role: UserRole): string {
  if (role === 'vendor') return 'Vendor';
  if (role === 'admin') return 'Admin';
  return 'Buyer';
}


// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface SidebarProps {
  /** Authenticated user — drives avatar, name, company, role badge, and nav items */
  user: UserProfile;
  /** Called when a nav link is clicked — used by MobileMenu to close itself */
  onNavClick?: () => void;
}

/**
 * Left sidebar with user identity header, role-based nav links, and a footer.
 * Renders as a fixed panel on desktop; inside MobileMenu on small screens.
 *
 * @param user - The currently authenticated user
 * @param onNavClick - Optional callback fired on any nav link click
 */
export default function Sidebar({ user, onNavClick }: SidebarProps) {
  const pathname = usePathname();
  const navItems = getNavItems(user.role);
  const activePath = getActivePath(pathname, navItems);
  const avatarInitial = user.full_name.charAt(0).toUpperCase();
  const cartCount = useCartStore((s) => s.getItemCount());

  return (
    <div className="h-full bg-white border-r border-slate-200 w-65 flex flex-col">
      {/* ── User info ─────────────────────────────────────────────────────── */}
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-full bg-teal-600 text-white font-bold text-lg flex items-center justify-center shrink-0 select-none"
            aria-hidden="true"
          >
            {avatarInitial}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 truncate text-sm leading-snug">
              {user.full_name}
            </p>
            {user.company_name && (
              <p className="text-xs text-slate-500 truncate mt-0.5">
                {user.company_name}
              </p>
            )}
            <span
              className={`inline-block mt-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeClass(user.role)}`}
            >
              {getRoleLabel(user.role)}
            </span>
          </div>
        </div>
      </div>

      {/* ── Navigation ────────────────────────────────────────────────────── */}
      <nav
        className="flex-1 px-3 py-4 overflow-y-auto"
        aria-label="Main navigation"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.href === activePath;
          const isCart = item.href === '/buyer/cart';

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-lg mb-0.5 text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-inset ${
                active
                  ? 'bg-teal-50 text-teal-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              {/* Active indicator bar */}
              {active && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.75 bg-teal-600 rounded-r-full"
                  aria-hidden="true"
                />
              )}
              <Icon
                className={`w-4 h-4 shrink-0 ${active ? 'text-teal-600' : 'text-slate-400'}`}
                aria-hidden="true"
              />
              {item.label}
              {/* Cart item count badge */}
              {isCart && cartCount > 0 && (
                <span className="ml-auto min-w-5 h-5 px-1.5 flex items-center justify-center rounded-full bg-teal-600 text-white text-xs font-bold">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div className="p-4 border-t border-slate-100">
        <a
          href="mailto:support@primeserve.in"
          className="block text-xs text-teal-600 hover:underline mb-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500 rounded"
        >
          Need Help?
        </a>
        <p className="text-xs text-slate-400">PrimeServe v1.0 MVP</p>
      </div>
    </div>
  );
}
