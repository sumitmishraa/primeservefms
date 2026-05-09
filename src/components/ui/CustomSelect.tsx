'use client';

import { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Check, ChevronDown } from 'lucide-react';

export interface CustomSelectOption {
  value: string;
  label: ReactNode;
  disabled?: boolean;
}

interface CustomSelectProps {
  id?: string;
  name?: string;
  value: string;
  options: CustomSelectOption[];
  onValueChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  className?: string;
  menuClassName?: string;
  ariaLabel?: string;
}

export default function CustomSelect({
  id,
  name,
  value,
  options,
  onValueChange,
  placeholder = 'Select an option',
  disabled = false,
  required = false,
  className = '',
  menuClassName = '',
  ariaLabel,
}: CustomSelectProps) {
  const generatedId = useId();
  const buttonId = id ?? generatedId;
  const listboxId = `${buttonId}-listbox`;
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const selectedIndex = useMemo(
    () => options.findIndex((option) => option.value === value),
    [options, value],
  );
  const [activeIndex, setActiveIndex] = useState(selectedIndex >= 0 ? selectedIndex : 0);
  const selectedOption = selectedIndex >= 0 ? options[selectedIndex] : null;

  useEffect(() => {
    if (!open) return;

    const onPointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const enabledOptions = options
    .map((option, index) => ({ option, index }))
    .filter(({ option }) => !option.disabled);

  const openMenu = () => {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  };

  const moveActive = (direction: 1 | -1) => {
    if (enabledOptions.length === 0) return;
    const currentEnabledIndex = enabledOptions.findIndex(({ index }) => index === activeIndex);
    const nextEnabledIndex =
      currentEnabledIndex === -1
        ? 0
        : (currentEnabledIndex + direction + enabledOptions.length) % enabledOptions.length;
    setActiveIndex(enabledOptions[nextEnabledIndex].index);
  };

  const choose = (option: CustomSelectOption) => {
    if (option.disabled) return;
    onValueChange(option.value);
    setOpen(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      {name && <input type="hidden" name={name} value={value} required={required} />}
      <button
        id={buttonId}
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        disabled={disabled}
        onClick={() => {
          if (open) setOpen(false);
          else openMenu();
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown') {
            event.preventDefault();
            if (!open) openMenu();
            else moveActive(1);
          } else if (event.key === 'ArrowUp') {
            event.preventDefault();
            if (!open) openMenu();
            else moveActive(-1);
          } else if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            if (open && options[activeIndex]) choose(options[activeIndex]);
            else openMenu();
          } else if (event.key === 'Escape') {
            setOpen(false);
          }
        }}
        className={[
          'flex min-h-10 w-full items-center justify-between gap-3 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm font-medium text-brand-navy shadow-sm transition-colors',
          'hover:border-[#14B8A6] focus:border-[#14B8A6] focus:outline-none focus:ring-2 focus:ring-[#14B8A6]/20',
          'disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400 disabled:opacity-70',
          className,
        ].join(' ')}
      >
        <span className={`min-w-0 flex-1 truncate ${selectedOption ? '' : 'text-slate-400'}`}>
          {selectedOption?.label ?? placeholder}
        </span>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-labelledby={buttonId}
          className={[
            'absolute left-0 right-0 z-50 mt-2 max-h-64 overflow-auto rounded-xl border border-teal-100 bg-white p-1 shadow-xl shadow-slate-900/10 ring-1 ring-slate-900/5',
            menuClassName,
          ].join(' ')}
        >
          {options.map((option, index) => {
            const selected = option.value === value;
            const active = index === activeIndex;
            return (
              <button
                key={`${option.value}-${index}`}
                type="button"
                role="option"
                aria-selected={selected}
                disabled={option.disabled}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(option)}
                className={[
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm font-medium text-brand-navy transition-colors',
                  selected
                    ? 'bg-brand-navy text-white shadow-sm'
                    : active
                      ? 'bg-teal-100 text-brand-navy'
                      : 'hover:bg-teal-100 hover:text-brand-navy',
                  option.disabled ? 'cursor-not-allowed bg-transparent text-slate-400 hover:bg-transparent hover:text-slate-400' : '',
                ].join(' ')}
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {selected && <Check className="h-4 w-4 shrink-0" aria-hidden="true" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
