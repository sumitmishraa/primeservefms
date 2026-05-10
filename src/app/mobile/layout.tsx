import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'PrimeServe',
  description: 'Housekeeping Supplies & Services',
};

export default function MobileRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-[#F8FAFC]">{children}</div>;
}
