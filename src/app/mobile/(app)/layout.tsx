import BottomNav from '@/components/mobile/BottomNav';

export default function MobileAppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-screen bg-slate-50">
      <main className="pb-16">{children}</main>
      <BottomNav />
    </div>
  );
}
