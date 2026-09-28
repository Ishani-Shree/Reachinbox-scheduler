import { Star, Timer } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Email } from '../../types';
import { formatPillTime } from '../../utils/format';
import { StatusBadge } from '../ui/StatusBadge';

export function EmailListItem({ email }: { email: Email }) {
  const preview = email.body.replace(/\s+/g, ' ').slice(0, 160);
  const time = email.sentAt ?? email.scheduledAt;

  return (
    <li>
      <Link
        to={`/emails/${email.id}`}
        className="group flex items-center gap-4 border-b border-ink-100 px-6 py-4 transition-colors hover:bg-ink-50"
      >
        <div className="w-56 shrink-0 truncate text-sm">
          <span className="text-ink-500">To: </span>
          <span className="font-semibold text-ink-900">{email.toEmail}</span>
        </div>

        <StatusBadge email={email} />

        <div className="min-w-0 flex-1 truncate text-sm">
          <span className="font-semibold text-ink-900">{email.subject}</span>
          <span className="text-ink-500"> - {preview}</span>
        </div>

        {email.status === 'scheduled' && email.deferredCount > 0 && (
          <span
            title="Rescheduled because the hourly limit was reached"
            className="hidden shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-700 lg:inline-flex"
          >
            <Timer size={12} /> Rate limited
          </span>
        )}

        {email.sentAt && <span className="hidden shrink-0 text-xs text-ink-500 lg:inline">{formatPillTime(time)}</span>}

        <Star size={18} className="shrink-0 text-ink-200 group-hover:text-ink-400" />
      </Link>
    </li>
  );
}

export function EmailListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <ul aria-busy="true" aria-label="Loading emails">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex items-center gap-4 border-b border-ink-100 px-6 py-4">
          <div className="h-4 w-48 animate-pulse rounded bg-ink-100" />
          <div className="h-6 w-28 animate-pulse rounded-full bg-ink-100" />
          <div className="h-4 flex-1 animate-pulse rounded bg-ink-100" />
        </li>
      ))}
    </ul>
  );
}
