import { useEffect, useState } from 'react';
import { cn } from '../../utils/cn';
import { toLocalInputValue } from '../../utils/format';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

interface Preset {
  label: string;
  at: () => Date;
}

const tomorrowAt = (hour: number) => () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(hour, 0, 0, 0);
  return d;
};

const PRESETS: Preset[] = [
  { label: 'Now', at: () => new Date() },
  { label: 'In 5 minutes', at: () => new Date(Date.now() + 5 * 60_000) },
  { label: 'In 1 hour', at: () => new Date(Date.now() + 60 * 60_000) },
  { label: 'Tomorrow, 10:00 AM', at: tomorrowAt(10) },
  { label: 'Tomorrow, 3:00 PM', at: tomorrowAt(15) },
];

interface SendLaterModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (startAt: Date) => void;
  submitting: boolean;
}

/** Picks the campaign start time. Emails then go out every `delay` seconds from it. */
export function SendLaterModal({ open, onClose, onConfirm, submitting }: SendLaterModalProps) {
  const [value, setValue] = useState('');

  useEffect(() => {
    if (open) setValue(toLocalInputValue(new Date(Date.now() + 5 * 60_000)));
  }, [open]);

  const picked = value ? new Date(value) : null;
  // datetime-local has minute precision, so allow "now" within the current minute.
  const inPast = picked ? picked.getTime() < Date.now() - 60_000 : false;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Send Later"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={() => picked && onConfirm(picked)} disabled={!picked || inPast} loading={submitting}>
            Schedule
          </Button>
        </>
      }
    >
      <label className="mb-1 block text-xs font-medium text-ink-500">Pick date & time</label>
      <input
        type="datetime-local"
        value={value}
        min={toLocalInputValue(new Date())}
        onChange={(e) => setValue(e.target.value)}
        className={cn(
          'mb-1 h-10 w-full rounded-lg border px-3 text-sm focus:outline-none',
          inPast ? 'border-red-300 focus:border-red-500' : 'border-ink-200 focus:border-brand-500',
        )}
      />
      {inPast && <p className="mb-2 text-xs text-red-600">Start time is in the past.</p>}

      <div className="mt-3 flex flex-col">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            onClick={() => setValue(toLocalInputValue(p.at()))}
            className="rounded-lg px-2 py-2 text-left text-sm text-ink-700 hover:bg-ink-50"
          >
            {p.label}
          </button>
        ))}
      </div>
    </Modal>
  );
}
