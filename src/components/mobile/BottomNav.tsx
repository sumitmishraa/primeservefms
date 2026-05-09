'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

const CART_KEY = 'ps_mobile_cart';

const TABS = [
  { href: '/mobile/home', emoji: '🏠', label: 'Home' },
  { href: '/mobile/products', emoji: '🛍️', label: 'Shop' },
  { href: '/mobile/cart', emoji: '🛒', label: 'Cart', isCart: true },
  { href: '/mobile/orders', emoji: '📦', label: 'Orders' },
  { href: '/mobile/account', emoji: '👤', label: 'Account' },
];

export default function BottomNav() {
  const pathname = usePathname();
  const [cartCount, setCartCount] = useState(0);

  useEffect(() => {
    const read = () => {
      try {
        const raw = localStorage.getItem(CART_KEY);
        const items: { quantity: number }[] = raw ? JSON.parse(raw) : [];
        setCartCount(items.reduce((s, i) => s + i.quantity, 0));
      } catch {
        setCartCount(0);
      }
    };
    read();
    window.addEventListener('cart-updated', read);
    return () => window.removeEventListener('cart-updated', read);
  }, []);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t border-slate-200 h-16 flex items-stretch shadow-lg">
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`flex-1 flex flex-col items-center justify-center gap-0.5 relative transition-colors ${
              active ? 'text-teal-600' : 'text-slate-400'
            }`}
          >
            {active && (
              <span className="absolute top-0 left-3 right-3 h-[3px] bg-teal-600 rounded-b-full" />
            )}
            <span className="text-[22px] leading-none relative">
              {tab.emoji}
              {tab.isCart && cartCount > 0 && (
                <span className="absolute -top-1.5 -right-3 bg-rose-500 text-white rounded-full text-[9px] font-bold min-w-[16px] h-4 flex items-center justify-center px-1 leading-none">
                  {cartCount > 9 ? '9+' : cartCount}
                </span>
              )}
            </span>
            <span className={`text-[10px] font-semibold leading-none ${active ? 'text-teal-600' : 'text-slate-400'}`}>
              {tab.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
