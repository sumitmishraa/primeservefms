'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  BadgeCheck,
  Bell,
  Box,
  BriefcaseBusiness,
  Building2,
  Check,
  ChevronLeft,
  ClipboardList,
  Coffee,
  CreditCard,
  FileText,
  FlaskConical,
  Grid3X3,
  Home,
  Loader2,
  Lock,
  Package,
  PenTool,
  Printer,
  Search,
  ShieldCheck,
  ShoppingBag,
  ShoppingCart,
  SlidersHorizontal,
  Sparkles,
  Star,
  User,
  WalletCards,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { CART_KEY } from '@/hooks/useMobileCart';
import type { AuthUser } from '@/types';

export const PS = {
  teal: '#14B8A6',
  tealDark: '#0D9488',
  tealDeep: '#0F766E',
  tealLight: '#2DD4BF',
  tealGlow: '#5EEAD4',
  tealSoft: 'rgba(20, 184, 166, 0.14)',
  tealBorder: 'rgba(45, 212, 191, 0.28)',
  navy: '#0B1220',
  navy2: '#0F1A2E',
  navy3: '#13243F',
  ink: '#0F172A',
  text: '#334155',
  muted: '#64748B',
  mute2: '#94A3B8',
  line: '#E2E8F0',
  line2: '#F1F5F9',
  bg: '#F8FAFC',
  rose: '#F43F5E',
  gold: '#F59E0B',
};

export const categoryImages: Record<string, string> = {
  housekeeping_materials: '/images/categories/housekeeping-materials.png',
  cleaning_chemicals: '/images/categories/cleaning-chemicals.png',
  office_stationeries: '/images/categories/office-stationeries.png',
  pantry_items: '/images/categories/pantry-items.png',
  facility_and_tools: '/images/categories/facility-tools.png',
  printing_solution: '/images/categories/printing-solution.png',
};

export const categoryIconMap: Record<string, LucideIcon> = {
  housekeeping_materials: Sparkles,
  cleaning_chemicals: FlaskConical,
  office_stationeries: PenTool,
  pantry_items: Coffee,
  facility_and_tools: Wrench,
  printing_solution: Printer,
};

export const subcategoryIcons = [
  Sparkles,
  Box,
  ClipboardList,
  FileText,
  Package,
  ShoppingBag,
  ShieldCheck,
  Wrench,
];

