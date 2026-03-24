'use client';

import PlaceholderPage from '@/components/ui/PlaceholderPage';
import { Upload } from 'lucide-react';

export default function AdminImportProductsPage() {
  return (
    <PlaceholderPage
      icon={Upload}
      title="Import Products"
      message="Upload your Excel catalog to bulk-add products. Supports the Housekeeping and Stationery sheets. This section will be built next."
    />
  );
}
