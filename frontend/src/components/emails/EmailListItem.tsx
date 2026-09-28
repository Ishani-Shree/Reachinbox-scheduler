import { Star, Timer } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Email } from '../../types';
import { StatusBadge } from '../ui/StatusBadge';

export function EmailListItem({ email }: { email: Email }) {
  return (
    <li>
      <Link
        to={`/emails/${email.id}`}
        className="flex h-14 items-center gap-4 border-b border-ink-100 px-4 text-sm transition-colors hover:bg-ink-50"
      >
        <span className="w-32 shrink-0 truncate text-ink-900 sm:w-52">To: {email.toEmail}</span>

        <StatusBadge email={email} />

        <span className="min-w-0 flex-1 truncate">
          <span className="font-medium text-ink-900">{email.subject}</span>
          {email.preview && <span className="text-ink-400"> - {email.preview}</span>}
        </span>

        {email.status === 'scheduled' && email.deferredCount > 0 && (
          <span
            title="Rescheduled because the hourly limit was reached"
            className="hidden shrink-0 items-center gap-1 text-xs text-pending-700 lg:inline-flex"
          >
            <Timer size={13} /> Rate limited
          </span>
        )}

        <Star size={16} className="shrink-0 text-ink-300" />
      </Link>
    </li>
  );
}

export function EmailListSkeleton({ rows = 8 }: { rows?: number }) {
  return (
    <ul aria-busy="true" aria-label="Loading emails">
      {Array.from({ length: rows }, (_, i) => (
        <li key={i} className="flex h-14 items-center gap-4 border-b border-ink-100 px-4">
          <div className="h-3.5 w-40 animate-pulse rounded bg-ink-100" />
          <div className="h-5 w-24 animate-pulse rounded-full bg-ink-100" />
          <div className="h-3.5 flex-1 animate-pulse rounded bg-ink-100" />
        </li>
      ))}
    </ul>
  );
}
