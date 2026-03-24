'use client';

import PlaceholderPage from '@/components/ui/PlaceholderPage';
import { ShoppingCart } from 'lucide-react';

export default function AdminOrdersPage() {
  return (
    <PlaceholderPage
      icon={ShoppingCart}
      title="Orders"
      message="View and manage all orders — approve, forward to vendor, and track dispatch. This section will be built next."
    />
  );
}
