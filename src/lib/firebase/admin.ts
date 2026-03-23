import { initializeApp, getApps, cert } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import type { App } from "firebase-admin/app";
import type { Auth } from "firebase-admin/auth";

/**
 * Firebase Admin SDK — SERVER-SIDE ONLY.
 *
 * Lazy-initialized on first request. Never runs at module import time,
 * so Vercel builds succeed even when env vars are not available during
 * static analysis.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let adminApp: any = null;

/**
 * Returns the Firebase Admin App, initializing it on first call.
 * Returns null if credentials are missing (e.g. during build).
 */
export function getFirebaseAdmin(): App | null {
  if (adminApp) return adminApp;

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  if (!projectId) {
    console.warn("[FIREBASE_ADMIN] Missing credentials — skipping initialization");
    return null;
  }

  if (getApps().length > 0) {
    adminApp = getApps()[0];
    return adminApp;
  }

  adminApp = initializeApp({
    credential: cert({
      projectId,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });

  return adminApp;
}

/**
 * Returns the Firebase Admin Auth instance.
 * Returns null if credentials are missing.
 * Always call inside a request handler, never at module top-level.
 *
 * Example:
 *   const auth = getFirebaseAuth();
 *   if (!auth) return NextResponse.json({ error: 'Server config error' }, { status: 500 });
 *   const decoded = await auth.verifyIdToken(idToken);
 */
export function getFirebaseAuth(): Auth | null {
  const app = getFirebaseAdmin();
  if (!app) return null;
  return getAuth(app);
}
