/**
 * Zustand auth store — single source of truth for client-side auth state.
 *
 * Mirrors the server-authoritative session (httpOnly ps-session cookie).
 * On page load the useAuth hook calls GET /api/auth/me and calls setUser
 * or clearUser. Until that check resolves, isLoading stays true so the
 * UI never flickers between "logged in" and "logged out".
 */

'use client';

import { create } from 'zustand';
import type { UserProfile } from '@/types';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface AuthState {
  /** Full Supabase user profile (all columns except firebase_uid). */
  user: UserProfile | null;

  /**
   * True while the initial /api/auth/me check is in flight.
   * Starts true so pages never flash unauthenticated content on first render.
   */
  isLoading: boolean;

  /**
   * Derived: true when user is non-null.
   * Stored explicitly to avoid repeated null checks at call sites.
   */
  isAuthenticated: boolean;

  // ── Actions ──────────────────────────────────────────────────────────────

  /**
   * Call after a successful login, register, or session restore.
   * Sets user, flags as authenticated, clears loading.
   *
   * @param user - Full profile returned from /api/auth/me or /api/auth/login
   */
  setUser: (user: UserProfile) => void;

  /**
   * Call after logout or when /api/auth/me returns 401.
   * Clears user, flags as unauthenticated, clears loading.
   */
  clearUser: () => void;

  /**
   * Manually toggle the loading flag.
   *
   * @param val - true while an async auth operation is in progress
   */
  setLoading: (val: boolean) => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  setUser: (user) =>
    set({ user, isAuthenticated: true, isLoading: false }),

  clearUser: () =>
    set({ user: null, isAuthenticated: false, isLoading: false }),

  setLoading: (val) => set({ isLoading: val }),
}));
