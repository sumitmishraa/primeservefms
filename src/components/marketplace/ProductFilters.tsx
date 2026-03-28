/**
 * ProductFilters — search + category/subcategory pill bar for the marketplace.
 *
 * Renders:
 *   1. Search input with icon
 *   2. Horizontal scrollable category pills ("All" + 6 categories)
 *   3. Subcategory pills (visible only when a category is selected)
 *   4. "Clear Filters" button when any filter is active
 *
 * This is a pure controlled component — all state lives in the parent page.
 *
 * Used in: src/app/marketplace/page.tsx
 */

'use client';

import { Search, X } from 'lucide-react';
import {
  PRODUCT_CATEGORIES,
  getSubcategoriesByCategory,
} from '@/lib/constants/categories';

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface ProductFiltersProps {
  selectedCategory: string;
  selectedSubcategory: string;
  searchQuery: string;
  onCategoryChange: (cat: string) => void;
  onSubcategoryChange: (sub: string) => void;
  onSearchChange: (q: string) => void;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Filter bar used at the top of the marketplace product grid.
 * Calls parent callbacks on every change — no internal state.
 *
 * @param selectedCategory - Currently active category value ('' = All)
 * @param selectedSubcategory - Currently active subcategory slug ('' = All)
 * @param searchQuery - Current search string
 * @param onCategoryChange - Called when a category pill is clicked
 * @param onSubcategoryChange - Called when a subcategory pill is clicked
 * @param onSearchChange - Called on every keystroke in the search input
 */
export default function ProductFilters({
  selectedCategory,
  selectedSubcategory,
  searchQuery,
  onCategoryChange,
  onSubcategoryChange,
  onSearchChange,
}: ProductFiltersProps) {
  const subcategories = getSubcategoriesByCategory(selectedCategory);
  const hasActiveFilter =
    !!selectedCategory || !!selectedSubcategory || !!searchQuery;

  const handleClearFilters = () => {
    onCategoryChange('');
    onSubcategoryChange('');
    onSearchChange('');
  };

  return (
    <div className="space-y-4">
      {/* Search row */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
            aria-hidden="true"
          />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search products, brands, categories…"
            className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-4 text-sm text-slate-900 placeholder:text-slate-400 focus:border-teal-500 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
          />
        </div>

        {hasActiveFilter && (
          <button
            type="button"
            onClick={handleClearFilters}
            className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-600 transition-colors hover:bg-slate-50"
          >
            <X className="h-3.5 w-3.5" aria-hidden="true" />
            Clear
          </button>
        )}
      </div>

      {/* Category pills */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {/* "All" pill */}
        <button
          type="button"
          onClick={() => {
            onCategoryChange('');
            onSubcategoryChange('');
          }}
          className={[
            'shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
            !selectedCategory
              ? 'border-teal-600 bg-teal-600 text-white'
              : 'border-slate-300 bg-white text-slate-600 hover:border-teal-400 hover:text-teal-700',
          ].join(' ')}
        >
          All
        </button>

        {/* Category pills */}
        {PRODUCT_CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat.value;
          return (
            <button
              key={cat.value}
              type="button"
              onClick={() => {
                onCategoryChange(cat.value);
                onSubcategoryChange('');
              }}
              className={[
                'shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors',
                isActive
                  ? 'border-teal-600 bg-teal-600 text-white'
                  : 'border-slate-300 bg-white text-slate-600 hover:border-teal-400 hover:text-teal-700',
              ].join(' ')}
            >
              {cat.label}
            </button>
          );
        })}
      </div>

      {/* Subcategory pills — only shown when a category is selected */}
      {selectedCategory && subcategories.length > 0 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {/* "All [Category]" option */}
          <button
            type="button"
            onClick={() => onSubcategoryChange('')}
            className={[
              'shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
              !selectedSubcategory
                ? 'border-teal-500 bg-teal-50 text-teal-700'
                : 'border-slate-200 bg-white text-slate-500 hover:border-teal-300 hover:text-teal-600',
            ].join(' ')}
          >
            All
          </button>

          {subcategories.map((sub) => {
            const isActive = selectedSubcategory === sub.slug;
            return (
              <button
                key={sub.slug}
                type="button"
                onClick={() => onSubcategoryChange(sub.slug)}
                className={[
                  'shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                  isActive
                    ? 'border-teal-500 bg-teal-50 text-teal-700'
                    : 'border-slate-200 bg-white text-slate-500 hover:border-teal-300 hover:text-teal-600',
                ].join(' ')}
              >
                {sub.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
