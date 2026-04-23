'use client';

import { useState } from 'react';
import { ChevronDown, Search } from 'lucide-react';
import { PRODUCT_CATEGORIES, getSubcategoriesByCategory } from '@/lib/constants/categories';

interface ProductSidebarProps {
  selectedCategory: string;
  selectedSubcategory: string;
  searchQuery: string;
  onCategoryChange: (cat: string) => void;
  onSubcategoryChange: (sub: string) => void;
  onSearchChange: (q: string) => void;
}

/**
 * Left-side vertical filter panel matching the B2B marketplace aesthetic:
 * Search, Categories accordion with checkboxes + counts, Subcategories accordion,
 * and a Brands placeholder accordion.
 */
export default function ProductSidebar({
  selectedCategory,
  selectedSubcategory,
  searchQuery,
  onCategoryChange,
  onSubcategoryChange,
  onSearchChange,
}: ProductSidebarProps) {
  const [categoriesOpen, setCategoriesOpen] = useState(true);
  const [subcategoriesOpen, setSubcategoriesOpen] = useState(true);
  const [brandsOpen, setBrandsOpen] = useState(false);

  const subcategories = getSubcategoriesByCategory(selectedCategory);

  return (
    <aside className="w-full space-y-4 lg:w-72 lg:shrink-0">
      {/* Search */}
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search products"
            className="h-10 w-full rounded-lg border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </div>
      </div>

      {/* Categories */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => setCategoriesOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3.5 text-left"
        >
          <span className="font-heading text-sm font-bold text-slate-900">
            Categories
          </span>
          <ChevronDown
            className={`h-4 w-4 text-slate-500 transition-transform ${categoriesOpen ? '' : '-rotate-90'}`}
          />
        </button>
        {categoriesOpen && (
          <ul className="border-t border-slate-100 px-2 pb-2 pt-1">
            {PRODUCT_CATEGORIES.map((cat) => {
              const active = selectedCategory === cat.value;
              return (
                <li key={cat.value}>
                  <label
                    className={`flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-sm transition-colors ${
                      active ? 'bg-teal-50 text-teal-700' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <input
                        type="checkbox"
                        checked={active}
                        onChange={() => {
                          onCategoryChange(active ? '' : cat.value);
                          onSubcategoryChange('');
                        }}
                        className="sr-only"
                      />
                      <span
                        className={`flex h-4 w-4 items-center justify-center rounded border-2 ${
                          active ? 'border-teal-600 bg-teal-600' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {active && (
                          <svg
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={3}
                            className="h-2.5 w-2.5 text-white"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        )}
                      </span>
                      <span className="font-medium">{cat.label}</span>
                    </span>
                    <span className="font-mono text-[11px] text-slate-400">
                      {cat.productCount}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Subcategories — visible when a category is selected */}
      {selectedCategory && subcategories.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white">
          <button
            type="button"
            onClick={() => setSubcategoriesOpen((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3.5 text-left"
          >
            <span className="font-heading text-sm font-bold text-slate-900">
              Subcategories
            </span>
            <ChevronDown
              className={`h-4 w-4 text-slate-500 transition-transform ${subcategoriesOpen ? '' : '-rotate-90'}`}
            />
          </button>
          {subcategoriesOpen && (
            <ul className="max-h-80 overflow-y-auto border-t border-slate-100 px-2 pb-2 pt-1">
              {subcategories.map((sub) => {
                const active = selectedSubcategory === sub.slug;
                return (
                  <li key={sub.slug}>
                    <label
                      className={`flex cursor-pointer items-center justify-between rounded-lg px-2.5 py-2 text-sm transition-colors ${
                        active
                          ? 'bg-teal-50 text-teal-700'
                          : 'text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <span className="flex items-center gap-2.5">
                        <input
                          type="checkbox"
                          checked={active}
                          onChange={() =>
                            onSubcategoryChange(active ? '' : sub.slug)
                          }
                          className="sr-only"
                        />
                        <span
                          className={`flex h-4 w-4 items-center justify-center rounded border-2 ${
                            active
                              ? 'border-teal-600 bg-teal-600'
                              : 'border-slate-300 bg-white'
                          }`}
                        >
                          {active && (
                            <svg
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={3}
                              className="h-2.5 w-2.5 text-white"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          )}
                        </span>
                        <span className="font-medium">{sub.label}</span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {/* Brands — placeholder accordion (empty list, future wiring) */}
      <div className="rounded-xl border border-slate-200 bg-white">
        <button
          type="button"
          onClick={() => setBrandsOpen((v) => !v)}
          className="flex w-full items-center justify-between px-4 py-3.5 text-left"
        >
          <span className="font-heading text-sm font-bold text-slate-900">
            Brands
          </span>
          <ChevronDown
            className={`h-4 w-4 text-slate-500 transition-transform ${brandsOpen ? '' : '-rotate-90'}`}
          />
        </button>
        {brandsOpen && (
          <div className="border-t border-slate-100 p-4 text-xs text-slate-400">
            Brand filters are coming soon.
          </div>
        )}
      </div>
    </aside>
  );
}
