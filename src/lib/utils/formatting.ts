import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";

const IST_TIMEZONE = "Asia/Kolkata";

/**
 * Formats a number as Indian Rupee currency with 2 decimal places.
 * Uses the Indian numbering system (lakhs and crores).
 *
 * @example
 *   formatINR(123456)    // "₹1,23,456.00"
 *   formatINR(1000000)   // "₹10,00,000.00"
 *   formatINR(99)        // "₹99.00"
 */
export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount);
}

/**
 * Formats a date or ISO string to a human-readable IST datetime string.
 * Always displays in Indian Standard Time regardless of the server's timezone.
 *
 * @example
 *   formatDate("2026-03-21T09:00:00Z")  // "21 Mar 2026, 2:30 PM"
 *   formatDate(new Date())               // "22 Mar 2026, 10:15 AM"
 */
export function formatDate(date: string | Date): string {
  const zonedDate = toZonedTime(new Date(date), IST_TIMEZONE);
  return format(zonedDate, "dd MMM yyyy, h:mm aa");
}

/**
 * Generates a unique Primeserve order number.
 * Format: PS-ORD-XXXXXXX where X is an uppercase alphanumeric character.
 *
 * @example
 *   formatOrderNumber()  // "PS-ORD-A3F9K2M"
 */
export function formatOrderNumber(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  const random = Array.from({ length: 7 }, () =>
    chars.charAt(Math.floor(Math.random() * chars.length))
  ).join("");
  return `PS-ORD-${random}`;
}

/**
 * Truncates a string to a maximum length and appends an ellipsis if truncated.
 * Breaks at word boundaries when possible.
 *
 * @example
 *   truncateText("Hello world", 8)   // "Hello..."
 *   truncateText("Hi", 10)            // "Hi"
 */
export function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  const truncated = text.slice(0, maxLength).trimEnd();
  const lastSpace = truncated.lastIndexOf(" ");
  const breakPoint = lastSpace > maxLength * 0.6 ? lastSpace : maxLength;
  return text.slice(0, breakPoint).trimEnd() + "…";
}
