'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Badge,
  BrandHeader,
  ButtonLink,
  Card,
  DarkCard,
  MobilePage,
  SearchPill,
  categoryIconMap,
  categoryImages,
  mobileIcons,
  useAuthStatus,
} from '@/components/mobile/PrimeserveMobile';
import { PRODUCT_CATEGORIES } from '@/lib/constants/categories';
import { formatINR } from '@/lib/utils/formatting';

interface Product {
  id: string;
  name: string;
  slug: string;
  base_price: number;
  unit_of_measure: string;
  thumbnail_url: string | null;
  category: string;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  created_at: string;
  items?: { product_id: string; product_name: string; quantity: number; unit_price: number; unit_of_measure: string; thumbnail_url?: string | null }[];
}

const STATUS_COLORS: Record<string, string> = {
  pending: 'text-amber-600 bg-amber-50',
  confirmed: 'text-sky-600 bg-sky-50',
  processing: 'text-sky-600 bg-sky-50',
  shipped: 'text-teal-600 bg-[rgba(20,184,166,0.12)]',
  delivered: 'text-emerald-600 bg-emerald-50',
  cancelled: 'text-rose-600 bg-rose-50',
};

const TOP_DEALS = [
  {
    label: 'Bulk Saver',
    title: 'Save up to 18% on Cleaning Supplies',
    sub: 'Order 50+ units of any cleaning chemical',
    color: 'from-[#0D9488] to-[#0B1220]',
    icon: mobileIcons.Zap,
    href: '/mobile/products?category=cleaning_chemicals',
  },
  {
    label: 'MOQ Deal',
    title: 'Free Shipping on ₹5,000+ Orders',
    sub: 'Housekeeping & stationery combined',
    color: 'from-[#0F766E] to-[#13243F]',
    icon: mobileIcons.ShoppingCart,
    href: '/mobile/products',
  },
];

