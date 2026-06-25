'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Package,
  LayoutDashboard,
  BarChart3,
  Users,
  Settings,
  Upload,
  BookUser,
  CreditCard,
  FileText,
  ShoppingCart,
  ClipboardList,
  BadgeCheck,
  FolderOpen,
  type LucideIcon,
} from 'lucide-react';
import type { UserProfile } from '@/types';
import type { UserRole } from '@/types';
import CompanySwitcher from '@/components/buyer/CompanySwitcher';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const BUYER_NAV: NavItem[] = [
  { label: 'Dashboard',          href: '/buyer/account/dashboard',     icon: LayoutDashboard },
  { label: 'Apply for Credit',   href: '/buyer/account/credit-apply',  icon: BadgeCheck },
  { label: 'Profile Details',    href: '/buyer/account/details',       icon: FolderOpen },
  { label: 'Orders',             href: '/buyer/account/orders',        icon: Package },
  { label: 'Credit Overview',    href: '/buyer/account/credit',        icon: CreditCard },
  { label: 'Request Quotation',  href: '/buyer/account/quotes',        icon: FileText },
];

const ADMIN_NAV: NavItem[] = [
  { label: 'Dashboard',          href: '/admin',                       icon: LayoutDashboard },
  { label: 'Clients',            href: '/admin/clients',               icon: LayoutDashboard },
  { label: 'Product Catalog',    href: '/admin/products',              icon: Package },
  { label: 'Import Products',    href: '/admin/products/import',       icon: Upload },
  { label: 'Orders',             href: '/admin/orders',                icon: ShoppingCart },
  { label: 'Quote Requests',     href: '/admin/quotes',                icon: ClipboardList },
  { label: 'Credit Applications', href: '/admin/credit-applications',  icon: BadgeCheck },
  { label: 'Buyers',             href: '/admin/buyers',                icon: Users },
  { label: 'Vendor Directory',   href: '/admin/vendors',               icon: BookUser },
  { label: 'Analytics',          href: '/admin/analytics',             icon: BarChart3 },
  { label: 'Settings',           href: '/admin/settings',              icon: Settings },
];

function getNavItems(role: UserRole, pathname: string): NavItem[] {
  if (role === 'admin') {
    if (pathname.startsWith('/buyer')) return BUYER_NAV;
    return ADMIN_NAV;
  }
  if (role === 'buyer') return BUYER_NAV;
  return [];
}

function getActivePath(pathname: string, items: NavItem[]): string | null {
  for (const item of items) {
    if (pathname === item.href) return item.href;
  }
  let best: string | null = null;
  for (const item of items) {
    if (item.href === '/admin' || item.href === '/vendor' || item.href === '/buyer') continue;
    if (pathname.startsWith(item.href + '/')) {
      if (!best || item.href.length > best.length) best = item.href;
    }
  }
  return best;
}

function getRoleBadgeClass(role: UserRole): string {
  if (role === 'vendor') return 'bg-purple-50 text-purple-700 border border-purple-200';
  if (role === 'admin') return 'bg-rose-50 text-rose-700 border border-rose-200';
  return 'bg-teal-50 text-teal-700 border border-teal-200';
}

function getRoleLabel(role: UserRole): string {
  if (role === 'vendor') return 'Vendor';
  if (role === 'admin') return 'Admin';
  return 'Buyer';
}

interface SidebarProps {
  user: UserProfile;
  onNavClick?: () => void;
}

export default function Sidebar({ user, onNavClick }: SidebarProps) {
  const pathname = usePathname();
  const navItems = getNavItems(user.role, pathname);
  const activePath = getActivePath(pathname, navItems);
  const isAdminViewingBuyer = user.role === 'admin' && pathname.startsWith('/buyer');
  const avatarInitial = user.full_name.charAt(0).toUpperCase();
  const isBuyer = user.role === 'buyer';
  const showCompanySwitcher = isBuyer || isAdminViewingBuyer;

  return (
    <div className="h-full bg-white border-r border-slate-200 w-65 flex flex-col">
      {/* ── User info ─────────────────────────────────────────────────────── */}
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
          <div
            className="w-10 h-10 rounded-full bg-linear-to-br from-teal-500 to-teal-700 text-white font-bold text-base flex items-center justify-center shrink-0 select-none shadow-md shadow-teal-200"
            aria-hidden="true"
          >
            {avatarInitial}
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 truncate text-sm leading-snug">
              {user.full_name}
            </p>
            {user.company_name && (
              <p className="text-xs text-teal-600 truncate mt-0.5">
                {user.company_name}
              </p>
            )}
            {!isBuyer && (
              <span
                className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeClass(user.role)}`}
              >
                {getRoleLabel(user.role)}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ── Company switcher (buyers with multiple companies) ─────────────── */}
      {showCompanySwitcher && (
        <div className="px-3 py-2.5 border-b border-slate-100">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-400 mb-1.5 px-0.5">
            Company
          </p>
          <CompanySwitcher compact />
        </div>
      )}

      {/* ── Admin-in-buyer-view banner ────────────────────────────────────── */}
      {isAdminViewingBuyer && (
        <div className="mx-3 mt-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="text-xs text-amber-700 font-medium">Viewing as Buyer</p>
          <Link
            href="/admin"
            onClick={onNavClick}
            className="text-xs text-teal-600 hover:text-teal-700 hover:underline font-medium"
          >
            ← Back to Admin
          </Link>
        </div>
      )}

      {/* ── Navigation ────────────────────────────────────────────────────── */}
      <nav
        className="flex-1 px-3 py-4 overflow-y-auto scrollbar-hide"
        aria-label="Main navigation"
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = item.href === activePath;

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavClick}
              className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-inset ${
                active
                  ? 'bg-teal-50 text-teal-700 border border-teal-100'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900 border border-transparent'
              }`}
              aria-current={active ? 'page' : undefined}
            >
              {active && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.75 bg-teal-500 rounded-r-full"
                  aria-hidden="true"
                />
              )}
              <Icon
                className={`w-4 h-4 shrink-0 ${active ? 'text-teal-600' : 'text-slate-400'}`}
                aria-hidden="true"
              />
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* ── Footer ────────────────────────────────────────────────────────── */}
      <div className="p-4 border-t border-slate-100">
        <a
          href="mailto:support@primeserve.in"
          className="block text-xs text-teal-600 hover:text-teal-700 transition-colors mb-1.5 focus:outline-none focus:ring-1 focus:ring-teal-500 rounded"
        >
          Need Help?
        </a>
        <p className="text-xs text-slate-400">PrimeServe v1.0 MVP</p>
      </div>
    </div>
  );
}
