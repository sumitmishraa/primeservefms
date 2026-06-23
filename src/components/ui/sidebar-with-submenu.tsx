'use client';

/**
 * Sidebar with collapsible submenu support — dark navy glass.
 * Adapted for Primeserve buyer navigation.
 * Drop-in replacement if the main Sidebar ever needs nested nav groups.
 */

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import {
  LayoutDashboard, Package, CreditCard, FileText,
  BadgeCheck, FolderOpen, ChevronDown, type LucideIcon,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface NavLeaf {
  kind: 'leaf';
  label: string;
  href: string;
  icon: LucideIcon;
}

interface NavGroup {
  kind: 'group';
  label: string;
  icon: LucideIcon;
  children: NavLeaf[];
}

type NavItem = NavLeaf | NavGroup;

// ─── Nav structure ────────────────────────────────────────────────────────────

const NAV: NavItem[] = [
  {
    kind: 'leaf',
    label: 'Dashboard',
    href: '/buyer/account/dashboard',
    icon: LayoutDashboard,
  },
  {
    kind: 'group',
    label: 'Orders',
    icon: Package,
    children: [
      { kind: 'leaf', label: 'All Orders',   href: '/buyer/account/orders',           icon: Package },
      { kind: 'leaf', label: 'Track Orders', href: '/buyer/account/orders?status=all', icon: Package },
    ],
  },
  {
    kind: 'group',
    label: 'Credit',
    icon: CreditCard,
    children: [
      { kind: 'leaf', label: 'Credit Overview', href: '/buyer/account/credit',       icon: CreditCard  },
      { kind: 'leaf', label: 'Apply for Credit', href: '/buyer/account/credit-apply', icon: BadgeCheck  },
    ],
  },
  {
    kind: 'leaf',
    label: 'Quotations',
    href: '/buyer/account/quotes',
    icon: FileText,
  },
  {
    kind: 'leaf',
    label: 'Profile Details',
    href: '/buyer/account/details',
    icon: FolderOpen,
  },
];

// ─── Components ───────────────────────────────────────────────────────────────

function Leaf({ item, onClick }: { item: NavLeaf; onClick?: () => void }) {
  const pathname = usePathname();
  const active = pathname === item.href || pathname.startsWith(item.href + '/');
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onClick}
      className={`relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-inset ${
        active
          ? 'bg-teal-500/15 text-teal-400 border border-teal-500/20'
          : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border border-transparent'
      }`}
      aria-current={active ? 'page' : undefined}
    >
      {active && (
        <span className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-0.75 bg-teal-400 rounded-r-full" aria-hidden />
      )}
      <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-teal-400' : 'text-slate-500'}`} aria-hidden />
      {item.label}
    </Link>
  );
}

function Group({ item, onClick }: { item: NavGroup; onClick?: () => void }) {
  const pathname = usePathname();
  const anyChildActive = item.children.some((c) => pathname.startsWith(c.href));
  const [open, setOpen] = useState(anyChildActive);
  const Icon = item.icon;

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-inset border ${
          anyChildActive
            ? 'bg-teal-500/10 text-teal-400 border-teal-500/15'
            : 'text-slate-400 hover:bg-white/5 hover:text-slate-200 border-transparent'
        }`}
        aria-expanded={open}
      >
        <Icon className={`w-4 h-4 shrink-0 ${anyChildActive ? 'text-teal-400' : 'text-slate-500'}`} aria-hidden />
        <span className="flex-1 text-left">{item.label}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 transition-transform duration-200 ${open ? 'rotate-180' : ''} ${anyChildActive ? 'text-teal-400/60' : 'text-slate-600'}`}
          aria-hidden
        />
      </button>

      <div className={`overflow-hidden transition-all duration-200 ${open ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'}`}>
        <div className="ml-4 mt-0.5 pl-3 border-l border-white/8 space-y-0.5 py-1">
          {item.children.map((child) => (
            <Leaf key={child.href} item={child} onClick={onClick} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

interface SidebarWithSubmenuProps {
  onNavClick?: () => void;
}

export default function SidebarWithSubmenu({ onNavClick }: SidebarWithSubmenuProps) {
  return (
    <nav className="flex-1 px-3 py-4 overflow-y-auto scrollbar-hide space-y-0.5" aria-label="Main navigation">
      {NAV.map((item) =>
        item.kind === 'leaf'
          ? <Leaf key={item.href} item={item} onClick={onNavClick} />
          : <Group key={item.label} item={item} onClick={onNavClick} />,
      )}
    </nav>
  );
}
