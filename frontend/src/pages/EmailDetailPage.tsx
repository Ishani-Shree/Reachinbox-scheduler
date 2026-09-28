import DOMPurify from 'dompurify';
import { AlertTriangle, ArrowLeft, ChevronDown, ExternalLink, FileText, Star, Timer } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { attachmentUrl, emailsApi } from '../api';
import { errorMessage } from '../api/client';
import { Avatar } from '../components/ui/Avatar';
import { Button, IconButton } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { FullPageSpinner } from '../components/ui/Spinner';
import { StatusBadge } from '../components/ui/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { useQuery } from '../hooks/useQuery';
import type { AttachmentMeta } from '../types';
import { formatBytes, formatDateTime, formatShortDateTime } from '../utils/format';

function AttachmentCard({ file }: { file: AttachmentMeta }) {
  const isImage = file.contentType.startsWith('image/');
  return (
    <a
      href={attachmentUrl(file.id)}
      target="_blank"
      rel="noreferrer"
      className="w-36 overflow-hidden rounded-lg bg-ink-50 transition-shadow hover:shadow-pop"
    >
      {isImage ? (
        <img src={attachmentUrl(file.id)} alt={file.filename} className="h-20 w-full object-cover" />
      ) : (
        <div className="flex h-20 items-center justify-center text-ink-400">
          <FileText size={28} />
        </div>
      )}
      <div className="px-2 py-1.5">
        <p className="truncate text-xs text-ink-900">{file.filename}</p>
        <p className="text-[10px] text-ink-400">{formatBytes(file.size)}</p>
      </div>
    </a>
  );
}

export function EmailDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: email, error, loading } = useQuery(() => emailsApi.get(id), [id], { pollMs: 5000 });
  const html = useMemo(() => (email ? DOMPurify.sanitize(email.body) : ''), [email]);

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
      <header className="flex items-center gap-2 px-4 py-3">
        <IconButton label="Back" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} className="text-ink-900" />
        </IconButton>
        <h1 className="min-w-0 flex-1 truncate text-xl text-ink-900">{email.subject}</h1>
        <Star size={17} className="mx-2 shrink-0 text-ink-300" />
        {user && (
          <span className="flex items-center border-l border-ink-200 pl-3">
            <Avatar name={user.name} src={user.avatarUrl} size="sm" />
          </span>
        )}
      </header>

      <div className="mx-auto max-w-3xl px-6 pb-12 pt-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-sm font-semibold text-white">
            {email.sender.name[0]?.toUpperCase()}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">
              <span className="font-semibold text-ink-900">{email.sender.name}</span>{' '}
              <span className="text-xs text-ink-500">&lt;{email.sender.email}&gt;</span>
            </p>
            <p className="flex items-center gap-1 text-xs text-ink-500">
              to {email.toEmail} <ChevronDown size={12} />
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1.5">
            <span className="text-xs text-ink-500">
              {formatShortDateTime(done && email.sentAt ? email.sentAt : email.scheduledAt)}
            </span>
            <StatusBadge email={email} />
          </div>
        </div>

        <div className="pl-12">
          {email.deferredCount > 0 && !done && (
            <p className="mt-4 flex items-start gap-2 rounded-lg bg-pending-50 px-3 py-2 text-xs text-pending-700">
              <Timer size={14} className="mt-px shrink-0" />
              Rescheduled {email.deferredCount}× because the hourly limit was reached (originally{' '}
              {formatDateTime(email.originalScheduledAt)}).
            </p>
          )}
          {email.status === 'failed' && email.error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">
              <strong>Delivery failed:</strong> {email.error}
            </p>
          )}

          <div
            className="email-body mt-5 text-sm leading-relaxed text-ink-900"
            dangerouslySetInnerHTML={{ __html: html }}
          />

          {email.attachments.length > 0 && (
            <div className="mt-6 flex flex-wrap gap-3">
              {email.attachments.map((file) => (
                <AttachmentCard key={file.id} file={file} />
              ))}
            </div>
          )}

          {email.previewUrl && (
            <a
              href={email.previewUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-6 inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:underline"
            >
              View delivered message on Ethereal <ExternalLink size={12} />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
