/**
 * Dashboard layout — wraps all /buyer, /vendor, and /admin pages.
 *
 * Checks auth state via useAuth(). While the session is resolving, shows
 * a full-page skeleton. If unauthenticated, redirects to /login.
 * (proxy.ts also guards these routes server-side for defence in depth.)
 */

'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Navbar from '@/components/layout/Navbar';
import Sidebar from '@/components/layout/Sidebar';
import MobileMenu from '@/components/layout/MobileMenu';

// ---------------------------------------------------------------------------
// Full-page skeleton shown while session check is in flight
// ---------------------------------------------------------------------------

function DashboardSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 animate-pulse">
      {/* Navbar skeleton */}
      <div className="fixed top-0 inset-x-0 h-16 bg-white border-b border-slate-200 z-40 flex items-center px-4 gap-3">
        <div className="w-8 h-8 rounded-lg bg-slate-200 lg:hidden" />
        <div className="w-28 h-5 rounded bg-slate-200" />
        <div className="hidden sm:block w-28 h-8 rounded-lg bg-slate-200" />
        <div className="ml-auto flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-slate-200" />
          <div className="w-8 h-8 rounded-lg bg-slate-200" />
          <div className="w-9 h-9 rounded-full bg-slate-200" />
        </div>
      </div>
      {/* Sidebar skeleton */}
      <div className="hidden lg:block fixed top-16 left-0 h-[calc(100vh-64px)] w-[260px] bg-white border-r border-slate-200 p-4">
        <div className="flex items-center gap-3 mb-6 pb-4 border-b border-slate-100">
          <div className="w-12 h-12 rounded-full bg-slate-200 flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-slate-200 rounded w-3/4" />
            <div className="h-3 bg-slate-200 rounded w-1/2" />
          </div>
        </div>
        {([1, 2, 3, 4, 5, 6] as const).map((i) => (
          <div key={i} className="flex items-center gap-3 px-3 py-2.5 mb-0.5">
            <div className="w-4 h-4 rounded bg-slate-200 flex-shrink-0" />
            <div className="h-4 bg-slate-200 rounded w-3/4" />
          </div>
        ))}
      </div>
      {/* Content skeleton */}
      <div className="lg:ml-[260px] pt-20 p-6 space-y-4">
        <div className="h-8 bg-slate-200 rounded-lg w-1/3" />
        <div className="h-4 bg-slate-200 rounded w-2/3" />
        <div className="h-4 bg-slate-200 rounded w-1/2" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
          {([1, 2, 3] as const).map((i) => (
            <div key={i} className="h-24 bg-white rounded-xl border border-slate-200" />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/**
 * Authenticated dashboard shell rendered around every /buyer, /vendor, /admin page.
 * Manages the mobile menu open/close state and passes user context down to
 * Navbar, Sidebar, and MobileMenu.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Client-side redirect fallback (proxy.ts handles server-side)
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.replace('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) return <DashboardSkeleton />;
  if (!isAuthenticated || !user) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Top navigation */}
      <Navbar
        user={user}
        onMobileMenuToggle={() => setIsMobileMenuOpen(true)}
      />

      <div className="flex pt-16">
        {/* Desktop sidebar — hidden on mobile */}
        <aside className="hidden lg:block fixed top-16 left-0 h-[calc(100vh-64px)] overflow-y-auto">
          <Sidebar user={user} />
        </aside>

        {/* Page content */}
        <main className="flex-1 min-w-0 lg:ml-[260px] p-4 sm:p-6">
          {children}
        </main>
      </div>

      {/* Mobile slide-out menu */}
      <MobileMenu
        user={user}
        isOpen={isMobileMenuOpen}
        onClose={() => setIsMobileMenuOpen(false)}
      />
    </div>
  );
}
