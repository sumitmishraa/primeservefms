'use client';

import PlaceholderPage from '@/components/ui/PlaceholderPage';
import { ShoppingCart } from 'lucide-react';

export default function BuyerCartPage() {
  return (
    <PlaceholderPage
      icon={ShoppingCart}
      title="Cart"
      message="Coming in Phase 4 — Review items, see GST calculations, and checkout."
    />
  );
}
