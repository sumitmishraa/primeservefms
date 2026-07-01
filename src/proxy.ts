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
 *   /about         About Us page
 *   /contact       Contact page
 *   /categories    Category overview page
 *   /legal         Legal policy pages
 *   legacy policy URLs (/terms, /privacy, etc.) redirect to /legal/*
 *   /api/auth/*    Auth endpoints (login, register, logout, me)
 *   /api/location/reverse  Browser geolocation pincode lookup
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
  if (pathname === "/api/location/reverse") return true;
  if (pathname.startsWith("/api/products")) return true;
  if (pathname === "/api/contact") return true;
  if (pathname === "/api/newsletter") return true;
  // Public pages and all their sub-paths
  const publicPrefixes = [
    "/",
    "/login",
    "/register",
    "/mobile",
    "/marketplace",
    "/about",
    "/contact",
    "/categories",
    "/legal",
    "/terms",
    "/terms-and-conditions",
    "/privacy",
    "/privacy-policy",
    "/shipping",
    "/shipping-policy",
    "/shipping-and-delivery-policy",
    "/refund-policy",
    "/credit-terms",
    "/credit-policy",
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

// ─── Security headers ─────────────────────────────────────────────────────────

/**
 * Applies OWASP-recommended security response headers to every response.
 * CSP is intentionally kept pragmatic for a Next.js + Firebase + Razorpay app.
 */
function applySecurityHeaders(response: NextResponse): void {
  // Prevent clickjacking
  response.headers.set("X-Frame-Options", "DENY");
  // Prevent MIME-type sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");
  // Enable XSS filter (legacy browsers)
  response.headers.set("X-XSS-Protection", "1; mode=block");
  // Strict referrer policy — no referrer on cross-origin navigation
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Remove server fingerprint
  response.headers.delete("X-Powered-By");
  // Permissions policy — disable features the app doesn't use
  response.headers.set(
    "Permissions-Policy",
    "camera=(), microphone=(), geolocation=(self), payment=(self https://api.razorpay.com https://checkout.razorpay.com)"
  );
  // HSTS — force HTTPS in production (1 year, include subdomains)
  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains; preload"
    );
  }
  // Content Security Policy
  // next/image uses _next/image; Firebase Auth uses apis.google.com and identitytoolkit;
  // Razorpay checkout.js loads from checkout.razorpay.com; the payment modal iframes
  // and API calls come from api.razorpay.com; assets from cdn.razorpay.com;
  // analytics/logging from lumberjack.razorpay.com; Supabase uses supabase.co.
  response.headers.set(
    "Content-Security-Policy",
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.gstatic.com https://www.google.com https://apis.google.com https://checkout.razorpay.com https://api.razorpay.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://*.supabase.co https://firebasestorage.googleapis.com https://lh3.googleusercontent.com https://cdn.razorpay.com https://*.razorpay.com",
      // https://www.google.com is required here (not just frame-src) because the
      // reCAPTCHA widget that Firebase phone-auth relies on makes XHR/fetch calls
      // to google.com directly from the top-level page, not just from its iframe.
      // Without it, reCAPTCHA verification is silently blocked and Firebase phone
      // OTP fails with auth/captcha-check-failed or auth/internal-error.
      "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://identitytoolkit.googleapis.com https://www.googleapis.com https://securetoken.googleapis.com https://www.google.com https://api.razorpay.com wss://api.razorpay.com https://lumberjack.razorpay.com https://firebaseinstallations.googleapis.com",
      "frame-src https://api.razorpay.com https://checkout.razorpay.com https://*.razorpay.com https://www.google.com",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://api.razorpay.com",
      "upgrade-insecure-requests",
    ].join("; ")
  );
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
    const res = NextResponse.redirect(new URL('/', request.url));
    applySecurityHeaders(res);
    return res;
  }

  // ── Allow public routes through ──────────────────────────────────────────
  if (isPublicPath(pathname)) {
    const res = NextResponse.next();
    applySecurityHeaders(res);
    return res;
  }

  // ── Require session for all other routes ─────────────────────────────────
  if (!session) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirect", pathname);
    const res = NextResponse.redirect(loginUrl);
    applySecurityHeaders(res);
    return res;
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
    const res = NextResponse.redirect(new URL("/", request.url));
    applySecurityHeaders(res);
    return res;
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
    const res = NextResponse.redirect(correctDashboard);
    applySecurityHeaders(res);
    return res;
  }

  // ── Allowed — pass user identity in request headers ───────────────────────
  // Server Components and Route Handlers can read these without a DB call:
  //   request.headers.get('x-user-id')
  //   request.headers.get('x-user-role')
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-user-id", userId);
  requestHeaders.set("x-user-role", role);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  applySecurityHeaders(response);
  return response;
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
