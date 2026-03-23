import { z } from "zod";

/**
 * Validates an Indian mobile number (10 digits, starts with 6-9).
 */
export const phoneSchema = z
  .string()
  .regex(/^[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number");

/**
 * Validates an email address.
 */
export const emailSchema = z.string().email("Enter a valid email address");

/**
 * Common OTP validation — 6 digits.
 */
export const otpSchema = z
  .string()
  .length(6, "OTP must be 6 digits")
  .regex(/^\d+$/, "OTP must contain only numbers");
