'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { Settings, LogOut, ChevronDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import type { UserProfile } from '@/types';

interface UserMenuProps {
  user: UserProfile;
}

export default function UserMenu({ user }: UserMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { logout } = useAuth();
  const menuRef = useRef<HTMLDivElement>(null);

  const avatarInitial = user.full_name.charAt(0).toUpperCase();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handleLogout = async () => {
    setIsOpen(false);
    await logout();
  };

  return (
    <div ref={menuRef} className="relative">
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
        <span className="hidden sm:block text-sm font-medium text-slate-700 max-w-[120px] truncate">
          {user.full_name}
        </span>
        <ChevronDown
          className={`hidden sm:block w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {isOpen && (
        <div
          className="absolute right-0 top-11 w-60 bg-white rounded-xl shadow-lg border border-slate-200 py-1 z-50"
          role="menu"
        >
          {/* Identity */}
          <div className="px-4 py-3 border-b border-slate-100">
            <p className="text-sm font-semibold text-slate-900 truncate">{user.full_name}</p>
            {user.phone && (
              <p className="text-xs text-slate-500 truncate mt-0.5">{user.phone}</p>
            )}
          </div>

          {/* Profile Settings */}
          <div className="py-1" role="none">
            <Link
              href="/buyer/account/profile"
              onClick={() => setIsOpen(false)}
              className="flex items-center gap-3 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 transition-colors"
              role="menuitem"
            >
              <Settings className="w-4 h-4 text-slate-400" aria-hidden="true" />
              Profile Settings
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