export function useAuthStatus() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (!alive) return;
        setUser(d.user ?? null);
      })
      .catch(() => {
        if (alive) setUser(null);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { user, loading, isAuthed: !!user };
}

export function protectedHref(path: string) {
  return `/mobile/login?redirect=${encodeURIComponent(path)}`;
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { loading, isAuthed } = useAuthStatus();

  useEffect(() => {
    if (loading || isAuthed) return;
    const qs = window.location.search.replace(/^\?/, '');
    const redirect = qs ? `${pathname}?${qs}` : pathname;
    router.replace(protectedHref(redirect));
  }, [isAuthed, loading, pathname, router]);

  if (loading || !isAuthed) return <LoadingScreen label="Checking your session" />;
  return <>{children}</>;
}

export function LoadingScreen({ label = 'Loading PrimeServe' }: { label?: string }) {
  return (
    <div className="min-h-dvh bg-[#0B1220] text-white flex flex-col items-center justify-center gap-4 px-6">
      <div className="relative">
        <div className="h-16 w-16 rounded-3xl bg-white flex items-center justify-center shadow-2xl">
          <span className="font-heading text-2xl font-extrabold text-[#0D9488]">P</span>
        </div>
        <span className="absolute -right-1 -top-1 h-4 w-4 rounded-full bg-[#2DD4BF] ps-pulse-dot" />
      </div>
      <div className="text-center">
        <p className="font-heading text-lg font-extrabold">PrimeServe</p>
        <p className="mt-1 text-xs font-medium text-slate-400">{label}</p>
      </div>
      <Loader2 className="h-6 w-6 animate-spin text-[#2DD4BF]" />
    </div>
  );
}

export function MobilePage({
  children,
  className = '',
  withBottomPadding = true,
}: {
  children: React.ReactNode;
  className?: string;
  withBottomPadding?: boolean;
}) {
  return (
    <div className={`ps-screen min-h-dvh bg-[#F8FAFC] text-slate-900 ${withBottomPadding ? 'pb-24' : ''} ${className}`}>
      {children}
    </div>
  );
}

export function BrandMark({ size = 'md' }: { size?: 'sm' | 'md' | 'lg' }) {
  const sizes = {
    sm: 'h-10 w-10 rounded-2xl text-base',
    md: 'h-14 w-14 rounded-3xl text-2xl',
    lg: 'h-20 w-20 rounded-[28px] text-4xl',
  }[size];

  return (
    <div className={`${sizes} bg-white flex items-center justify-center shadow-[0_16px_40px_-22px_rgba(45,212,191,0.9)]`}>
      <span className="font-heading font-extrabold text-[#0D9488]">P</span>
    </div>
  );
}

export function StatusSpacer() {
  return <div className="h-[env(safe-area-inset-top)] min-h-5" />;
}

export function BrandHeader({
  eyebrow,
  title,
  subtitle,
  action,
  children,
  compact = false,
}: {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <header className="relative overflow-hidden bg-[radial-gradient(120%_90%_at_92%_0%,rgba(20,184,166,0.20)_0%,rgba(11,18,32,0)_55%),linear-gradient(180deg,#0B1220_0%,#0F1A2E_100%)] px-5 pb-5 text-white">
      <StatusSpacer />
      <div className="relative z-10 pt-3">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            {eyebrow && <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#5EEAD4]">{eyebrow}</p>}
            <h1 className={`font-heading font-extrabold leading-tight tracking-normal ${compact ? 'text-2xl' : 'text-3xl'}`}>
              {title}
            </h1>
            {subtitle && <p className="mt-1.5 text-sm leading-5 text-slate-300">{subtitle}</p>}
          </div>
          {action}
        </div>
        {children}
      </div>
    </header>
  );
}

export function ScreenHeader({
  title,
  subtitle,
  backHref,
  action,
  variant = 'dark',
}: {
  title: string;
  subtitle?: string;
  backHref?: string;
  action?: React.ReactNode;
  variant?: 'dark' | 'light';
}) {
  const light = variant === 'light';
  return (
    <header className={`${light ? 'bg-white text-slate-900 border-b border-slate-100' : 'bg-[linear-gradient(180deg,#0B1220_0%,#0F1A2E_100%)] text-white'} px-5 pb-4`}>
      <StatusSpacer />
      <div className="flex min-h-12 items-center gap-3 pt-2">
        {backHref && (
          <Link
            href={backHref}
            className={`ps-press flex h-10 w-10 items-center justify-center rounded-full ${light ? 'bg-slate-100 text-slate-900' : 'bg-white/15 text-white'}`}
            aria-label="Go back"
          >
            <ChevronLeft className="h-5 w-5" />
          </Link>
        )}
        <div className="min-w-0 flex-1">
          <h1 className="font-heading text-xl font-extrabold leading-tight">{title}</h1>
          {subtitle && <p className={`${light ? 'text-slate-500' : 'text-slate-300'} mt-0.5 text-xs`}>{subtitle}</p>}
        </div>
        {action}
      </div>
    </header>
  );
}

export function Card({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-slate-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] ${className}`}>
      {children}
    </div>
  );
}

export function DarkCard({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl border border-[rgba(45,212,191,0.28)] bg-[linear-gradient(155deg,#0B1220_0%,#0F1A2E_100%)] text-white ${className}`}>
      {children}
    </div>
  );
}

export function ButtonLink({
  href,
  children,
  icon: Icon = ArrowRight,
  kind = 'primary',
  className = '',
}: {
  href: string;
  children: React.ReactNode;
  icon?: LucideIcon;
  kind?: 'primary' | 'light' | 'ghost';
  className?: string;
}) {
  const styles = {
    primary: 'bg-[#14B8A6] text-white shadow-[0_12px_26px_-18px_rgba(20,184,166,0.9)]',
    light: 'bg-white text-[#0D9488]',
    ghost: 'border border-[#14B8A6] text-[#0D9488] bg-transparent',
  }[kind];
  return (
    <Link
      href={href}
      className={`ps-press inline-flex h-12 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-extrabold ${styles} ${className}`}
    >
      {children}
      <Icon className="h-4 w-4" />
    </Link>
  );
}

