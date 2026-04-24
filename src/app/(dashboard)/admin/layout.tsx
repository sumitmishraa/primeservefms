/**
 * Admin section layout — defense-in-depth role guard for /admin/*.
 *
 * proxy.ts is the authoritative gate (server-side, runs on every request).
 * This layout adds a second client-side check so that even if the proxy
 * matcher ever misses a path or a stale client navigates between routes,
 * a non-admin user is bounced before any admin UI mounts.
 */

'use client';

import { useEffect, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';

export default function AdminLayout({ children }: { children: ReactNode }) {
  const { user, isLoading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!isAuthenticated || user?.role !== 'admin') {
      router.replace('/');
    }
  }, [isLoading, isAuthenticated, user, router]);

  // Don't render admin UI until we've confirmed the role on the client.
  // The parent (dashboard)/layout.tsx already shows a skeleton while
  // isLoading, so returning null here is fine — it just hides admin
  // content during the brief moment between session restore and the
  // role-mismatch redirect kicking in.
  if (isLoading || !isAuthenticated || user?.role !== 'admin') {
    return null;
  }

  return <>{children}</>;
}
