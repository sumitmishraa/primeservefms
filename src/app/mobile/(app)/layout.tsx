import BottomNav from '@/components/mobile/BottomNav';

export default function MobileAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh bg-[#F8FAFC]">
      <main>{children}</main>
      <BottomNav />
    </div>
  );
}
