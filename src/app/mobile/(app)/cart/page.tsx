'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import {
  ButtonLink,
  Card,
  EmptyState,
  LoadingScreen,
  MobilePage,
  ProductThumb,
  ScreenHeader,
  mobileIcons,
  protectedHref,
} from '@/components/mobile/PrimeserveMobile';
import { formatINR } from '@/lib/utils/formatting';
import { useMobileCart } from '@/hooks/useMobileCart';

interface AuthResponse {
  user?: {
    full_name: string;
    email: string | null;
    phone: string | null;
  } | null;
}

export default function MobileCartPage() {
  const router = useRouter();
  const { items, ready, updateQty, clearCart, totalAmount } = useMobileCart();
  const [placing, setPlacing] = useState(false);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');

  async function handleOrder() {
    if (items.length === 0 || placing) return;
    setError('');
    setPlacing(true);
    try {
      const auth = (await fetch('/api/auth/me').then((r) => r.json())) as AuthResponse;
      if (!auth.user) {
        router.push(protectedHref('/mobile/cart'));
        return;
      }

      const profile = await fetch('/api/buyer/profile')
        .then((r) => r.json())
        .catch(() => null);
      const addressText = profile?.data?.billing_address || 'Registered branch address';
      const phone = auth.user.phone || '+910000000000';

      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((item) => ({
            product_id: item.product_id,
            product_name: item.name,
            quantity: item.quantity,
          })),
          shipping_address: {
            name: auth.user.full_name,
            line1: addressText,
            city: 'Mumbai',
            state: 'Maharashtra',
            pincode: '400000',
            phone,
          },
          billing_address: {
            name: auth.user.full_name,
            line1: addressText,
            city: 'Mumbai',
            state: 'Maharashtra',
            pincode: '400000',
            phone,
          },
          payment_method: 'credit_45day',
          notes: note || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? 'Failed to place order. Please try again.');
      } else {
        clearCart();
        router.push('/mobile/orders');
      }
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setPlacing(false);
    }
  }

  if (!ready) return <LoadingScreen label="Loading cart" />;

  if (items.length === 0) {
    return (
      <MobilePage>
        <ScreenHeader title="My Cart" subtitle="Build your PrimeServe order" variant="light" />
        <EmptyState
          icon={mobileIcons.ShoppingCart}
          title="Your cart is empty"
          body="Browse the catalog and add housekeeping, stationery, pantry, or facility products."
          action={<ButtonLink href="/mobile/products">Browse products</ButtonLink>}
        />
      </MobilePage>
    );
  }

  const subtotal = totalAmount;
  const gst = Math.round(subtotal * 0.18 * 100) / 100;
  const grandTotal = Math.round((subtotal + gst) * 100) / 100;

  return (
    <MobilePage className="flex flex-col">
      <ScreenHeader
        title={`My Cart (${items.length})`}
        subtitle="Review quantities before checkout"
        variant="light"
        action={
          <button type="button" onClick={clearCart} className="text-sm font-extrabold text-[#F43F5E]">
            Clear
          </button>
        }
      />

      <div className="flex-1 space-y-3 px-5 py-4">
        {items.map((item) => (
          <Card key={item.product_id} className="flex gap-3 p-3">
            <ProductThumb src={item.thumbnail_url} alt={item.name} className="h-20 w-20 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-sm font-extrabold leading-5 text-slate-900">{item.name}</p>
              <p className="mt-1 font-heading text-sm font-extrabold text-[#0D9488]">{formatINR(item.price)} / {item.unit}</p>
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => updateQty(item.product_id, item.quantity - 1)}
                  className="ps-press flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-lg font-extrabold text-slate-600"
                >
                  -
                </button>
                <span className="w-9 text-center font-heading text-sm font-extrabold text-slate-900">{item.quantity}</span>
                <button
                  type="button"
                  onClick={() => updateQty(item.product_id, item.quantity + 1)}
                  className="ps-press flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 text-lg font-extrabold text-[#0D9488]"
                >
                  +
                </button>
                <span className="ml-auto font-heading text-sm font-extrabold text-slate-900">{formatINR(item.price * item.quantity)}</span>
              </div>
            </div>
            <button type="button" onClick={() => updateQty(item.product_id, 0)} className="self-start text-xl font-light text-slate-300">
              x
            </button>
          </Card>
        ))}

        <Card className="p-4">
          <label className="text-sm font-extrabold text-slate-800" htmlFor="mobile-cart-note">Add a note</label>
          <textarea
            id="mobile-cart-note"
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="e.g. Deliver to reception, 2nd floor"
            rows={3}
            className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-800 outline-none focus:border-[#14B8A6]"
          />
        </Card>

        <Card className="p-4">
          <h2 className="font-heading text-xl font-extrabold text-slate-900">Price Summary</h2>
          <div className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="font-semibold text-slate-500">Subtotal</span>
              <span className="font-heading font-extrabold text-slate-900">{formatINR(subtotal)}</span>
            </div>
            <div className="flex justify-between">
              <span className="font-semibold text-slate-500">GST estimate</span>
              <span className="font-heading font-extrabold text-slate-900">{formatINR(gst)}</span>
            </div>
            <div className="flex justify-between border-t border-slate-100 pt-3">
              <span className="font-heading font-extrabold text-slate-900">Total</span>
              <span className="font-heading text-lg font-extrabold text-[#0D9488]">{formatINR(grandTotal)}</span>
            </div>
          </div>
        </Card>

        {error && (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
            {error}
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-[76px] z-40 border-t border-slate-200 bg-white px-5 py-3 shadow-[0_-14px_28px_-28px_rgba(15,23,42,0.35)]">
        <div className="flex items-center gap-4">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-400">{items.length} items</p>
            <p className="font-heading text-xl font-extrabold text-slate-900">{formatINR(grandTotal)}</p>
          </div>
          <button
            type="button"
            disabled={placing}
            onClick={handleOrder}
            className="ps-press flex h-14 min-w-40 items-center justify-center gap-2 rounded-2xl bg-[#14B8A6] px-6 font-heading text-base font-extrabold text-white disabled:opacity-60"
          >
            {placing ? 'Placing...' : 'Checkout'}
            <mobileIcons.ArrowRight className="h-5 w-5" />
          </button>
        </div>
      </div>
    </MobilePage>
  );
}
