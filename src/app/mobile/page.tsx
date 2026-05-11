'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { StatusSpacer } from '@/components/mobile/PrimeserveMobile';
import { PrimeServeLogo } from '@/components/brand';

export default function MobileIndex() {
  const router = useRouter();

  useEffect(() => {
    const timer = window.setTimeout(() => router.replace('/mobile/home'), 2000);
    return () => window.clearTimeout(timer);
  }, [router]);

  return (
    <main className="ps-screen min-h-dvh overflow-hidden bg-[radial-gradient(90%_70%_at_85%_0%,rgba(20,184,166,0.24)_0%,rgba(11,18,32,0)_58%),linear-gradient(180deg,#0B1220_0%,#0F1A2E_54%,#0B1220_100%)] px-7 text-white">
      <StatusSpacer />
      <div className="flex min-h-[calc(100dvh-32px)] flex-col items-center justify-center text-center">
        <div className="ps-slide-up relative">
          <div className="absolute -inset-8 rounded-full bg-[#14B8A6]/20 blur-3xl" />
          <div className="relative">
            <PrimeServeLogo variant="mark" size="xl" priority />
          </div>
        </div>
        <div className="ps-fade mt-7">
          <PrimeServeLogo size="lg" className="mx-auto" priority />
          <p className="mt-3 max-w-xs text-sm font-medium leading-6 text-slate-300">
            B2B facility supplies, housekeeping essentials, and 45-day credit terms.
          </p>
        </div>
        <div className="mt-10 flex items-center gap-2 rounded-full border border-[rgba(45,212,191,0.28)] bg-white/10 px-4 py-2 text-xs font-extrabold uppercase tracking-[0.18em] text-[#5EEAD4]">
          <span className="h-2 w-2 rounded-full bg-[#2DD4BF] ps-pulse-dot" />
          Opening home
        </div>
      </div>
    </main>
  );
}
