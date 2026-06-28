'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { StatusSpacer } from '@/components/mobile/PrimeserveMobile';
import { PrimeServeLogo } from '@/components/brand';

export default function MobileIndex() {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(() => router.replace('/mobile/home'), 2600);
    return () => window.clearTimeout(timer);
  }, [router]);

  return (
    <main className="ps-screen min-h-dvh overflow-hidden bg-[radial-gradient(90%_70%_at_85%_0%,rgba(20,184,166,0.28)_0%,rgba(11,18,32,0)_58%),linear-gradient(180deg,#0B1220_0%,#0F1A2E_54%,#0B1220_100%)] text-white">
      <StatusSpacer />
      <div className="flex min-h-[calc(100dvh-32px)] flex-col items-center justify-center">
        {/* Logo icon — animates in first */}
        <div className="ps-splash-icon relative flex items-center justify-center">
          {/* Pulsing ambient glow behind the mark */}
          <div className="ps-splash-glow absolute h-48 w-48 rounded-full bg-[#14B8A6]/20 blur-3xl" />
          {/* Expanding ring burst on arrival */}
          <div className="ps-splash-ring absolute h-36 w-36 rounded-full border-2 border-[#2DD4BF]/40" />
          <div className="relative z-10">
            <PrimeServeLogo variant="mark" size="xl" tone="light" priority />
          </div>
        </div>

        {/* Wordmark — slides up after icon settles */}
        <div className="ps-splash-name mt-6">
          <PrimeServeLogo size="lg" tone="light" className="mx-auto" priority />
        </div>
      </div>
    </main>
  );
}
