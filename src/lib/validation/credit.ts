/**
 * Validation schemas and helpers for the credit application wizard.
 *
 * Identity-number regexes mirror the ones used by the buyer Company tab so the
 * wizard and My Account stay consistent. CIN vs LLPIN is chosen by entity type.
 */
import { z } from 'zod';

// ── Identity-number regexes ─────────────────────────────────────────────────

/** 15-character GSTIN */
export const GST_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
/** 10-character PAN */
export const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
/** 21-character Corporate Identification Number (companies) */
export const CIN_REGEX = /^[LU][0-9]{5}[A-Z]{2}[0-9]{4}[A-Z]{3}[0-9]{6}$/;
/** LLPIN — modern "AAA-1234" or legacy 7-digit forms (lenient) */
export const LLPIN_REGEX = /^([A-Z]{3}-?[0-9]{4}|[0-9]{7})$/;

export type EntityType = 'company' | 'llp';

/** Normalise then validate a CIN/LLPIN according to entity type. */
export function isValidRegistrationNumber(value: string, entityType: EntityType): boolean {
  const v = value.trim().toUpperCase();
  return entityType === 'llp' ? LLPIN_REGEX.test(v) : CIN_REGEX.test(v);
}

// ── Per-step zod schemas (used by client + API) ─────────────────────────────

export const companyStepSchema = z.object({
  entity_type: z.enum(['company', 'llp']),
  legal_company_name: z.string().trim().min(2, 'Enter your legal company name'),
  full_name: z.string().trim().min(2, 'Enter your full name'),
  designation: z.string().trim().min(2, 'Enter your designation'),
  contact_email: z.string().trim().email('Enter a valid email'),
  contact_phone: z.string().trim().regex(/^[6-9]\d{9}$/, 'Enter a valid 10-digit mobile number'),
});

export const gstStepSchema = z.object({
  gst_number: z.string().trim().toUpperCase().regex(GST_REGEX, 'Enter a valid 15-character GSTIN'),
});

export const panStepSchema = z.object({
  pan_number: z.string().trim().toUpperCase().regex(PAN_REGEX, 'Enter a valid 10-character PAN'),
});

export const cinStepSchema = z
  .object({
    entity_type: z.enum(['company', 'llp']),
    cin_number: z.string().trim().min(7, 'Enter your registration number'),
  })
  .refine((d) => isValidRegistrationNumber(d.cin_number, d.entity_type), {
    message: 'Enter a valid CIN (company) or LLPIN (LLP)',
    path: ['cin_number'],
  });

export type CompanyStep = z.infer<typeof companyStepSchema>;
export type GstStep = z.infer<typeof gstStepSchema>;
export type PanStep = z.infer<typeof panStepSchema>;
