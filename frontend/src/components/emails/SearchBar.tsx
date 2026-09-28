import { Check, Filter, RefreshCw, Search, X } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { useDismiss } from '../../hooks/useDismiss';
import type { EmailFilter } from '../../types';
import { cn } from '../../utils/cn';
import { IconButton } from '../ui/Button';

export interface FilterOption {
  value: EmailFilter;
  label: string;
}

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  onRefresh: () => void;
  refreshing?: boolean;
  filter: EmailFilter;
  filterOptions: FilterOption[];
  onFilterChange: (f: EmailFilter) => void;
}

export function SearchBar({
  value,
  onChange,
  onRefresh,
  refreshing,
  filter,
  filterOptions,
  onFilterChange,
}: SearchBarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setMenuOpen(false), []);
  useDismiss(menuRef, close, menuOpen);

  return (
    <div className="flex items-center gap-2 px-4 pb-2 pt-4">
      <label className="flex h-9 flex-1 items-center gap-2 rounded-full bg-ink-50 px-4 focus-within:ring-2 focus-within:ring-brand-100">
        <Search size={15} className="shrink-0 text-ink-400" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search"
          className="h-full min-w-0 flex-1 border-0 bg-transparent p-0 text-sm placeholder:text-ink-400 focus:outline-none focus:ring-0"
        />
        {value && (
          <button onClick={() => onChange('')} aria-label="Clear search" className="text-ink-400 hover:text-ink-700">
            <X size={15} />
          </button>
        )}
      </label>

      <div ref={menuRef} className="relative">
        <IconButton
          label="Filter"
          onClick={() => setMenuOpen((o) => !o)}
          className={cn(filter !== 'all' && 'text-brand-600')}
        >
          <Filter size={16} />
        </IconButton>
        {menuOpen && (
          <div className="absolute right-0 top-full z-20 mt-1 w-40 rounded-xl border border-ink-100 bg-white p-1 shadow-pop">
            {filterOptions.map((o) => (
              <button
                key={o.value}
                onClick={() => {
                  onFilterChange(o.value);
                  close();
                }}
                className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm text-ink-700 hover:bg-ink-50"
              >
                {o.label}
                {filter === o.value && <Check size={14} className="text-brand-600" />}
              </button>
            ))}
          </div>
        )}
      </div>

      <IconButton label="Refresh" onClick={onRefresh}>
        <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
      </IconButton>
    </div>
  );
}
