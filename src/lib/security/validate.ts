/**
 * Lightweight input-validation helpers for API route handlers.
 * All functions are pure and synchronous — no external dependencies.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Returns true if `value` is a valid RFC 4122 UUID.
 * Rejects empty strings, null, and non-UUID junk that could cause DB errors.
 */
export function isValidUUID(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * Clamps an integer page number to a safe positive range.
 */
export function sanitisePage(raw: string | null, defaultPage = 1): number {
  const n = parseInt(raw ?? String(defaultPage), 10);
  return isNaN(n) || n < 1 ? defaultPage : n;
}

/**
 * Clamps a per_page value to [1, max].
 */
export function sanitisePerPage(raw: string | null, max = 100, defaultVal = 25): number {
  const n = parseInt(raw ?? String(defaultVal), 10);
  return isNaN(n) ? defaultVal : Math.min(Math.max(1, n), max);
}

/**
 * Validates that `value` is one of the allowed enum members.
 * Returns the value narrowed to `T`, or null if invalid.
 */
export function validateEnum<T extends string>(
  value: unknown,
  allowed: readonly T[]
): T | null {
  if (typeof value === 'string' && (allowed as readonly string[]).includes(value)) {
    return value as T;
  }
  return null;
}
