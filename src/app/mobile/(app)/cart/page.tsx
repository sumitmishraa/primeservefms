'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { formatINR } from '@/lib/utils/formatting';
import { useMobileCart } from '@/hooks/useMobileCart';

export default function MobileCartPage() {
  const router = useRouter();
  const { items, ready, updateQty, clearCart, totalAmount } = useMobileCart();
  const [authed, setAuthed] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [note, setNote] = useState('');

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((d) => {
        if (!d.user) router.replace('/mobile/login');
        else setAuthed(true);
      })
      .catch(() => router.replace('/mobile/login'));
  }, [router]);

  async function handleOrder() {
    if (items.length === 0 || placing) return;
    setPlacing(true);
    try {
      const res = await fetch('/api/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((i) => ({
            product_id: i.product_id,
            quantity: i.quantity,
            unit_price: i.price,
          })),
          payment_method: 'credit_45day',
          notes: note || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        alert(data.error ?? 'Failed to place order. Please try again.');
      } else {
        clearCart();
        router.push('/mobile/orders');
      }
    } catch {
      alert('Network error. Please try again.');
    } finally {
      setPlacing(false);
    }
  }

  if (!authed || !ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-8 h-8 border-[3px] border-teal-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <div className="bg-white px-4 pt-12 pb-4 border-b border-slate-100">
          <h1 className="font-heading font-bold text-xl text-slate-900">My Cart</h1>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
          <span className="text-6xl">🛒</span>
          <h2 className="font-heading font-bold text-slate-900 text-xl">Your cart is empty</h2>
          <p className="text-slate-500 text-sm text-center">Add products from the marketplace to get started.</p>
          <Link
            href="/mobile/products"
            className="bg-teal-600 text-white font-bold rounded-2xl px-8 py-3 text-base mt-2"
          >
            Browse Products →
          </Link>
        </div>
      </div>
    );
  }

  const subtotal = totalAmount;
  const gst = subtotal * 0.18;
  const grandTotal = subtotal + gst;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <div className="bg-white px-4 pt-12 pb-4 border-b border-slate-100 flex items-center justify-between">
        <h1 className="font-heading font-bold text-xl text-slate-900">My Cart ({items.length})</h1>
        <button
          onClick={() => {
            if (confirm('Clear all items from cart?')) clearCart();
          }}
          className="text-rose-500 text-sm font-semibold"
        >
          Clear All
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {/* Line items */}
        {items.map((item) => (
          <div key={item.product_id} className="bg-white rounded-2xl p-3 shadow-sm border border-slate-100 flex gap-3">
            {/* Thumb */}
            <div className="w-16 h-16 bg-slate-50 rounded-xl flex-shrink-0 relative flex items-center justify-center overflow-hidden">
              {item.thumbnail_url ? (
                <Image src={item.thumbnail_url} alt={item.name} fill className="object-contain p-1" sizes="64px" />
              ) : (
                <span className="text-2xl">📦</span>
              )}
            </div>
            {/* Info */}
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-900 text-sm leading-tight line-clamp-2">{item.name}</p>
              <p className="text-teal-700 font-bold text-sm mt-1">{formatINR(item.price)} / {item.unit}</p>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => updateQty(item.product_id, item.quantity - 1)}
                  className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-base"
                >
                  −
                </button>
                <span className="font-mono font-bold text-slate-900 w-8 text-center text-sm">{item.quantity}</span>
                <button
                  onClick={() => updateQty(item.product_id, item.quantity + 1)}
                  className="w-7 h-7 rounded-lg border border-slate-200 flex items-center justify-center text-slate-700 font-bold text-base"
                >
                  +
                </button>
                <span className="ml-auto font-mono font-bold text-slate-900 text-sm">
                  {formatINR(item.price * item.quantity)}
                </span>
              </div>
            </div>
            {/* Remove */}
            <button
              onClick={() => updateQty(item.product_id, 0)}
              className="text-slate-300 hover:text-rose-400 text-lg self-start"
            >
              ✕
            </button>
          </div>
        ))}

        {/* Note */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100">
          <p className="font-semibold text-slate-700 text-sm mb-2">Add a note (optional)</p>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="e.g. Deliver to reception, 2nd floor"
            rows={2}
            className="w-full text-sm text-slate-900 bg-slate-50 rounded-xl border border-slate-200 p-3 resize-none focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>

        {/* Price summary */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-100 space-y-2">
          <p className="font-heading font-bold text-slate-900 mb-3">Price Summary</p>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Subtotal</span>
            <span className="font-mono font-semibold text-slate-900">{formatINR(subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">GST (18%)</span>
            <span className="font-mono font-semibold text-slate-900">{formatINR(gst)}</span>
          </div>
          <div className="border-t border-slate-100 pt-2 flex justify-between">
            <span className="font-heading font-bold text-slate-900">Total</span>
            <span className="font-mono font-bold text-teal-700 text-lg">{formatINR(grandTotal)}</span>
          </div>
        </div>
      </div>

      {/* Sticky checkout bar */}
      <div className="bg-white border-t border-slate-100 px-4 py-3 shadow-lg">
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-slate-500 text-xs">{items.length} item{items.length !== 1 ? 's' : ''}</p>
            <p className="font-mono font-bold text-slate-900 text-lg">{formatINR(grandTotal)}</p>
          </div>
          <button
            onClick={handleOrder}
            disabled={placing}
            className="bg-teal-600 hover:bg-teal-700 disabled:opacity-60 text-white font-bold rounded-2xl px-8 py-3 text-base transition-colors"
          >
            {placing ? 'Placing…' : 'Place Order →'}
          </button>
        </div>
      </div>
    </div>
  );
}
