import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'PrimeServe',
  description: 'Housekeeping Supplies & Services',
};

export default function MobileRootLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-50">{children}</div>;
}
