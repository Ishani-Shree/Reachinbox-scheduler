import { ChevronLeft, ChevronRight } from 'lucide-react';
import { IconButton } from '../ui/Button';

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
}) {
  if (total <= pageSize) return null;
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(total, page * pageSize);
  return (
    <div className="flex items-center justify-end gap-2 px-6 py-3 text-sm text-ink-500">
      <span>
        {from.toLocaleString()}–{to.toLocaleString()} of {total.toLocaleString()}
      </span>
      <IconButton
        label="Previous page"
        disabled={page === 1}
        onClick={() => onPage(page - 1)}
        className="disabled:opacity-40"
      >
        <ChevronLeft size={18} />
      </IconButton>
      <IconButton
        label="Next page"
        disabled={to >= total}
        onClick={() => onPage(page + 1)}
        className="disabled:opacity-40"
      >
        <ChevronRight size={18} />
      </IconButton>
    </div>
  );
}
