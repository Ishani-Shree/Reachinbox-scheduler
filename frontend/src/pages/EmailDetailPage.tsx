import { AlertTriangle, ArrowLeft, ExternalLink, Timer } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { emailsApi } from '../api';
import { errorMessage } from '../api/client';
import { Avatar } from '../components/ui/Avatar';
import { Button, IconButton } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { FullPageSpinner } from '../components/ui/Spinner';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useQuery } from '../hooks/useQuery';
import { formatDateTime } from '../utils/format';

export function EmailDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { data: email, error, loading } = useQuery(() => emailsApi.get(id), [id], { pollMs: 5000 });

  if (loading && !email) return <FullPageSpinner />;
  if (!email) {
    return (
      <EmptyState
        icon={<AlertTriangle size={24} />}
        title="Email not found"
        description={error ? errorMessage(error) : undefined}
        action={<Button onClick={() => navigate(-1)}>Go back</Button>}
      />
    );
  }

  const done = email.status === 'sent' || email.status === 'failed';
  return (
    <div className="flex-1 overflow-y-auto">
      <header className="flex items-center gap-3 border-b border-ink-100 px-6 py-4">
        <IconButton label="Back" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </IconButton>
        <h1 className="min-w-0 flex-1 truncate text-lg font-semibold">{email.subject}</h1>
        <StatusBadge email={email} />
      </header>

      <div className="mx-auto max-w-3xl px-6 py-6">
        <div className="mb-6 flex items-start gap-3">
          <Avatar name={email.sender.name} />
          <div className="min-w-0 flex-1">
            <p className="text-sm">
              <span className="font-semibold">{email.sender.name}</span>{' '}
              <span className="text-ink-500">&lt;{email.sender.email}&gt;</span>
            </p>
            <p className="text-sm text-ink-500">to: {email.toEmail}</p>
          </div>
          <p className="shrink-0 text-right text-xs text-ink-500">
            {done && email.sentAt
              ? `Sent ${formatDateTime(email.sentAt)}`
              : `Scheduled ${formatDateTime(email.scheduledAt)}`}
          </p>
        </div>

        {email.deferredCount > 0 && !done && (
          <div className="mb-4 flex items-start gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            <Timer size={16} className="mt-0.5 shrink-0" />
            Rescheduled {email.deferredCount}× because the hourly limit was reached. Originally scheduled for{' '}
            {formatDateTime(email.originalScheduledAt)}.
          </div>
        )}
        {email.status === 'failed' && email.error && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <strong>Delivery failed:</strong> {email.error}
          </div>
        )}

        <div className="whitespace-pre-wrap rounded-xl border border-ink-100 p-5 text-sm leading-relaxed">
          {email.body}
        </div>

        {email.previewUrl && (
          <a
            href={email.previewUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-brand-600 hover:underline"
          >
            View delivered message on Ethereal <ExternalLink size={14} />
          </a>
        )}
      </div>
    </div>
  );
}
