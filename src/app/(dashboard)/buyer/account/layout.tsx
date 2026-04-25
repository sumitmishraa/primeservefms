'use client';

/**
 * Account area layout — left sub-nav + content area.
 * Nested inside the main (dashboard) layout which already provides the
 * Navbar and main Sidebar.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  User,
  Building2,
  CreditCard,
  Package,
  FileText,
  type LucideIcon,
} from 'lucide-react';

interface AccountNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  description: string;
}

const ACCOUNT_NAV: AccountNavItem[] = [
  { label: 'Profile Settings', href: '/buyer/account/profile', icon: User, description: 'Name, phone, email' },
  { label: 'Company Details', href: '/buyer/account/company', icon: Building2, description: 'Business, GST, address' },
  { label: 'Credit Overview', href: '/buyer/account/credit', icon: CreditCard, description: 'Limit, usage, status' },
  { label: 'Order History', href: '/buyer/account/orders', icon: Package, description: 'All past orders' },
  { label: 'Quote Requests', href: '/buyer/account/quotes', icon: FileText, description: 'Monthly requirements' },
];

export default function AccountLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  const isActive = (href: string) =>
    pathname === href || pathname.startsWith(href + '/');

  return (
    <div className="min-h-[calc(100vh-4rem)] bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page title */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-slate-900 font-heading">Account Settings</h1>
          <p className="text-sm text-slate-500 mt-1">Manage your profile, company, and preferences</p>
        </div>

        <div className="flex gap-6 items-start">
          {/* ── Left sub-nav ─────────────────────────────────────────────── */}
          <nav
            className="hidden md:flex flex-col w-56 shrink-0 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden"
            aria-label="Account navigation"
          >
            {ACCOUNT_NAV.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex items-center gap-3 px-4 py-3.5 text-sm font-medium transition-colors border-b border-slate-100 last:border-0 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-500 ${
                    active
                      ? 'bg-teal-50 text-teal-700'
                      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                  aria-current={active ? 'page' : undefined}
                >
                  {active && (
                    <span
                      className="absolute left-0 top-1/2 -translate-y-1/2 h-8 w-0.5 bg-teal-600 rounded-r-full"
                      aria-hidden="true"
                    />
                  )}
                  <Icon
                    className={`w-4 h-4 shrink-0 ${active ? 'text-teal-600' : 'text-slate-400'}`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0">
                    <div className="truncate">{item.label}</div>
                    <div className="text-xs font-normal text-slate-400 truncate">{item.description}</div>
                  </div>
                </Link>
              );
            })}
          </nav>

          {/* ── Mobile nav (horizontal tabs) ─────────────────────────────── */}
          <div className="md:hidden w-full mb-0">
            <div className="flex overflow-x-auto gap-1 bg-white rounded-xl border border-slate-200 shadow-sm p-1.5">
              {ACCOUNT_NAV.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-colors ${
                      active
                        ? 'bg-teal-600 text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>

          {/* ── Content ──────────────────────────────────────────────────── */}
          <main className="flex-1 min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}
