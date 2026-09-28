import { RefreshCw, Search, X } from 'lucide-react';
import { IconButton } from '../ui/Button';

interface SearchBarProps {
  value: string;
  onChange: (v: string) => void;
  onRefresh: () => void;
  refreshing?: boolean;
}

export function SearchBar({ value, onChange, onRefresh, refreshing }: SearchBarProps) {
  return (
    <div className="flex items-center gap-2 px-6 py-4">
      <label className="flex h-10 flex-1 items-center gap-2 rounded-full bg-ink-50 px-4 focus-within:ring-2 focus-within:ring-brand-200">
        <Search size={16} className="shrink-0 text-ink-400" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search by recipient, subject or content"
          className="h-full min-w-0 flex-1 border-0 bg-transparent text-sm placeholder:text-ink-400 focus:outline-none focus:ring-0"
        />
        {value && (
          <button onClick={() => onChange('')} aria-label="Clear search" className="text-ink-400 hover:text-ink-700">
            <X size={16} />
          </button>
        )}
      </label>
      <IconButton label="Refresh" onClick={onRefresh}>
        <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
      </IconButton>
    </div>
  );
}
