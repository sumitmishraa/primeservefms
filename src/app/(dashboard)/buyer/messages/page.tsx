'use client';

import PlaceholderPage from '@/components/ui/PlaceholderPage';
import { MessageSquare } from 'lucide-react';

export default function BuyerMessagesPage() {
  return (
    <PlaceholderPage
      icon={MessageSquare}
      title="Messages"
      message="Direct messaging with vendors is coming soon. For now, add delivery instructions and special notes in your order at checkout."
    />
  );
}
