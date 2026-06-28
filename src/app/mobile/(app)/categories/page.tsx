'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import {
  Box,
  Brush,
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
  MobilePage,
  ScreenHeader,
  categoryIconMap,
  mobileIcons,
} from '@/components/mobile/PrimeserveMobile';
import { PRODUCT_CATEGORIES, SUBCATEGORIES } from '@/lib/constants/categories';

/** Subcategory slug → icon mapping */
const SUBCAT_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
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
  disposable_cups_and_plates: Coffee,
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
  safety_equipment: ShieldCheck,
  plumbing_tools: Wrench,
  printing_supplies: Printer,
};

const FALLBACK_ICONS = [
  Sparkles, Box, ClipboardList, FileText, Package, ShoppingBag, ShieldCheck, Wrench,
  Star, Feather, FlaskConical, Coffee, Droplets, Wind, Layers,
];

function CategoriesContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSlug = searchParams.get('active') ?? PRODUCT_CATEGORIES[0]?.value ?? '';
  const [activeCategory, setActiveCategory] = useState(initialSlug);

  const activeCat = PRODUCT_CATEGORIES.find((c) => c.value === activeCategory) ?? PRODUCT_CATEGORIES[0];
  const subcategories = SUBCATEGORIES[activeCat?.value ?? ''] ?? [];

  return (
    <MobilePage withBottomPadding={false} className="flex flex-col">
      <ScreenHeader
        title="Categories"
        subtitle="Browse by category and subcategory"
        variant="dark"
      />

      {/* Two-panel layout */}
      <div className="flex flex-1 overflow-hidden" style={{ height: 'calc(100dvh - 128px)' }}>
        {/* ── Left sidebar: category rail ── */}
        <nav className="w-[82px] shrink-0 overflow-y-auto bg-slate-100" style={{ scrollbarWidth: 'none' }}>
          {PRODUCT_CATEGORIES.map((cat) => {
            const Icon = categoryIconMap[cat.value] ?? mobileIcons.Box;
            const isActive = cat.value === activeCategory;
            return (
              <button
                key={cat.value}
                type="button"
                onClick={() => setActiveCategory(cat.value)}
                className={`relative flex w-full flex-col items-center gap-1.5 px-2 py-4 text-center transition-colors ${
                  isActive
                    ? 'bg-white text-[#0D9488]'
                    : 'text-slate-500 hover:bg-white/60'
                }`}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-10 w-[3px] -translate-y-1/2 rounded-r-full bg-[#14B8A6]" />
                )}
                <span
                  className={`flex h-10 w-10 items-center justify-center rounded-xl transition-colors ${
                    isActive ? 'bg-[rgba(20,184,166,0.14)]' : 'bg-white'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${isActive ? 'text-[#0D9488]' : 'text-slate-400'}`} />
                </span>
                <span className={`line-clamp-2 text-[10px] font-extrabold leading-3 ${isActive ? 'text-[#0D9488]' : 'text-slate-500'}`}>
                  {cat.label}
                </span>
              </button>
            );
          })}
        </nav>

        {/* ── Right panel: subcategory grid ── */}
        <div className="flex-1 overflow-y-auto bg-white px-3 pb-24 pt-3" style={{ scrollbarWidth: 'none' }}>
          {/* Category header */}
          <div className="mb-4 rounded-2xl bg-[rgba(20,184,166,0.08)] p-3">
            <p className="font-heading text-base font-extrabold text-slate-900">{activeCat?.label}</p>
            <p className="mt-0.5 text-xs font-semibold text-slate-400">
              {activeCat?.productCount}+ products
            </p>
          </div>

          {subcategories.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {subcategories.map((subcat, index) => {
                const SubIcon =
                  SUBCAT_ICON_MAP[subcat.slug] ??
                  FALLBACK_ICONS[index % FALLBACK_ICONS.length];
                return (
                  <button
                    key={subcat.slug}
                    type="button"
                    onClick={() =>
                      router.push(
                        `/mobile/products?category=${activeCat?.value}&subcategory=${subcat.slug}`,
                      )
                    }
                    className="ps-press flex flex-col items-center gap-2 rounded-2xl border border-slate-100 bg-slate-50 p-3 text-center transition-colors hover:border-[rgba(20,184,166,0.35)] hover:bg-[rgba(20,184,166,0.06)]"
                  >
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[rgba(20,184,166,0.12)]">
                      <SubIcon className="h-6 w-6 text-[#0D9488]" />
                    </span>
                    <span className="line-clamp-2 text-[11px] font-bold leading-3.5 text-slate-700">
                      {subcat.label}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100">
                <mobileIcons.Box className="h-8 w-8 text-slate-300" />
              </span>
              <p className="mt-4 font-heading text-base font-extrabold text-slate-700">
                Coming soon
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-400">
                Products are being added to this category.
              </p>
            </div>
          )}
        </div>
      </div>
    </MobilePage>
  );
}

export default function MobileCategoriesPage() {
  return (
    <Suspense fallback={null}>
      <CategoriesContent />
    </Suspense>
  );
}
