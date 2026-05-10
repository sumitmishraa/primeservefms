'use client';

import Image from 'next/image';
import Link from 'next/link';
import {
  Box,
  Brush,
  ChevronRight,
  ClipboardList,
  Coffee,
  Droplets,
  Feather,
  FileText,
  FlaskConical,
  Layers,
  Package,
  PenTool,
  Printer,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Trash2,
  Wind,
  Wrench,
} from 'lucide-react';
import {
  Card,
  MobilePage,
  ScreenHeader,
  categoryIconMap,
  categoryImages,
  mobileIcons,
} from '@/components/mobile/PrimeserveMobile';
import { PRODUCT_CATEGORIES, SUBCATEGORIES } from '@/lib/constants/categories';

/** Subcategory slug → icon mapping using confirmed lucide-react icons */
const SUBCAT_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  // Housekeeping Materials
  air_and_room_fresheners: Wind,
  brooms_and_cleaning_cloths: Brush,
  brushes_and_scrubbing_tools: Brush,
  dispensers_and_hand_dryers: Droplets,
  dusting_tools: Feather,
  floor_cleaning_tools: Layers,
  garbage_bags_black: Trash2,
  garbage_bags_colour_coded: Trash2,
  glass_cleaning_tools: Sparkles,
  gloves_and_hand_protection: ShieldCheck,
  mops_and_mop_refills: Wrench,
  paper_and_tissue_products: FileText,
  pest_control: Box,
  plastic_ware_and_bins: Package,
  scrubbers_and_sponges: Brush,
  signage_and_safety_boards: ShieldCheck,
  spray_bottles_and_dispensers: Droplets,
  toilet_cleaning_tools: Brush,
  toilet_fresheners: Wind,
  urinal_care: Droplets,
  wipers_and_dusters: Feather,
  // Cleaning Chemicals
  laundry_chemicals: Layers,
  kitchen_hygiene_and_warewashing: Coffee,
  housekeeping_and_general_cleaners: FlaskConical,
  floor_care_and_polish: Layers,
  washroom_and_odour_control: Wind,
  personal_care_and_hand_hygiene: Droplets,
  pest_control_and_fly_management: Box,
  dispensers_and_hygiene_accessories: Package,
  dishwashing_machines_and_equipment: Wrench,
  bulk_cleaning_chemicals: FlaskConical,
  branded_cleaning_liquids: FlaskConical,
  soaps_and_detergent_powders: Droplets,
  // Pantry
  disposable_cups_and_plates: Coffee,
  // Office Stationeries
  copier_and_printing_paper: FileText,
  pens_pencils_and_markers: PenTool,
  notebooks_and_writing_pads: ClipboardList,
  staplers_and_punching_machines: Star,
  clips_pins_and_fasteners: Box,
  sticky_notes_and_postits: FileText,
  tapes_and_adhesives: Package,
  files_and_folders: ClipboardList,
  scissors_and_cutters: ShoppingBag,
  stamps_ink_and_correction: Box,
  batteries: Sparkles,
  carbon_and_transfer_paper: FileText,
  calculators_and_desk_accessories: ClipboardList,
  desk_organizers_and_accessories: Box,
  rubber_bands_and_elastics: Package,
  envelopes_and_covers: ClipboardList,
  general_stationery: PenTool,
  // Facility & Tools
  safety_equipment: ShieldCheck,
  plumbing_tools: Wrench,
  // Printing
  printing_supplies: Printer,
};

/** Fallback icon rotation for any slug not in the map */
const FALLBACK_ICONS = [
  Sparkles, Box, ClipboardList, FileText, Package, ShoppingBag, ShieldCheck, Wrench,
  Star, Feather, FlaskConical, Coffee, Droplets, Wind, Layers,
];

export default function MobileCategoriesPage() {
  return (
    <MobilePage>
      <ScreenHeader
        title="Categories"
        subtitle="Browse PrimeServe by category and subcategory"
        variant="dark"
      />

      <div className="space-y-3 px-5 py-5">
        {PRODUCT_CATEGORIES.map((category) => {
          const CatIcon = categoryIconMap[category.value] ?? mobileIcons.Box;
          const subcategories = SUBCATEGORIES[category.value] ?? [];
          return (
            <Card key={category.value} className="overflow-hidden">
              {/* ── Category header: small 56×56 image icon + name ── */}
              <Link
                href={`/mobile/products?category=${category.value}`}
                className="ps-press flex items-center gap-3 border-b border-slate-100 p-4"
              >
                {/* 56×56 category image with icon overlay */}
                <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl bg-[#0B1220]">
                  <Image
                    src={categoryImages[category.value]}
                    alt={category.label}
                    fill
                    className="object-cover opacity-75"
                    sizes="56px"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/25">
                    <CatIcon className="h-5 w-5 text-white drop-shadow-sm" />
                  </div>
                </div>

                <div className="min-w-0 flex-1">
                  <h2 className="font-heading text-base font-extrabold text-slate-900">
                    {category.label}
                  </h2>
                  <p className="mt-0.5 text-xs font-semibold text-slate-400">
                    {category.productCount}+ products
                  </p>
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
              </Link>

              {/* ── Subcategories list ── */}
              {subcategories.length > 0 ? (
                <div className="p-2">
                  {subcategories.map((subcategory, index) => {
                    const SubIcon =
                      SUBCAT_ICON_MAP[subcategory.slug] ??
                      FALLBACK_ICONS[index % FALLBACK_ICONS.length];
                    return (
                      <Link
                        key={subcategory.slug}
                        href={`/mobile/products?category=${category.value}&subcategory=${subcategory.slug}`}
                        className="ps-press flex items-center gap-3 rounded-xl px-3 py-2.5"
                      >
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[rgba(20,184,166,0.10)]">
                          <SubIcon className="h-4 w-4 text-[#0D9488]" />
                        </span>
                        <span className="min-w-0 flex-1 text-sm font-bold leading-5 text-slate-700">
                          {subcategory.label}
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-200" />
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="px-4 py-3 text-sm font-semibold text-slate-400">
                  Products coming soon
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </MobilePage>
  );
}
