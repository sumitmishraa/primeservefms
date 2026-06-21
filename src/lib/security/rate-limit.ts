/**
 * In-process sliding-window rate limiter for Next.js API routes.
 *
 * Designed for Vercel serverless: one Map per Lambda instance.
 * Limits are per IP and per window, best-effort (not distributed).
 *
 * Usage:
 *   const result = rateLimit(request, { limit: 5, windowMs: 60_000 });
 *   if (!result.ok) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
 */

interface RateLimitOptions {
  /** Max requests allowed in the window */
  limit: number;
  /** Window size in milliseconds */
  windowMs: number;
  /** Optional key prefix to separate different limiters */
  keyPrefix?: string;
}

interface RateLimitResult {
  ok: boolean;
  remaining: number;
  resetAt: number;
}

interface RequestRecord {
  count: number;
  resetAt: number;
}

const store = new Map<string, RequestRecord>();

/** Evict expired entries to prevent memory growth between invocations. */
function evictExpired(): void {
  const now = Date.now();
  for (const [key, record] of store.entries()) {
    if (record.resetAt < now) store.delete(key);
  }
}

/**
 * Extracts the real client IP from common proxy headers (Vercel / Cloudflare).
 * Falls back to x-forwarded-for, then 'unknown'.
 */
function getClientIp(request: Request): string {
  const cfIp = (request.headers as Headers).get('cf-connecting-ip');
  if (cfIp) return cfIp;
  const xfwd = (request.headers as Headers).get('x-forwarded-for');
  if (xfwd) return xfwd.split(',')[0].trim();
  return 'unknown';
}

/**
 * Checks and increments the rate limit counter for the request's IP.
 *
 * @param request  - Incoming NextRequest
 * @param options  - Limit configuration
 * @returns RateLimitResult — check `ok` before proceeding
 */
export function rateLimit(
  request: Request,
  options: RateLimitOptions
): RateLimitResult {
  evictExpired();

  const ip = getClientIp(request);
  const prefix = options.keyPrefix ?? 'rl';
  const key = `${prefix}:${ip}`;
  const now = Date.now();

  let record = store.get(key);

  if (!record || record.resetAt < now) {
    record = { count: 1, resetAt: now + options.windowMs };
    store.set(key, record);
    return { ok: true, remaining: options.limit - 1, resetAt: record.resetAt };
  }

  record.count += 1;

  if (record.count > options.limit) {
    return { ok: false, remaining: 0, resetAt: record.resetAt };
  }

  return {
    ok: true,
    remaining: options.limit - record.count,
    resetAt: record.resetAt,
  };
}
