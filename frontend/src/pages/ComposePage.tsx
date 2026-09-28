import { ArrowLeft, Clock } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { campaignsApi, sendersApi } from '../api';
import { errorMessage } from '../api/client';
import { RecipientsField } from '../components/compose/RecipientsField';
import { SendLaterModal } from '../components/compose/SendLaterModal';
import { Button, IconButton } from '../components/ui/Button';
import { FieldRow, NumberBox, TextArea, TextInput } from '../components/ui/Field';
import { useStats } from '../context/StatsContext';
import { useQuery } from '../hooks/useQuery';
import { pluralize } from '../utils/format';

interface FormState {
  senderId: string;
  recipients: string[];
  subject: string;
  body: string;
  delayBetweenSeconds: number;
  hourlyLimit: number;
}

const initialForm: FormState = {
  senderId: '',
  recipients: [],
  subject: '',
  body: '',
  delayBetweenSeconds: 2,
  hourlyLimit: 100,
};

function validate(f: FormState): string | null {
  if (!f.senderId) return 'Choose a sender';
  if (!f.recipients.length) return 'Add at least one recipient or upload a lead list';
  if (!f.subject.trim()) return 'Subject is required';
  if (!f.body.trim()) return 'Email body is required';
  if (!Number.isInteger(f.delayBetweenSeconds) || f.delayBetweenSeconds < 0) return 'Delay must be 0 or more seconds';
  if (!Number.isInteger(f.hourlyLimit) || f.hourlyLimit < 1) return 'Hourly limit must be at least 1';
  return null;
}

export function ComposePage() {
  const navigate = useNavigate();
  const { refreshStats } = useStats();
  const [form, setForm] = useState<FormState>(initialForm);
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

  const estimate = useMemo(() => {
    const n = form.recipients.length;
    if (n < 2 || !form.hourlyLimit) return null;
    const byLimit = Math.ceil(n / form.hourlyLimit);
    const byDelay = Math.ceil(((n - 1) * form.delayBetweenSeconds) / 3600);
    const hours = Math.max(byLimit, byDelay);
    return hours > 1 ? `About ${pluralize(hours, 'hour')} to send all ${n.toLocaleString()} emails` : null;
  }, [form.recipients.length, form.hourlyLimit, form.delayBetweenSeconds]);

  const openPicker = () => {
    const problem = validate(form);
    if (problem) return toast.error(problem);
    setPickerOpen(true);
  };

  const schedule = async (startAt: Date) => {
    setSubmitting(true);
    try {
      const res = await campaignsApi.create(
        {
          senderId: form.senderId,
          recipients: form.recipients,
          subject: form.subject.trim(),
          body: form.body,
          startAt: startAt.toISOString(),
          delayBetweenSeconds: form.delayBetweenSeconds,
          hourlyLimit: form.hourlyLimit,
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
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">
      <header className="flex items-center gap-3 px-6 py-4">
        <IconButton label="Back" onClick={() => navigate(-1)}>
          <ArrowLeft size={20} />
        </IconButton>
        <h1 className="flex-1 text-lg font-semibold">Compose New Email</h1>
        <Button variant="outline" icon={<Clock size={16} />} onClick={openPicker}>
          Send Later
        </Button>
      </header>

      <div className="mx-4 mb-6 flex flex-col gap-2 rounded-2xl bg-white p-6 shadow-card md:mx-6">
        <FieldRow label="From">
          {sendersLoading ? (
            <div className="h-8 w-64 animate-pulse rounded-full bg-ink-100" />
          ) : senders?.length ? (
            <select
              value={form.senderId}
              onChange={(e) => set('senderId', e.target.value)}
              className="h-9 max-w-full rounded-full border-0 bg-ink-100 px-4 pr-8 text-sm focus:ring-2 focus:ring-brand-200"
            >
              {senders.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}: {s.email}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm text-red-600">No senders available. Check the backend logs.</span>
          )}
        </FieldRow>

        <FieldRow label="To" className="items-start pt-1">
          <RecipientsField value={form.recipients} onChange={(v) => set('recipients', v)} />
        </FieldRow>

        <FieldRow label="Subject">
          <TextInput
            value={form.subject}
            onChange={(e) => set('subject', e.target.value)}
            placeholder="Subject"
            maxLength={500}
          />
        </FieldRow>

        <div className="flex flex-wrap items-center gap-x-10 gap-y-3 py-3">
          <NumberBox
            label="Delay between 2 emails"
            suffix="sec"
            value={form.delayBetweenSeconds}
            onChange={(v) => set('delayBetweenSeconds', v)}
            max={3600}
          />
          <NumberBox label="Hourly Limit" value={form.hourlyLimit} onChange={(v) => set('hourlyLimit', v)} min={1} />
          {estimate && <span className="text-xs text-ink-500">{estimate}</span>}
        </div>

        <TextArea
          value={form.body}
          onChange={(e) => set('body', e.target.value)}
          placeholder="Type your reply..."
          rows={12}
        />
      </div>

      <SendLaterModal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onConfirm={schedule}
        submitting={submitting}
      />
    </div>
  );
}
