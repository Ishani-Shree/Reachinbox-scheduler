import { AlertCircle, Clock, Loader2 } from 'lucide-react';
import type { Email } from '../../types';
import { cn } from '../../utils/cn';
import { formatPillTime } from '../../utils/format';

const base = 'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-[3px] text-xs';

/** List pill: orange send time for scheduled emails, grey "Sent", red "Failed" (as in the Figma). */
export function StatusBadge({
  email,
  className,
}: {
  email: Pick<Email, 'status' | 'scheduledAt'>;
  className?: string;
}) {
  switch (email.status) {
    case 'scheduled':
      return (
        <span className={cn(base, 'border-pending-200 bg-pending-50 font-medium text-pending-700', className)}>
          <Clock size={12} strokeWidth={2.25} />
          {formatPillTime(email.scheduledAt)}
        </span>
      );
    case 'sending':
      return (
        <span className={cn(base, 'border-sky-200 bg-sky-50 font-medium text-sky-700', className)}>
          <Loader2 size={12} className="animate-spin" />
          Sending
        </span>
      );
    case 'sent':
      return <span className={cn(base, 'border-ink-200 bg-ink-100 text-ink-700', className)}>Sent</span>;
    case 'failed':
      return (
        <span className={cn(base, 'border-red-200 bg-red-50 font-medium text-red-600', className)}>
          <AlertCircle size={12} />
          Failed
        </span>
      );
  }
}
