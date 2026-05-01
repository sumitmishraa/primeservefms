export const POLICY_LINKS = [
  {
    slug: 'terms-and-conditions',
    href: '/legal/terms-and-conditions',
    label: 'Terms and Conditions',
    summary: 'Business buyer terms for using PrimeServe and placing orders.',
  },
  {
    slug: 'privacy-policy',
    href: '/legal/privacy-policy',
    label: 'Privacy Policy',
    summary: 'How PrimeServe collects, uses, stores, and protects personal data.',
  },
  {
    slug: 'credit-policy',
    href: '/legal/credit-policy',
    label: 'Credit Policy',
    summary: 'Eligibility, limits, payment timelines, and overdue credit rules.',
  },
  {
    slug: 'shipping-and-delivery-policy',
    href: '/legal/shipping-and-delivery-policy',
    label: 'Shipping & Delivery Policy',
    summary: 'Delivery coverage, timelines, proof of delivery, and discrepancy reporting.',
  },
  {
    slug: 'refund-policy',
    href: '/legal/refund-policy',
    label: 'Refund Policy',
    summary: 'Refund, return, replacement, cancellation, and credit note process.',
  },
] as const;

export type PolicySlug = (typeof POLICY_LINKS)[number]['slug'];
