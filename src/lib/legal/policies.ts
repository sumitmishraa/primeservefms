import generatedPolicies from './policies.generated.json';
import { POLICY_LINKS, type PolicySlug } from './policy-links';

export type LegalPolicyBlock = {
  type: 'heading' | 'paragraph' | 'listItem';
  text: string;
};

type GeneratedLegalPolicy = {
  slug: PolicySlug;
  title: string;
  lastUpdated: string;
  effectiveDate: string;
  blocks: LegalPolicyBlock[];
};

export type LegalPolicy = GeneratedLegalPolicy & {
  href: string;
  label: string;
  summary: string;
};

const generated = generatedPolicies as GeneratedLegalPolicy[];

export const LEGAL_POLICIES: LegalPolicy[] = POLICY_LINKS.map((link) => {
  const policy = generated.find((item) => item.slug === link.slug);

  if (!policy) {
    throw new Error(`Missing generated legal policy for ${link.slug}`);
  }

  return {
    ...policy,
    href: link.href,
    label: link.label,
    summary: link.summary,
  };
});

export function getLegalPolicy(slug: string) {
  return LEGAL_POLICIES.find((policy) => policy.slug === slug);
}
