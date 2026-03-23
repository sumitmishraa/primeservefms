/**
 * MobileMenu — full-height slide-out panel shown on small screens.
 *
 * Triggered by the hamburger icon in Navbar.
 * Renders the same Sidebar content; passing onClose to Sidebar means any
 * nav link click automatically closes the panel.
 * A dark overlay behind the panel closes it when tapped/clicked.
 */

'use client';

import { useEffect } from 'react';
import { X } from 'lucide-react';
import type { UserProfile } from '@/types';
import Sidebar from './Sidebar';

interface MobileMenuProps {
  /** Authenticated user — forwarded to Sidebar for nav and identity display */
  user: UserProfile;
  /** Whether the slide-out panel is visible */
  isOpen: boolean;
  /** Called when the overlay, close button, or any nav link is clicked */
  onClose: () => void;
}

/**
 * Slide-in navigation panel for mobile viewports (hidden on lg+).
 * Locks body scroll while open and unlocks on close.
 *
 * @param user - The currently authenticated user
 * @param isOpen - Controls panel visibility
 * @param onClose - Callback to dismiss the panel
 */
export default function MobileMenu({ user, isOpen, onClose }: MobileMenuProps) {
  // Lock body scroll while the menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="lg:hidden fixed inset-0 z-50 flex" role="dialog" aria-modal="true" aria-label="Navigation menu">
      {/* Dark overlay */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Slide-in panel */}
      <div className="relative z-10 flex flex-col bg-white h-full shadow-xl">
        {/* Close button row */}
        <div className="flex items-center justify-end p-3 border-b border-slate-100 bg-white">
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-500 hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
            aria-label="Close navigation menu"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Sidebar content — onNavClick closes the panel */}
        <div className="flex-1 overflow-y-auto">
          <Sidebar user={user} onNavClick={onClose} />
        </div>
      </div>
    </div>
  );
}
