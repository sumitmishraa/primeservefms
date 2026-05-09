'use client';

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface CustomSelectOption {
  value: string;
  label: string;
  description?: string;
  rightLabel?: string;
  badge?: string;
  disabled?: boolean;
}

interface CustomSelectProps {
  value: string;
  options: CustomSelectOption[];
  onChange: (value: string) => void;
  placeholder?: string;
  ariaLabel?: string;
  className?: string;
  buttonClassName?: string;
  menuClassName?: string;
  disabled?: boolean;
}

function joinClasses(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function nextEnabledIndex(
  options: CustomSelectOption[],
  from: number,
  direction: 1 | -1,
) {
  if (options.length === 0) return -1;

  for (let step = 1; step <= options.length; step += 1) {
    const idx = (from + step * direction + options.length) % options.length;
    if (!options[idx]?.disabled) return idx;
  }
  return -1;
}

export default function CustomSelect({
  value,
  options,
  onChange,
  placeholder = 'Select',
  ariaLabel,
  className,
  buttonClassName,
  menuClassName,
  disabled = false,
}: CustomSelectProps) {
  const generatedId = useId();
  const listboxId = `${generatedId}-listbox`;
  const rootRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);

  const selectedIndex = useMemo(
    () => options.findIndex((option) => option.value === value),
    [options, value],
  );
  const selected = selectedIndex >= 0 ? options[selectedIndex] : null;

  const firstEnabledIndex = useMemo(
    () => options.findIndex((option) => !option.disabled),
    [options],
  );

  const [activeIndex, setActiveIndex] = useState(
    selectedIndex >= 0 ? selectedIndex : firstEnabledIndex,
  );

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    optionRefs.current[activeIndex]?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex, open]);

  const selectedOrFirstIndex = selectedIndex >= 0 ? selectedIndex : firstEnabledIndex;

  const choose = (option: CustomSelectOption) => {
    if (option.disabled) return;
    onChange(option.value);
    setOpen(false);
  };

  const onTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (disabled) return;

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      setActiveIndex((curr) => {
        const start = curr >= 0 ? curr : selectedIndex >= 0 ? selectedIndex : firstEnabledIndex;
        const next = nextEnabledIndex(options, start, event.key === 'ArrowDown' ? 1 : -1);
        return next >= 0 ? next : start;
      });
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setOpen((curr) => !curr);
    }
  };

  const onOptionKeyDown = (
    event: KeyboardEvent<HTMLButtonElement>,
    option: CustomSelectOption,
  ) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      setOpen(false);
      return;
    }

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActiveIndex((curr) => {
        const next = nextEnabledIndex(options, curr, event.key === 'ArrowDown' ? 1 : -1);
        return next >= 0 ? next : curr;
      });
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      choose(option);
    }
  };

  return (
    <div ref={rootRef} className={joinClasses('relative', className)}>
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-controls={listboxId}
        aria-expanded={open}
        onClick={() => {
          setActiveIndex(selectedOrFirstIndex);
          setOpen((curr) => !curr);
        }}
        onKeyDown={onTriggerKeyDown}
        className={joinClasses(
          'flex min-h-11 w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-left text-sm font-semibold text-slate-800 shadow-sm transition',
          'hover:border-teal-300 hover:bg-teal-50/30 focus:border-teal-500 focus:outline-none focus:ring-4 focus:ring-teal-500/15',
          'disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400 disabled:shadow-none',
          open && 'border-teal-500 ring-4 ring-teal-500/15',
          buttonClassName,
        )}
      >
        <span className="min-w-0 flex-1">
          <span className={joinClasses('block truncate', !selected && 'text-slate-400')}>
            {selected?.label ?? placeholder}
          </span>
          {selected?.description && (
            <span className="mt-0.5 block truncate text-xs font-medium text-slate-500">
              {selected.description}
            </span>
          )}
        </span>
        {selected?.rightLabel && (
          <span className="shrink-0 font-heading text-sm font-bold text-teal-700">
            {selected.rightLabel}
          </span>
        )}
        <ChevronDown
          className={joinClasses(
            'h-4 w-4 shrink-0 text-slate-400 transition-transform',
            open && 'rotate-180 text-teal-600',
          )}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-label={ariaLabel}
          className={joinClasses(
            'absolute left-0 right-0 z-[70] mt-2 max-h-[min(20rem,calc(100vh-9rem))] overflow-y-auto rounded-xl border border-teal-200 bg-white p-1.5 shadow-2xl shadow-slate-900/15 ring-1 ring-teal-500/10',
            menuClassName,
          )}
        >
          {options.map((option, idx) => {
            const isSelected = option.value === value;
            const isActive = idx === activeIndex;

            return (
              <button
                key={option.value}
                ref={(node) => {
                  optionRefs.current[idx] = node;
                }}
                type="button"
                role="option"
                aria-selected={isSelected}
                disabled={option.disabled}
                tabIndex={isActive ? 0 : -1}
                onMouseEnter={() => {
                  if (!option.disabled) setActiveIndex(idx);
                }}
                onClick={() => choose(option)}
                onKeyDown={(event) => onOptionKeyDown(event, option)}
                className={joinClasses(
                  'flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm transition',
                  isSelected
                    ? 'bg-teal-50 text-teal-800'
                    : isActive
                      ? 'bg-slate-100 text-slate-900'
                      : 'text-slate-700 hover:bg-slate-50',
                  option.disabled && 'cursor-not-allowed bg-slate-50 text-slate-400 opacity-70',
                )}
              >
                <span
                  className={joinClasses(
                    'flex h-5 w-5 shrink-0 items-center justify-center rounded-full border',
                    isSelected
                      ? 'border-teal-500 bg-teal-500 text-white'
                      : 'border-slate-200 bg-white text-transparent',
                  )}
                  aria-hidden="true"
                >
                  <Check className="h-3 w-3" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{option.label}</span>
                  {option.description && (
                    <span className="mt-0.5 block truncate text-xs font-medium text-slate-500">
                      {option.description}
                    </span>
                  )}
                </span>
                {option.badge && (
                  <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-700">
                    {option.badge}
                  </span>
                )}
                {option.rightLabel && (
                  <span className="shrink-0 font-heading text-sm font-bold text-teal-700">
                    {option.rightLabel}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
