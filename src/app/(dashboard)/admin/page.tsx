'use client';

import PlaceholderPage from '@/components/ui/PlaceholderPage';
import { LayoutDashboard } from 'lucide-react';

export default function AdminDashboardPage() {
  return (
    <PlaceholderPage
      icon={LayoutDashboard}
      title="Admin Dashboard"
      message="Coming in Phase 4 — Platform analytics, GMV, active buyers and vendors."
    />
  );
}
