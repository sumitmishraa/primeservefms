/**
 * useAuth — central auth hook for Primeserve.
 *
 * Email + Password auth only. No OTP, no reCAPTCHA, no phone verification.
 *
 * On first mount it checks the server session via GET /api/auth/me and
 * restores the Zustand store. A module-level flag prevents the check from
 * running more than once per browser session.
 *
 * Exposed actions:
 *   login(email, password)  → Firebase signInWithEmailAndPassword → session cookie
 *   register(data)          → Firebase createUserWithEmailAndPassword → session cookie
 *   logout()                → Firebase signOut → clear cookie → redirect /login
 */

'use client';

import { useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import toast from 'react-hot-toast';
import { auth } from '@/lib/firebase/config';
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
 *
 * @example
 *   const { user, isAuthenticated, login, logout } = useAuth();
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
   * Signs in with email + password via Firebase, then exchanges the ID token
   * for a Primeserve session cookie.
   *
   * @param email    - User's email address
   * @param password - User's password
   * @returns The authenticated UserProfile
   * @throws Error with a human-readable message on failure
   */
  const login = useCallback(
    async (email: string, password: string): Promise<UserProfile> => {
      setLoading(true);
      try {
        const credential = await signInWithEmailAndPassword(auth, email, password);
        const idToken = await credential.user.getIdToken();

        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ firebase_token: idToken }),
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
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('invalid-credential') || msg.includes('wrong-password') || msg.includes('INVALID_LOGIN_CREDENTIALS')) {
          throw new Error('Invalid email or password. Please try again.');
        }
        if (msg.includes('user-not-found')) {
          throw new Error('No account found with this email. Please register first.');
        }
        if (msg.includes('too-many-requests')) {
          throw new Error('Too many failed attempts. Please wait a few minutes and try again.');
        }
        throw err instanceof Error ? err : new Error('Login failed. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [setUser, clearUser, setLoading]
  );

  // ── register ──────────────────────────────────────────────────────────────

  /**
   * Creates a new Firebase account with email+password, then creates the
   * Supabase user record and sets a session cookie.
   *
   * @param data - Registration form data
   * @throws Error with a human-readable message on failure
   */
  const register = useCallback(
    async (data: RegisterData): Promise<void> => {
      setLoading(true);
      try {
        const credential = await createUserWithEmailAndPassword(
          auth,
          data.email,
          data.password
        );
        const idToken = await credential.user.getIdToken();

        const res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            firebase_token: idToken,
            full_name: data.full_name.trim(),
            email: data.email.trim(),
            phone: '+91' + data.phone.replace(/\D/g, ''),
            ...(data.company_name?.trim() ? { company_name: data.company_name.trim() } : {}),
            newsletter_opt_in: data.newsletter_opt_in,
            terms_accepted: data.terms_accepted,
          }),
        });

        const json = (await res.json()) as { user?: UserProfile; error?: string };

        if (!res.ok || !json.user) {
          // Clean up the Firebase account we just created to avoid orphans
          try { await credential.user.delete(); } catch { /* ignore */ }
          throw new Error(json.error ?? 'Registration failed. Please try again.');
        }

        setUser(json.user);
        toast.success('Welcome to PrimeServe!');
        router.push('/buyer/marketplace');
      } catch (err) {
        clearUser();
        const msg = err instanceof Error ? err.message : '';
        if (msg.includes('email-already-in-use')) {
          throw new Error('This email is already registered. Please login instead.');
        }
        if (msg.includes('weak-password')) {
          throw new Error('Password must be at least 6 characters.');
        }
        if (msg.includes('invalid-email')) {
          throw new Error('Please enter a valid email address.');
        }
        throw err instanceof Error ? err : new Error('Registration failed. Please try again.');
      } finally {
        setLoading(false);
      }
    },
    [setUser, clearUser, setLoading, router]
  );

  // ── logout ────────────────────────────────────────────────────────────────

  /**
   * Signs out of Firebase, destroys the session cookie, and redirects to /login.
   */
  const logout = useCallback(async () => {
    try {
      await signOut(auth);
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
