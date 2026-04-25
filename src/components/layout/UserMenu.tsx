/**
 * UserMenu — avatar + name button that opens a dropdown with account links and logout.
 * Shows the user's first name next to the avatar initial in the navbar.
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Settings, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import type { UserProfile } from '@/types';

interface UserMenuProps {
  /** Authenticated user — drives avatar initial, links, and name display */
  user: UserProfile;
}

/**
 * Renders the user name + avatar button in the Navbar.
 * Clicking toggles a dropdown with Account Settings and Logout.
 *
 * @param user - The currently authenticated user profile
 */
export default function UserMenu({ user }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { logout } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);

  const avatarInitial = user.full_name.charAt(0).toUpperCase();
  const firstName = user.full_name.split(' ')[0];

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
  };

  return (
    <div ref={menuRef} className="relative">
      {/* Trigger: name + avatar */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-teal-500 transition-colors"
        aria-label="Open user menu"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <div className="w-8 h-8 rounded-full bg-teal-600 text-white font-semibold text-sm flex items-center justify-center shrink-0">
          {avatarInitial}
        </div>
        <span className="hidden sm:block text-sm font-medium text-slate-700 max-w-[96px] truncate">
          {firstName}
        </span>
        <ChevronDown
          className={`hidden sm:block w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute right-0 top-11 w-60 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50"
          role="menu"
        >
          {/* User identity header */}
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-900 truncate">{user.full_name}</p>
            {user.email && (
              <p className="text-xs text-slate-500 truncate mt-0.5">{user.email}</p>
            )}
            {user.company_name && (
              <p className="text-xs text-teal-600 truncate mt-0.5">{user.company_name}</p>
            )}
          </div>

          {/* Navigation */}
          <div className="py-1" role="none">
            <Link
              href="/buyer/account"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              role="menuitem"
            >
              <Settings className="w-4 h-4 text-slate-400" aria-hidden="true" />
              Account Settings
            </Link>
          </div>

          {/* Logout */}
          <div className="border-t border-slate-100 py-1" role="none">
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition-colors"
              role="menuitem"
            >
              <LogOut className="w-4 h-4" aria-hidden="true" />
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
