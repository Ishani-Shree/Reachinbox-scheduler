import { useEffect, useRef, useState } from 'react';
import { useDismiss } from '../../hooks/useDismiss';
import { cn } from '../../utils/cn';
import { formatTime, toLocalInputValue } from '../../utils/format';

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
  { label: 'Right now', at: () => new Date() },
  { label: 'Tomorrow', at: tomorrowAt(9) },
  ...[10, 11, 15].map((h) => ({
    label: `Tomorrow, ${formatTime(tomorrowAt(h)())}`,
    at: tomorrowAt(h),
  })),
];

interface SendLaterPopoverProps {
  open: boolean;
  onClose: () => void;
  onConfirm: (startAt: Date) => void;
  submitting: boolean;
}

/** Start-time picker anchored under the compose header (Figma "Send Later" card). */
export function SendLaterPopover({ open, onClose, onConfirm, submitting }: SendLaterPopoverProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [value, setValue] = useState('');
  const [preset, setPreset] = useState<string | null>(null);
  useDismiss(ref, onClose, open && !submitting);

  useEffect(() => {
    if (open) {
      setValue('');
      setPreset(null);
    }
  }, [open]);

  if (!open) return null;

  const picked = preset ? PRESETS.find((p) => p.label === preset)!.at() : value ? new Date(value) : null;
  // datetime-local has minute precision, so allow the current minute.
  const inPast = picked ? picked.getTime() < Date.now() - 60_000 : false;

  return (
    <div
      ref={ref}
      role="dialog"
      aria-label="Send Later"
      className="absolute right-4 top-14 z-30 w-72 rounded-lg border border-ink-100 bg-white p-4 shadow-pop"
    >
      <h2 className="mb-3 text-sm font-medium text-ink-900">Send Later</h2>

      <input
        type={value ? 'datetime-local' : 'text'}
        onFocus={(e) => (e.target.type = 'datetime-local')}
        onBlur={(e) => !e.target.value && (e.target.type = 'text')}
        placeholder="Pick date & time"
        value={value}
        min={toLocalInputValue(new Date())}
        onChange={(e) => {
          setValue(e.target.value);
          setPreset(null);
        }}
        className={cn(
          'mb-3 h-9 w-full border-0 border-b bg-transparent px-0 text-xs text-ink-900 placeholder:text-ink-500 focus:ring-0',
          inPast ? 'border-red-400' : 'border-ink-200 focus:border-brand-500',
        )}
      />
      {inPast && <p className="-mt-2 mb-2 text-[11px] text-red-600">That time is in the past.</p>}

      <div className="flex flex-col">
        {PRESETS.map((p) => (
          <button
            key={p.label}
            type="button"
            onClick={() => {
              setPreset(p.label);
              setValue('');
            }}
            className={cn(
              'rounded-md px-0 py-2 text-left text-xs transition-colors hover:text-brand-600',
              preset === p.label ? 'font-medium text-brand-600' : 'text-ink-700',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <div className="mt-5 flex items-center justify-end gap-4">
        <button
          type="button"
          onClick={onClose}
          disabled={submitting}
          className="text-xs text-ink-700 hover:text-ink-900"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={() => picked && onConfirm(picked)}
          disabled={!picked || inPast || submitting}
          className="h-8 rounded-full border border-brand-500 px-5 text-xs font-medium text-brand-600 transition-colors hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-40"
        >
          {submitting ? 'Scheduling…' : 'Done'}
        </button>
      </div>
    </div>
  );
}
