'use client';
import { useState, useEffect, useCallback } from 'react';

export const CART_KEY = 'ps_mobile_cart';

export interface CartItem {
  product_id: string;
  name: string;
  price: number;
  quantity: number;
  unit: string;
  moq: number;
  thumbnail_url?: string | null;
}

function dispatch() {
  window.dispatchEvent(new Event('cart-updated'));
}

function readCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function useMobileCart() {
  const [items, setItems] = useState<CartItem[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      setItems(readCart());
      setReady(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  const addItem = useCallback((item: CartItem) => {
    setItems((prev) => {
      const existing = prev.find((i) => i.product_id === item.product_id);
      const next = existing
        ? prev.map((i) =>
            i.product_id === item.product_id
              ? { ...i, quantity: i.quantity + item.quantity }
              : i
          )
        : [...prev, item];
      localStorage.setItem(CART_KEY, JSON.stringify(next));
      dispatch();
      return next;
    });
  }, []);

  const updateQty = useCallback((product_id: string, qty: number) => {
    setItems((prev) => {
      const next =
        qty <= 0
          ? prev.filter((i) => i.product_id !== product_id)
          : prev.map((i) =>
              i.product_id === product_id ? { ...i, quantity: qty } : i
            );
      localStorage.setItem(CART_KEY, JSON.stringify(next));
      dispatch();
      return next;
    });
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
    localStorage.removeItem(CART_KEY);
    dispatch();
  }, []);

  const totalItems = items.reduce((s, i) => s + i.quantity, 0);
  const totalAmount = items.reduce((s, i) => s + i.price * i.quantity, 0);

  return { items, ready, addItem, updateQty, clearCart, totalItems, totalAmount };
}