export default function MobileHomePage() {
  const { user, isAuthed } = useAuthStatus();
  const [products, setProducts] = useState<Product[]>([]);
  const [recentOrders, setRecentOrders] = useState<Order[]>([]);

  useEffect(() => {
    fetch('/api/products?per_page=12&sort=relevance')
      .then((r) => r.json())
      .then((d) => setProducts(d?.data?.products ?? []))
      .catch(() => setProducts([]));
  }, []);

  useEffect(() => {
    if (!isAuthed) return;
    fetch('/api/buyer/orders?per_page=3')
      .then((r) => r.json())
      .then((d) => setRecentOrders(d?.data?.orders ?? []))
      .catch(() => setRecentOrders([]));
  }, [isAuthed]);

  const firstName = user?.full_name?.split(' ')[0] ?? 'there';
  const company = user?.company_name ?? null;
  const marqueeProducts = products.length > 0 ? [...products, ...products] : [];

  return (
    <MobilePage>
      <BrandHeader
        eyebrow="India's B2B facility supplies"
        title={`Good day, ${firstName} 👋`}
        subtitle={company ?? undefined}
        action={
          <div className="flex items-center gap-2">
            <Link
              href="/mobile/account"
              className="ps-press flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/10"
            >
              <mobileIcons.Bell className="h-5 w-5 text-white" />
            </Link>
            <Link
              href="/mobile/account"
              className="ps-press flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/10"
            >
              <mobileIcons.User className="h-5 w-5 text-white" />
            </Link>
          </div>
        }
      >
        <SearchPill href="/mobile/products" placeholder="Search products, categories..." />

        {/* Quick actions */}
        <div className="mt-4 grid grid-cols-4 gap-2">
          {[
            { href: '/mobile/products', label: 'Browse', icon: mobileIcons.ShoppingCart },
            { href: '/mobile/orders', label: 'Reorder', icon: mobileIcons.Box },
            { href: '/mobile/orders', label: 'Track', icon: mobileIcons.BadgeCheck },
            { href: '/mobile/credits', label: 'Credit', icon: mobileIcons.WalletCards },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.label}
                href={item.href}
                className="ps-press flex flex-col items-center gap-1.5 rounded-2xl border border-white/10 bg-white/10 py-3"
              >
                <Icon className="h-5 w-5 text-[#2DD4BF]" />
                <span className="text-[10px] font-extrabold uppercase tracking-[0.12em] text-slate-300">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </BrandHeader>

      {/* Featured products marquee */}
      <section className="px-5 pt-5">
        <div className="flex items-center justify-between">
          <div>
            <Badge>Featured products</Badge>
            <h2 className="mt-2 font-heading text-xl font-extrabold text-slate-900">
              Popular procurement picks
            </h2>
          </div>
          <Link href="/mobile/products" className="text-sm font-extrabold text-[#0D9488]">
            View all
          </Link>
        </div>

        <div className="ps-edge-mask mt-4 overflow-hidden">
          {marqueeProducts.length > 0 ? (
            <div className="ps-marquee-track flex w-max gap-3 pb-2">
              {marqueeProducts.map((product, index) => (
                <Link
                  key={`${product.id}-${index}`}
                  href={`/mobile/products?search=${encodeURIComponent(product.name)}`}
                  className="ps-press w-40 shrink-0 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm"
                >
                  <div className="relative h-24 overflow-hidden rounded-xl bg-slate-50">
                    {product.thumbnail_url ? (
                      <Image
                        src={product.thumbnail_url}
                        alt={product.name}
                        fill
                        className="object-contain p-2"
                        sizes="160px"
                      />
                    ) : (
                      <mobileIcons.Box className="m-auto mt-7 h-9 w-9 text-slate-300" />
                    )}
                  </div>
                  <p className="mt-3 line-clamp-2 min-h-10 text-sm font-bold leading-5 text-slate-900">
                    {product.name}
                  </p>
                  <p className="mt-1 font-heading text-sm font-extrabold text-[#0D9488]">
                    {formatINR(product.base_price)}
                    <span className="font-sans text-[11px] font-semibold text-slate-400">
                      {' '}/ {product.unit_of_measure}
                    </span>
                  </p>
                </Link>
              ))}
            </div>
          ) : (
            <Card className="p-5 text-sm font-semibold text-slate-500">
              Loading featured products...
            </Card>
          )}
        </div>
      </section>

      {/* Top Deals banners */}
      <section className="px-5 pt-5">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-xl font-extrabold text-slate-900">Top deals</h2>
          <Link href="/mobile/products" className="text-sm font-extrabold text-[#0D9488]">
            All offers
          </Link>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {TOP_DEALS.map((deal) => {
            const Icon = deal.icon;
            return (
              <Link
                key={deal.label}
                href={deal.href}
                className={`ps-press relative overflow-hidden rounded-2xl bg-gradient-to-br ${deal.color} p-4`}
              >
                <span className="inline-block rounded-full border border-white/20 bg-white/15 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-white">
                  {deal.label}
                </span>
                <p className="mt-2 text-sm font-extrabold leading-5 text-white">{deal.title}</p>
                <p className="mt-1 text-[10px] font-semibold leading-4 text-white/70">{deal.sub}</p>
                <div className="mt-3 flex h-8 w-8 items-center justify-center rounded-xl bg-white/15">
                  <Icon className="h-4 w-4 text-[#2DD4BF]" />
                </div>
                {/* decorative corner circle */}
                <div className="absolute -right-4 -top-4 h-16 w-16 rounded-full bg-white/8" />
              </Link>
            );
          })}
        </div>
      </section>

      {/* Quick Reorder — shown only to authenticated users with past orders */}
      {isAuthed && recentOrders.length > 0 && (
        <section className="px-5 pt-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-heading text-xl font-extrabold text-slate-900">Quick reorder</h2>
              <p className="mt-0.5 text-xs font-semibold text-slate-400">From your recent orders</p>
            </div>
            <Link href="/mobile/orders" className="text-sm font-extrabold text-[#0D9488]">
              View all
            </Link>
          </div>
          <div className="mt-3 flex gap-3 overflow-x-auto pb-2" style={{ scrollbarWidth: 'none' }}>
            {recentOrders.map((order) => {
              const colorClass = STATUS_COLORS[order.status] ?? 'text-slate-600 bg-slate-50';
              return (
                <Link
                  key={order.id}
                  href="/mobile/orders"
                  className="ps-press flex w-48 shrink-0 flex-col rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[rgba(20,184,166,0.12)]">
                      <mobileIcons.Box className="h-4 w-4 text-[#0D9488]" />
                    </div>
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-extrabold capitalize ${colorClass}`}>
                      {order.status}
                    </span>
                  </div>
                  <p className="mt-2.5 font-heading text-sm font-extrabold text-slate-900">
                    {order.order_number}
                  </p>
                  <p className="mt-0.5 text-xs font-semibold text-slate-400">
                    {formatINR(order.total_amount)}
                  </p>
                  <div className="mt-3 flex items-center gap-1.5 rounded-xl border border-[#14B8A6]/30 bg-[rgba(20,184,166,0.06)] px-3 py-1.5">
                    <mobileIcons.ShoppingCart className="h-3.5 w-3.5 text-[#0D9488]" />
                    <span className="text-[11px] font-extrabold text-[#0D9488]">Reorder</span>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* Shop by category */}
      <section className="px-5 pt-5">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-xl font-extrabold text-slate-900">Shop by category</h2>
          <Link href="/mobile/categories" className="text-sm font-extrabold text-[#0D9488]">
            All
          </Link>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {PRODUCT_CATEGORIES.slice(0, 4).map((category) => {
            const Icon = categoryIconMap[category.value] ?? mobileIcons.Box;
            return (
              <Link
                key={category.value}
                href={`/mobile/products?category=${category.value}`}
                className="ps-press overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"
              >
                <div className="relative h-24 bg-[#0B1220]">
                  <Image
                    src={categoryImages[category.value]}
                    alt={category.label}
                    fill
                    className="object-cover opacity-70"
                    sizes="50vw"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#0B1220] via-[#0B1220]/20 to-transparent" />
                  <div className="absolute bottom-3 left-3 flex h-9 w-9 items-center justify-center rounded-xl bg-white">
                    <Icon className="h-5 w-5 text-[#0D9488]" />
                  </div>
                </div>
                <div className="p-3">
                  <p className="font-heading text-sm font-extrabold leading-5 text-slate-900">
                    {category.label}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-slate-400">
                    {category.productCount}+ products
                  </p>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 45-day credit promo */}
      <section className="px-5 pt-5">
        <DarkCard className="p-5">
          <div className="flex gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#14B8A6]/20">
              <mobileIcons.CreditCard className="h-6 w-6 text-[#2DD4BF]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-heading text-lg font-extrabold text-white">45-day credit terms</p>
              <p className="mt-1 text-sm leading-6 text-slate-300">
                Place eligible B2B orders now and settle invoices within 45 days.
              </p>
              <ButtonLink href="/mobile/credits" kind="light" className="mt-4 h-11">
                View credit terms
              </ButtonLink>
            </div>
          </div>
        </DarkCard>
      </section>
    </MobilePage>
  );
}
