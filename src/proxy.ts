/**
 * src/proxy.ts — Next.js 16 route protection (replaces middleware.ts)
 *
 * Runs before every non-static request. Reads the 'ps-session' cookie and
 * verifies it with HMAC-SHA256 — no database round-trip needed.
 *
 * Public routes (no session required):
 *   /              Landing page
 *   /login         Auth pages
 *   /register
 *   /marketplace   Public product catalogue (all sub-paths)
 *   /pro           Pro Plan pricing page
 *   /about         About Us page
 *   /contact       Contact page
 *   /categories    Category overview page
 *   /api/auth/*    Auth endpoints (login, register, logout, me)
 *   /api/products  Public product API (read-only catalogue)
 *   /_next/*       Next.js static assets
 *   /favicon.ico
 *
 * Protected routes and required roles:
 *   /admin/*       role === 'admin'
 *   /vendor/*      role === 'vendor'
 *   /buyer/*       role === 'buyer'
 *
 * Behaviour:
 *   No session + protected route      → redirect to /login?redirect={path}
 *   Session + wrong role              → redirect to the user's own dashboard
 *   Session + /login or /register     → redirect to their dashboard (already logged in)
 *   Session + correct route           → allow, set x-user-id / x-user-role headers
 */

import crypto from "crypto";
import { type NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@/types/index";

// ─── Constants ────────────────────────────────────────────────────────────────

/** Must match SESSION_COOKIE in src/lib/auth/session.ts */
const SESSION_COOKIE = "ps-session";

// ─── Token verification (sync, no DB) ────────────────────────────────────────

interface SessionData {
  userId: string;
  role: UserRole;
  exp: number;
}

/**
 * Verifies the signed session token from the 'ps-session' cookie.
 * Uses the same HMAC-SHA256 algorithm as session.ts.
 * Kept inline so the proxy has zero async / DB dependencies.
 *
 * @param token  - Cookie value from 'ps-session'
 * @param secret - SESSION_SECRET environment variable
 * @returns Decoded session data, or null if invalid/expired/tampered
 */
function verifyToken(token: string, secret: string): SessionData | null {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;

  const encodedPayload = token.slice(0, dot);
  const providedSig = token.slice(dot + 1);
  if (!encodedPayload || !providedSig) return null;

  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(encodedPayload)
    .digest("base64url");

  // Constant-time comparison
  const providedBuf = Buffer.from(providedSig);
  const expectedBuf = Buffer.from(expectedSig);
  if (providedBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) return null;

  let payload: SessionData;
  try {
    payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as SessionData;
  } catch {
    return null;
  }

  if (!payload.userId || !payload.role || !payload.exp) return null;
  // exp is stored as Unix seconds
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;

  return payload;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Returns the home dashboard path for a given role.
 *
 * @param role - The authenticated user's role
 */
function dashboardFor(role: UserRole): string {
  switch (role) {
    case "admin":
      return "/admin";
    case "vendor":
      return "/vendor";
    case "buyer":
      return "/buyer/marketplace";
  }
}

/**
 * Returns true if the path is publicly accessible without a session.
 *
 * @param pathname - URL pathname from the request
 */
function isPublicPath(pathname: string): boolean {
  // Static assets and Next.js internals
  if (pathname.startsWith("/_next/") || pathname === "/favicon.ico") {
    return true;
  }
  // Public API routes (auth endpoints + read-only product catalogue
  // + public landing-page form submissions)
  if (pathname.startsWith("/api/auth/")) return true;
  if (pathname.startsWith("/api/products")) return true;
  if (pathname === "/api/contact") return true;
  if (pathname === "/api/newsletter") return true;
  // Public pages and all their sub-paths
  const publicPrefixes = [
    "/",
    "/login",
    "/register",
    "/marketplace",
    "/pro",
    "/about",
    "/contact",
    "/categories",
  ];
  for (const prefix of publicPrefixes) {
    if (prefix === "/") {
      if (pathname === "/") return true;
    } else {
      if (pathname === prefix || pathname.startsWith(prefix + "/")) return true;
    }
  }
  return false;
}

/**
 * Returns true if this path should redirect already-logged-in users away.
 * (e.g. no point being on /login if you already have a valid session)
 *
 * @param pathname - URL pathname from the request
 */
function isAuthPage(pathname: string): boolean {
  return pathname === "/login" || pathname === "/register";
}

// ─── Proxy function ───────────────────────────────────────────────────────────

/**
 * Main proxy function — enforces authentication and role-based access control.
 * Next.js 16: the exported function must be named `proxy` (not `middleware`).
 */
export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl;
  const secret = process.env.SESSION_SECRET;
  const token = request.cookies.get(SESSION_COOKIE)?.value;

  // Decode session (no DB hit — purely crypto)
  const session = secret && token ? verifyToken(token, secret) : null;

  // ── If user is already logged in, redirect away from auth pages ──────────
  if (session && isAuthPage(pathname)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // ── Allow public routes through ──────────────────────────────────────────
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // ── Require session for all other routes ─────────────────────────────────
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const { userId, role } = session;

  // ── Enforce role-based access ─────────────────────────────────────────────
  const requiresAdmin = pathname.startsWith("/admin");
  const requiresVendor = pathname.startsWith("/vendor");
  const requiresBuyer = pathname.startsWith("/buyer");

  // Strict role-based access for every role-prefixed area:
  //   /admin   → admin only
  //   /vendor  → vendor only
  //   /buyer   → buyer only
  // Non-admins hitting /admin are bounced to "/" (the public homepage) so
  // the existence and structure of the admin surface is never hinted at.
  // Wrong-role hits on /vendor or /buyer are bounced to the user's own
  // dashboard, which is informative without leaking anything.
  //
  // NOTE: this intentionally reverses the prior "admins can browse all
  // sections for review" behaviour (commit a8b6758). Per-section access is
  // now strict; admins must use the admin panel, not the buyer/vendor UIs.
  if (requiresAdmin && role !== "admin") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const hasAccess =
    (requiresAdmin && role === "admin") ||
    (requiresVendor && role === "vendor") ||
    (requiresBuyer && role === "buyer") ||
    // Non-role-prefixed protected routes (e.g. future /account/*) — allow any role
    (!requiresAdmin && !requiresVendor && !requiresBuyer);

  if (!hasAccess) {
    // Authenticated but wrong role on /buyer or /vendor — send them to their
    // own dashboard. (/admin was already handled above with a strict bounce.)
    const correctDashboard = new URL(dashboardFor(role), request.url);
    return NextResponse.redirect(correctDashboard);
  }

  // ── Allowed — pass user identity in request headers ───────────────────────
  // Server Components and Route Handlers can read these without a DB call:
  //   request.headers.get('x-user-id')
  //   request.headers.get('x-user-role')
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", userId);
  requestHeaders.set("x-user-role", role);

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

// ─── Matcher ──────────────────────────────────────────────────────────────────

export const config = {
  matcher: [
    /*
     * Run on all paths EXCEPT:
     *   _next/static  — bundled JS/CSS
     *   _next/image   — image optimisation
     *   favicon.ico   — browser default
     *   image files   — public/
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|svg|ico|jpg|jpeg|webp)$).*)",
  ],
};
