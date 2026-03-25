/**
 * useAuth — central auth hook for Primeserve.
 *
 * ⚠️  TEMPORARY — Firebase is bypassed. Forms post directly to the API.
 * TODO: Re-enable Firebase signIn/signUp when auth is configured.
 *
 * On first mount it checks the server session via GET /api/auth/me and
 * restores the Zustand store.
 *
 * Exposed actions:
 *   login(email, password)  → POST /api/auth/login → session cookie
 *   register(data)          → POST /api/auth/register → session cookie
 *   logout()                → POST /api/auth/logout → clear cookie → redirect /login
 */

'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import type { UserProfile } from '@/types';

// ---------------------------------------------------------------------------
// Module-level session check guard (one fetch per browser session)
// ---------------------------------------------------------------------------

let sessionCheckStarted = false;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RegisterData {
  full_name: string;
  email: string;
  password: string;
  /** 10-digit number — +91 prefix is added before sending to API */
  phone: string;
  company_name?: string;
  newsletter_opt_in: boolean;
  terms_accepted: boolean;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Returns auth state and actions. Safe to call in any client component.
 */
export function useAuth() {
  const { user, isLoading, isAuthenticated, setUser, clearUser, setLoading } =
    useAuthStore();
  const router = useRouter();

  // ── Restore session on mount ──────────────────────────────────────────────

  useEffect(() => {
    if (sessionCheckStarted) return;
    sessionCheckStarted = true;

    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (res.ok) {
          const json = (await res.json()) as { user: UserProfile };
          if (json.user) {
            setUser(json.user);
            return;
          }
        }
        clearUser();
      } catch {
        clearUser();
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Dashboard redirect helper ─────────────────────────────────────────────

  /**
   * Pushes the user to their role-specific dashboard.
   * Respects the ?redirect= query param if present.
   */
  const redirectAfterLogin = useCallback(
    (u: UserProfile, redirectOverride?: string | null) => {
      if (redirectOverride) { router.push(redirectOverride); return; }
      if (u.role === 'admin') router.push('/admin');
      else if (u.role === 'vendor') router.push('/vendor');
      else router.push('/buyer/marketplace');
    },
    [router]
  );

  // ── login ─────────────────────────────────────────────────────────────────

  /**
   * Looks up user by email, creates a session cookie.
   * Firebase sign-in is skipped until auth is configured.
   *
   * @param email    - User's email address
   * @param password - Accepted but not verified yet
   * @returns The authenticated UserProfile
   * @throws Error with a human-readable message on failure
   */
  const login = useCallback(
    async (email: string, password: string): Promise<UserProfile> => {
      setLoading(true);
      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
        });
        const json = (await res.json()) as { user?: UserProfile; error?: string; code?: string };

        if (res.status === 404) {
          throw new Error('Account not found. Please register first.');
        }
        if (res.status === 403) {
          throw new Error('Your account has been deactivated. Please contact support.');
        }
        if (!res.ok || !json.user) {
          throw new Error(json.error ?? 'Login failed. Please try again.');
        }

        setUser(json.user);
        return json.user;
      } catch (err) {
        clearUser();
        throw err instanceof Error ? err : new Error('Login failed. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [setUser, clearUser, setLoading]
  );

  // ── register ──────────────────────────────────────────────────────────────

  /**
   * Creates a Supabase user record directly and sets a session cookie.
   * Firebase account creation is skipped until auth is configured.
   *
   * @param data - Registration form data
   * @throws Error with a human-readable message on failure
   */
  const register = useCallback(
    async (data: RegisterData): Promise<void> => {
      setLoading(true);
      try {
        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name:        data.full_name.trim(),
            email:            data.email.trim().toLowerCase(),
            phone:            '+91' + data.phone.replace(/\D/g, ''),
            ...(data.company_name?.trim() ? { company_name: data.company_name.trim() } : {}),
            newsletter_opt_in: data.newsletter_opt_in,
            terms_accepted:    data.terms_accepted,
          }),
        });

        const json = (await res.json()) as { user?: UserProfile; error?: string };

        if (!res.ok || !json.user) {
          throw new Error(json.error ?? 'Registration failed. Please try again.');
        }

        setUser(json.user);
        toast.success('Welcome to PrimeServe!');
        router.push('/buyer/marketplace');
      } catch (err) {
        clearUser();
        throw err instanceof Error ? err : new Error('Registration failed. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [setUser, clearUser, setLoading, router]
  );

  // ── logout ────────────────────────────────────────────────────────────────

  /**
   * Destroys the session cookie and redirects to /login.
   */
  const logout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      clearUser();
      router.push('/login');
      toast.success('Logged out successfully');
    } catch {
      toast.error('Failed to log out. Please try again.');
    }
  }, [clearUser, router]);

  // ── Return ────────────────────────────────────────────────────────────────

  return {
    user,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
    redirectAfterLogin,
  };
}
