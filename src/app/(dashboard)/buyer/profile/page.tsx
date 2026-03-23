'use client';

import PlaceholderPage from '@/components/ui/PlaceholderPage';
import { User } from 'lucide-react';

export default function BuyerProfilePage() {
  return (
    <PlaceholderPage
      icon={User}
      title="My Profile"
      message="Coming in Phase 4 — Manage your business details, addresses, and GST information."
    />
  );
}
