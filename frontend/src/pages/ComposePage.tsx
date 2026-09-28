import { ArrowLeft, ChevronDown, Clock } from 'lucide-react';
import { useCallback, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { campaignsApi, sendersApi } from '../api';
import { errorMessage } from '../api/client';
import { AttachButton, AttachmentList, fileToBase64 } from '../components/compose/Attachments';
import { RecipientsField } from '../components/compose/RecipientsField';
import { RichTextEditor } from '../components/compose/RichTextEditor';
import { SendLaterPopover } from '../components/compose/SendLaterPopover';
import { IconButton } from '../components/ui/Button';
import { FieldRow, NumberBox, TextInput } from '../components/ui/Field';
import { useStats } from '../context/StatsContext';
import { useQuery } from '../hooks/useQuery';
import { pluralize } from '../utils/format';

interface FormState {
  senderId: string;
  recipients: string[];
  subject: string;
  /** Editor HTML */
  body: string;
  delayBetweenSeconds: number;
  hourlyLimit: number;
}

const initialForm: FormState = {
  senderId: '',
  recipients: [],
  subject: '',
  body: '',
  delayBetweenSeconds: NaN,
  hourlyLimit: NaN,
};

const bodyIsEmpty = (html: string) => !html.replace(/<[^>]*>|&nbsp;/g, '').trim();

function validate(f: FormState): string | null {
  if (!f.senderId) return 'Choose a sender';
  if (!f.recipients.length) return 'Add at least one recipient or upload a lead list';
  if (!f.subject.trim()) return 'Subject is required';
  if (bodyIsEmpty(f.body)) return 'Email body is required';
  if (!Number.isNaN(f.delayBetweenSeconds) && (!Number.isInteger(f.delayBetweenSeconds) || f.delayBetweenSeconds < 0)) {
    return 'Delay must be 0 or more seconds';
  }
  if (!Number.isInteger(f.hourlyLimit) || f.hourlyLimit < 1) return 'Set an hourly limit of at least 1';
  return null;
}

export function ComposePage() {
  const navigate = useNavigate();
  const { refreshStats } = useStats();
  const [form, setForm] = useState<FormState>(initialForm);
  const [files, setFiles] = useState<File[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  // One key per compose session: a double-click or network retry cannot schedule twice.
  const idempotencyKey = useRef(crypto.randomUUID());

  const { data: senders, loading: sendersLoading } = useQuery(async () => {
    const list = await sendersApi.list();
    setForm((f) => (f.senderId ? f : { ...f, senderId: list[0]?.id ?? '' }));
    return list;
  }, []);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => setForm((f) => ({ ...f, [key]: value }));
  const onBodyChange = useCallback((html: string) => setForm((f) => ({ ...f, body: html })), []);
  const closePicker = useCallback(() => setPickerOpen(false), []);

  const estimate = useMemo(() => {
    const n = form.recipients.length;
    if (n < 2 || !(form.hourlyLimit > 0)) return null;
    const delay = Number.isNaN(form.delayBetweenSeconds) ? 0 : form.delayBetweenSeconds;
    const hours = Math.max(Math.ceil(n / form.hourlyLimit), Math.ceil(((n - 1) * delay) / 3600));
    return hours > 1 ? `≈ ${pluralize(hours, 'hour')} to send all` : null;
  }, [form.recipients.length, form.hourlyLimit, form.delayBetweenSeconds]);

  const openPicker = () => {
    const problem = validate(form);
    if (problem) return toast.error(problem);
    setPickerOpen((o) => !o);
  };

  const schedule = async (startAt: Date) => {
    setSubmitting(true);
    try {
      const attachments = await Promise.all(
        files.map(async (f) => ({
          filename: f.name,
          contentType: f.type || 'application/octet-stream',
          data: await fileToBase64(f),
        })),
      );
      const res = await campaignsApi.create(
        {
          senderId: form.senderId,
          recipients: form.recipients,
          subject: form.subject.trim(),
          body: form.body,
          startAt: startAt.toISOString(),
          delayBetweenSeconds: Number.isNaN(form.delayBetweenSeconds) ? 0 : form.delayBetweenSeconds,
          hourlyLimit: form.hourlyLimit,
          attachments,
        },
        idempotencyKey.current,
      );
      toast.success(
        res.duplicate ? 'This campaign was already scheduled' : `${pluralize(res.totalRecipients, 'email')} scheduled`,
      );
      void refreshStats();
      navigate('/scheduled');
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-0 flex-1 flex-col overflow-y-auto">
      <header className="flex items-center gap-2 px-4 py-3">
        <IconButton label="Back" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} className="text-ink-900" />
        </IconButton>
        <h1 className="flex-1 text-xl text-ink-900">Compose New Email</h1>
        <AttachButton files={files} onChange={setFiles} />
        <IconButton label="Schedule" onClick={openPicker}>
          <Clock size={18} />
        </IconButton>
        <button
          type="button"
          onClick={openPicker}
          className="ml-1 h-8 rounded-full border border-brand-500 px-4 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50"
        >
          Send Later
        </button>
      </header>

      <SendLaterPopover open={pickerOpen} onClose={closePicker} onConfirm={schedule} submitting={submitting} />

      <div className="mx-auto flex w-full max-w-3xl flex-col gap-1 px-6 pb-10 pt-2">
        <FieldRow label="From">
          {sendersLoading ? (
            <div className="h-8 w-56 animate-pulse rounded-md bg-ink-100" />
          ) : senders?.length ? (
            <div className="relative inline-flex max-w-full">
              <select
                value={form.senderId}
                onChange={(e) => set('senderId', e.target.value)}
                className="h-8 max-w-full cursor-pointer appearance-none truncate rounded-md border-0 bg-ink-100 py-0 pl-3 pr-8 text-sm text-ink-900 focus:ring-2 focus:ring-brand-100"
              >
                {senders.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.email}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={14}
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-ink-500"
              />
            </div>
          ) : (
            <span className="text-sm text-red-600">No senders available. Check the backend logs.</span>
          )}
        </FieldRow>

        <FieldRow label="To" underline className="items-start pt-0.5">
          <RecipientsField value={form.recipients} onChange={(v) => set('recipients', v)} />
        </FieldRow>

        <FieldRow label="Subject" underline>
          <TextInput
            value={form.subject}
            onChange={(e) => set('subject', e.target.value)}
            placeholder="Subject"
            maxLength={500}
          />
        </FieldRow>

        <div className="flex flex-wrap items-center gap-x-8 gap-y-2 py-3">
          <NumberBox
            label="Delay between 2 emails"
            title="Seconds between two emails of this campaign"
            value={form.delayBetweenSeconds}
            onChange={(v) => set('delayBetweenSeconds', v)}
            max={3600}
          />
          <NumberBox
            label="Hourly Limit"
            title="Maximum emails per hour for this campaign"
            value={form.hourlyLimit}
            onChange={(v) => set('hourlyLimit', v)}
            min={1}
          />
          {estimate && <span className="text-xs text-ink-400">{estimate}</span>}
        </div>

        <RichTextEditor onChange={onBodyChange} />

        <div className="mt-4">
          <AttachmentList files={files} onChange={setFiles} />
        </div>
      </div>
    </div>
  );
}
