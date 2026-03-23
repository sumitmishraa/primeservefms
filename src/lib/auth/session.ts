/**
 * Session management utilities — SERVER-SIDE ONLY.
 *
 * Handles creating, reading, and destroying the signed httpOnly session cookie
 * named 'ps-session'. Uses HMAC-SHA256 (Node.js crypto) with SESSION_SECRET.
 *
 * Token format: base64url(JSON payload) + "." + HMAC-SHA256 signature
 *
 * Functions:
 *   createSession   — signs a token, sets it as the httpOnly 'ps-session' cookie
 *   getSession      — reads the cookie and verifies the HMAC signature
 *   destroySession  — returns a response that clears the cookie
 */

import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import type { SessionPayload, UserRole } from "@/types/index";

// ─── Constants ────────────────────────────────────────────────────────────────

/** The name of the httpOnly cookie used to store the session token. */
export const SESSION_COOKIE = "ps-session";

/** Session lifetime in seconds: 7 days. */
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60;

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Returns SESSION_SECRET env var. Throws at startup if missing so the
 * server refuses to run rather than silently signing with an empty key.
 */
function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error(
      "SESSION_SECRET environment variable is not set. " +
        "Add it to .env.local before starting the server."
    );
  }
  return secret;
}

/**
 * Signs and serialises a session payload into a compact token string.
 *
 * @param payload - Object containing userId, role, and expiry timestamp
 * @returns `<base64url-payload>.<base64url-hmac-signature>`
 */
function signToken(payload: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const signature = crypto
    .createHmac("sha256", getSecret())
    .update(data)
    .digest("base64url");
  return `${data}.${signature}`;
}

/**
 * Verifies a token's HMAC signature and expiry.
 * Uses a constant-time comparison to prevent timing-based attacks.
 *
 * @param token - Raw cookie value from the `ps-session` cookie
 * @returns The decoded `SessionPayload` if valid, or `null` if invalid/expired
 */
function verifyToken(token: string): SessionPayload | null {
  const dot = token.lastIndexOf(".");
  if (dot === -1) return null;

  const encodedPayload = token.slice(0, dot);
  const providedSig = token.slice(dot + 1);
  if (!encodedPayload || !providedSig) return null;

  // Recompute expected signature
  const expectedSig = crypto
    .createHmac("sha256", getSecret())
    .update(encodedPayload)
    .digest("base64url");

  // Constant-time comparison
  const providedBuf = Buffer.from(providedSig);
  const expectedBuf = Buffer.from(expectedSig);
  if (providedBuf.length !== expectedBuf.length) return null;
  if (!crypto.timingSafeEqual(providedBuf, expectedBuf)) return null;

  // Decode payload
  let payload: SessionPayload;
  try {
    payload = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf8")
    ) as SessionPayload;
  } catch {
    return null;
  }

  if (!payload.userId || !payload.role || !payload.exp) return null;
  // exp is stored as Unix seconds
  if (payload.exp < Math.floor(Date.now() / 1000)) return null;

  return payload;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Creates a signed session token and sets it as the 'ps-session' httpOnly
 * cookie on the provided `NextResponse`.
 *
 * Call this at the end of your login/register route handler:
 * ```ts
 * const response = NextResponse.json({ user, message: "..." });
 * createSession(response, user.id, user.role);
 * return response;
 * ```
 *
 * @param response - The NextResponse to attach the cookie to (mutated in place)
 * @param userId   - Supabase `users.id` (UUID)
 * @param role     - The user's platform role
 * @returns The same `response` with the session cookie set
 */
export function createSession(
  response: NextResponse,
  userId: string,
  role: UserRole
): NextResponse {
  const payload: SessionPayload = {
    userId,
    role,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  };
  const token = signToken(payload);

  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });

  return response;
}

/**
 * Reads the 'ps-session' cookie from the incoming request, verifies the HMAC
 * signature and expiry, and returns the decoded payload.
 *
 * Returns `null` if the cookie is absent, tampered with, or expired.
 * No database round-trip — use this in the proxy for fast access checks.
 *
 * @param request - Incoming `NextRequest` from an API route or proxy
 * @returns `SessionPayload` with `userId` and `role`, or `null`
 */
export function getSession(request: NextRequest): SessionPayload | null {
  const token = request.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifyToken(token);
}

/**
 * Returns a `NextResponse` that clears the 'ps-session' cookie, effectively
 * ending the user's session.
 *
 * Used directly as the return value of the logout route:
 * ```ts
 * export async function POST() {
 *   return destroySession();
 * }
 * ```
 *
 * @returns NextResponse with `{ success: true }` body and a cleared cookie
 */
export function destroySession(): NextResponse {
  const response = NextResponse.json(
    { success: true, message: "Logged out successfully" },
    { status: 200 }
  );
  response.cookies.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  return response;
}
