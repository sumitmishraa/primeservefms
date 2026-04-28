'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import {
  Send,
  ShieldCheck,
  Truck,
  CreditCard,
  Facebook,
  Twitter,
  Instagram,
  Linkedin,
} from 'lucide-react';
import toast from 'react-hot-toast';

const QUICK_LINKS = [
  { href: '/about', label: 'About Us' },
  { href: '/marketplace', label: 'Services' },
  { href: '/contact', label: 'Contact' },
  { href: '/about', label: 'Careers' },
];

const FOOTER_CATEGORIES = [
  { href: '/marketplace?category=housekeeping_materials', label: 'Housekeeping' },
  { href: '/marketplace?category=cleaning_chemicals', label: 'Cleaning Chemicals' },
  { href: '/marketplace?category=office_stationeries', label: 'Office Stationery' },
  { href: '/marketplace?category=pantry_items', label: 'Pantry Items' },
];

export default function PublicFooter() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!email.trim()) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      toast.error('Enter a valid email address');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/newsletter', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email: email.trim(), source: 'footer' }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        throw new Error(json.error ?? 'Could not subscribe. Please try again.');
      }
      setEmail('');
      toast.success('Thanks for subscribing!');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not subscribe. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <footer className="bg-slate-900 text-slate-300">
      <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <div className="grid gap-10 lg:grid-cols-4">
          {/* Col 1: Brand + description + socials */}
          <div>
            <Link href="/" className="mb-4 flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-white font-heading text-base font-bold text-slate-900">
                P
              </div>
              <span className="font-heading text-xl font-bold tracking-tight text-white">
                Prime<span className="text-teal-400">Serve</span>
              </span>
            </Link>
            <p className="mb-5 text-sm leading-relaxed text-slate-400">
              India&apos;s leading B2B marketplace for facility management supplies.
              Bulk pricing, flexible credit terms, and professional procurement for
              businesses of all sizes.
            </p>
            <div className="flex items-center gap-3">
              {[Facebook, Twitter, Instagram, Linkedin].map((Icon, i) => (
                <a
                  key={i}
                  href="#"
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 text-slate-400 transition-colors hover:border-teal-500 hover:text-teal-400"
                  aria-label="Social link"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          {/* Col 2: Quick Links */}
          <div>
            <h3 className="mb-5 border-b border-slate-800 pb-3 font-heading text-base font-bold text-white">
              Quick Links
            </h3>
            <ul className="space-y-3">
              {QUICK_LINKS.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-sm text-slate-400 transition-colors hover:text-teal-400"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 3: Categories */}
          <div>
            <h3 className="mb-5 border-b border-slate-800 pb-3 font-heading text-base font-bold text-white">
              Categories
            </h3>
            <ul className="space-y-3">
              {FOOTER_CATEGORIES.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-sm text-slate-400 transition-colors hover:text-teal-400"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Col 4: Stay Updated */}
          <div>
            <h3 className="mb-5 border-b border-slate-800 pb-3 font-heading text-base font-bold text-white">
              Stay Updated
            </h3>
            <p className="mb-4 text-sm text-slate-400">
              Subscribe to our newsletter for exclusive deals, bulk discounts, and
              the latest product updates.
            </p>
            <form onSubmit={handleSubmit} className="flex gap-2">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2.5 text-sm text-white placeholder:text-slate-500 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/30"
              />
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-teal-700 disabled:opacity-60"
              >
                <Send className="h-4 w-4" />
                Subscribe
              </button>
            </form>

            <div className="mt-6 space-y-2.5">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <ShieldCheck className="h-4 w-4 text-teal-400" />
                Secure Payments
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Truck className="h-4 w-4 text-teal-400" />
                Free Shipping 5K+
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <CreditCard className="h-4 w-4 text-teal-400" />
                45-Day Credit
              </div>
            </div>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-slate-800 pt-6 sm:flex-row">
          <p className="text-xs text-slate-500">
            © {new Date().getFullYear()} PrimeServe. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center gap-5 text-xs text-slate-500">
            <Link href="/terms" className="hover:text-teal-400">
              Terms of Service
            </Link>
            <Link href="/privacy" className="hover:text-teal-400">
              Privacy Policy
            </Link>
            <Link href="/shipping" className="hover:text-teal-400">
              Shipping Policy
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
