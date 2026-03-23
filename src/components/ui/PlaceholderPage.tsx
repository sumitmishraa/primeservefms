/**
 * PlaceholderPage — reusable "coming soon" screen used across all dashboard
 * sub-pages that are not yet built.
 *
 * Renders a centred icon, title, description, and a "Go Back" button that
 * navigates to the previous browser history entry.
 */

'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeft, type LucideIcon } from 'lucide-react';

interface PlaceholderPageProps {
  /** Lucide icon component to display above the title */
  icon: LucideIcon;
  /** Page title — e.g. "Marketplace" */
  title: string;
  /** Short message — e.g. "Coming in Phase 4" */
  message: string;
}

/**
 * Full-page placeholder for dashboard routes that are not yet implemented.
 * Reused by all ~20 stub pages so the nav links don't result in 404s.
 *
 * @param icon - Lucide icon for visual context
 * @param title - Human-readable page name
 * @param message - Short "coming soon" description
 */
export default function PlaceholderPage({ icon: Icon, title, message }: PlaceholderPageProps) {
  const router = useRouter();

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
      {/* Icon container */}
      <div className="w-16 h-16 bg-teal-50 rounded-2xl flex items-center justify-center mb-5">
        <Icon className="w-8 h-8 text-teal-600" aria-hidden="true" />
      </div>

      {/* Title */}
      <h1 className="text-xl font-semibold text-slate-900 mb-2">{title}</h1>

      {/* Message */}
      <p className="text-sm text-slate-500 max-w-xs leading-relaxed mb-7">{message}</p>

      {/* Go back */}
      <button
        onClick={() => router.back()}
        className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" aria-hidden="true" />
        Go Back
      </button>
    </div>
  );
}
