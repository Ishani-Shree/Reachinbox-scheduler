import { AlertCircle, CheckCircle2, Clock, Loader2 } from 'lucide-react';
import type { Email } from '../../types';
import { cn } from '../../utils/cn';
import { formatPillTime } from '../../utils/format';

const styles = {
  scheduled: 'bg-orange-50 text-orange-600',
  sending: 'bg-sky-50 text-sky-600',
  sent: 'bg-ink-100 text-ink-700',
  failed: 'bg-red-50 text-red-600',
} as const;

/** Status pill. Scheduled emails show their send time, like the Figma list. */
export function StatusBadge({
  email,
  className,
}: {
  email: Pick<Email, 'status' | 'scheduledAt' | 'sentAt'>;
  className?: string;
}) {
  const content = {
    scheduled: { icon: <Clock size={13} />, label: formatPillTime(email.scheduledAt) },
    sending: { icon: <Loader2 size={13} className="animate-spin" />, label: 'Sending' },
    sent: { icon: <CheckCircle2 size={13} />, label: 'Sent' },
    failed: { icon: <AlertCircle size={13} />, label: 'Failed' },
  }[email.status];

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium',
        styles[email.status],
        className,
      )}
    >
      {content.icon}
      {content.label}
    </span>
  );
}