export function Badge({
  children,
  tone = 'teal',
}: {
  children: React.ReactNode;
  tone?: 'teal' | 'amber' | 'rose' | 'slate' | 'blue';
}) {
  const tones = {
    teal: 'bg-[rgba(20,184,166,0.14)] text-[#0D9488]',
    amber: 'bg-amber-100 text-amber-800',
    rose: 'bg-rose-100 text-rose-800',
    slate: 'bg-slate-100 text-slate-600',
    blue: 'bg-blue-100 text-blue-800',
  }[tone];
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.12em] ${tones}`}>{children}</span>;
}

export function SearchPill({
  href,
  placeholder = 'Search products...',
}: {
  href: string;
  placeholder?: string;
}) {
  return (
    <Link href={href} className="ps-press mt-4 flex h-12 items-center gap-3 rounded-2xl bg-white px-4 shadow-sm">
      <Search className="h-5 w-5 text-slate-400" />
      <span className="flex-1 text-sm font-medium text-slate-400">{placeholder}</span>
      <SlidersHorizontal className="h-5 w-5 text-slate-400" />
    </Link>
  );
}

export function EmptyState({
  icon: Icon = Package,
  title,
  body,
  action,
}: {
  icon?: LucideIcon;
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-8 py-16 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-[28px] bg-[rgba(20,184,166,0.14)]">
        <Icon className="h-9 w-9 text-[#0D9488]" />
      </div>
      <h2 className="mt-5 font-heading text-xl font-extrabold text-slate-900">{title}</h2>
      <p className="mt-2 max-w-xs text-sm leading-6 text-slate-500">{body}</p>
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ProductThumb({
  src,
  alt,
  className = '',
}: {
  src?: string | null;
  alt: string;
  className?: string;
}) {
  return (
    <div className={`relative flex items-center justify-center overflow-hidden rounded-2xl bg-slate-50 ${className}`}>
      {src ? (
        <Image src={src} alt={alt} fill className="object-contain p-2" sizes="120px" />
      ) : (
        <Package className="h-9 w-9 text-slate-300" />
      )}
    </div>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem(CART_KEY);
        const items: { quantity: number }[] = raw ? JSON.parse(raw) : [];
        setCartCount(items.reduce((sum, item) => sum + item.quantity, 0));
      } catch {
        setCartCount(0);
      }
    };
    read();
    window.addEventListener('cart-updated', read);
    return () => window.removeEventListener('cart-updated', read);
  }, []);

  const tabs = useMemo(
    () => [
      { href: '/mobile/home', label: 'Home', icon: Home },
      { href: '/mobile/credits', label: 'Credits', icon: WalletCards },
      { href: '/mobile/categories', label: 'Categories', icon: Grid3X3 },
      { href: '/mobile/cart', label: 'Cart', icon: ShoppingCart, count: cartCount },
      { href: '/mobile/account', label: 'Account', icon: User },
    ],
    [cartCount],
  );

  return (
    <nav className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white pb-[max(18px,env(safe-area-inset-bottom))] pt-2 shadow-[0_-14px_28px_-28px_rgba(15,23,42,0.35)]">
      <div className="grid grid-cols-5">
        {tabs.map((tab) => {
          const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`ps-press relative flex flex-col items-center gap-1 px-1 py-1 ${active ? 'text-[#0D9488]' : 'text-slate-400'}`}
            >
              {active && <span className="absolute -top-2 left-1/2 h-1 w-7 -translate-x-1/2 rounded-full bg-[#14B8A6]" />}
              <span className="relative">
                <Icon className="h-6 w-6" strokeWidth={active ? 2.5 : 2} />
                {!!tab.count && (
                  <span className="absolute -right-2.5 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full border border-white bg-[#F43F5E] px-1 text-[9px] font-extrabold leading-none text-white">
                    {tab.count > 9 ? '9+' : tab.count}
                  </span>
                )}
              </span>
              <span className={`text-[10px] font-extrabold leading-none ${active ? 'text-[#0D9488]' : 'text-slate-400'}`}>{tab.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export const mobileIcons = {
  ArrowRight,
  BadgeCheck,
  Bell,
  Box,
  BriefcaseBusiness,
  Building2,
  Check,
  CreditCard,
  Grid3X3,
  Home,
  Lock,
  Search,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Star,
  User,
  WalletCards,
  Zap,
};
