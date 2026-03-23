'use client';

import PlaceholderPage from '@/components/ui/PlaceholderPage';
import { ShoppingCart } from 'lucide-react';

export default function VendorOrdersPage() {
  return (
    <PlaceholderPage
      icon={ShoppingCart}
      title="Vendor Orders"
      message="Coming in Phase 3 — Manage incoming orders and update fulfilment status."
    />
  );
}
