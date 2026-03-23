/**
 * UserMenu — avatar button that opens a dropdown with profile links and logout.
 * Click outside the menu to dismiss it.
 */

'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import type { UserProfile } from '@/types';

interface UserMenuProps {
  /** Authenticated user — drives avatar initial, links, and role-based paths */
  user: UserProfile;
}

/**
 * Renders the circular avatar button in the Navbar.
 * Clicking it toggles a dropdown with profile/settings links and a logout action.
 *
 * @param user - The currently authenticated user profile
 */
export default function UserMenu({ user }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { logout } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);
  const avatarInitial = user.full_name.charAt(0).toUpperCase();

  // Close when clicking outside
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
      {/* Avatar trigger */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-9 h-9 rounded-full bg-teal-600 text-white font-semibold text-sm flex items-center justify-center hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-1 transition-colors"
        aria-label="Open user menu"
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {avatarInitial}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute right-0 top-11 w-56 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50"
          role="menu"
        >
          {/* User identity */}
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-900 truncate">
              {user.full_name}
            </p>
            {user.email && (
              <p className="text-xs text-slate-500 truncate mt-0.5">{user.email}</p>
            )}
          </div>

          {/* Navigation links */}
          <div className="py-1" role="none">
            <Link
              href={`/${user.role}/profile`}
              onClick={() => setIsOpen(false)}
              className="flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              role="menuitem"
            >
              My Profile
            </Link>
            <Link
              href={`/${user.role}/settings`}
              onClick={() => setIsOpen(false)}
              className="flex items-center px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              role="menuitem"
            >
              Settings
            </Link>
          </div>

          {/* Logout */}
          <div className="border-t border-slate-100 py-1" role="none">
            <button
              onClick={handleLogout}
              className="w-full flex items-center px-4 py-2 text-sm text-rose-600 hover:bg-rose-50 transition-colors"
              role="menuitem"
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
