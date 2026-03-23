'use client';

import PlaceholderPage from '@/components/ui/PlaceholderPage';
import { ShoppingCart } from 'lucide-react';

export default function AdminOrdersPage() {
  return (
    <PlaceholderPage
      icon={ShoppingCart}
      title="All Orders"
      message="Coming in Phase 4 — Monitor every transaction across all buyers and vendors."
    />
  );
}
