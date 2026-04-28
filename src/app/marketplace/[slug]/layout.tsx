import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { createAdminClient } from '@/lib/supabase/admin';
import { getCategoryLabel } from '@/lib/constants/categories';

interface ProductSeoRow {
  name: string;
  short_description: string | null;
  description: string | null;
  brand: string | null;
  size_variant: string | null;
  thumbnail_url: string | null;
  images: string[] | null;
  category: string;
}

function siteBaseUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return 'https://primeservefms.vercel.app';
}

function toPlainDescription(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

function fallbackDescription(product: ProductSeoRow): string {
  const size = product.size_variant ? ` ${product.size_variant}` : '';
  const brand = product.brand ? `${product.brand} ` : '';
  const category = getCategoryLabel(product.category).toLowerCase();
  return `Buy ${brand}${product.name}${size} for ${category} procurement. PrimeServe supplies B2B facility products with GST invoices and bulk delivery.`;
}

function productDescription(product: ProductSeoRow): string {
  const description =
    toPlainDescription(product.short_description) ||
    toPlainDescription(product.description) ||
    fallbackDescription(product);
  return description.length > 160 ? `${description.slice(0, 157).trim()}...` : description;
}

function imageUrl(product: ProductSeoRow): string | null {
  const raw = product.thumbnail_url || product.images?.[0] || null;
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  try {
    return new URL(raw, siteBaseUrl()).toString();
  } catch {
    return null;
  }
}

async function getProduct(slug: string): Promise<ProductSeoRow | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null;
  }

  try {
    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from('products')
      .select('name, short_description, description, brand, size_variant, thumbnail_url, images, category')
      .eq('slug', slug)
      .eq('is_approved', true)
      .eq('is_active', true)
      .single();

    if (error || !data) return null;
    return data as ProductSeoRow;
  } catch {
    return null;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);

  if (!product) {
    return {
      title: 'Product | PrimeServe B2B Marketplace',
      description: 'Browse B2B housekeeping, cleaning, pantry, stationery, and facility supplies on PrimeServe.',
      alternates: { canonical: `/marketplace/${slug}` },
    };
  }

  const description = productDescription(product);
  const image = imageUrl(product);
  const size = product.size_variant ? ` ${product.size_variant}` : '';
  const title = `${product.name}${size} | PrimeServe`;
  const alt = `Buy ${product.name}${size} from PrimeServe B2B marketplace`;

  return {
    title,
    description,
    alternates: { canonical: `/marketplace/${slug}` },
    keywords: [
      product.name,
      product.brand,
      product.size_variant,
      getCategoryLabel(product.category),
      'B2B housekeeping supplies',
      'facility management products',
      'GST invoice procurement',
    ].filter(Boolean) as string[],
    openGraph: {
      title,
      description,
      type: 'website',
      url: `${siteBaseUrl()}/marketplace/${slug}`,
      images: image ? [{ url: image, alt }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default function ProductLayout({
  children,
}: Readonly<{
  children: ReactNode;
}>) {
  return children;
}
