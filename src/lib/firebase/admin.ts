import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";

/**
 * Firebase Admin SDK — SERVER-SIDE ONLY.
 *
 * Primary use: verifying Firebase ID tokens sent from the browser after
 * a user signs in via Phone OTP or Email OTP.
 *
 * After verifying the token, store/read all user data from Supabase —
 * do NOT use getFirestore() or getDatabase() from firebase-admin here.
 *
 * The singleton pattern (checking getApps().length) prevents re-initialisation
 * on every hot reload in Next.js development mode.
 */

let adminApp: App;

if (!getApps().length) {
  adminApp = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      // Private key stored in .env.local with literal \n — replace with real newlines
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
} else {
  adminApp = getApps()[0]!;
}

/**
 * Firebase Admin Auth — use this to verify ID tokens in API routes.
 *
 * Example:
 *   const decoded = await adminAuth.verifyIdToken(idToken);
 *   const uid = decoded.uid;
 */
export const adminAuth: Auth = getAuth(adminApp);

export default adminApp;
