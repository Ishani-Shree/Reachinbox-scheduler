import { forwardRef, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

/** Inline "Label  [value]" row used by the compose form. */
export function FieldRow({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex min-h-[44px] items-center gap-4', className)}>
      <span className="w-20 shrink-0 text-sm text-ink-500">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...rest }, ref) => (
    <input
      ref={ref}
      className={cn(
        'w-full border-0 border-b border-ink-200 bg-transparent py-2 text-sm text-ink-900 placeholder:text-ink-400',
        'focus:border-brand-500 focus:outline-none focus:ring-0',
        className,
      )}
      {...rest}
    />
  ),
);
TextInput.displayName = 'TextInput';

export function NumberBox({
  label,
  value,
  onChange,
  min = 0,
  max,
  suffix,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  return (
    <label className="flex items-center gap-3 text-sm text-ink-700">
      <span>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        value={Number.isNaN(value) ? '' : value}
        onChange={(e) => onChange(e.target.valueAsNumber)}
        className="h-9 w-20 rounded-md border border-ink-200 bg-ink-50 px-2 text-center text-sm focus:border-brand-500 focus:outline-none"
      />
      {suffix && <span className="text-ink-400">{suffix}</span>}
    </label>
  );
}

export function TextArea({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'w-full resize-y rounded-lg border border-ink-200 bg-ink-50 p-4 text-sm leading-relaxed text-ink-900 placeholder:text-ink-400',
        'focus:border-brand-500 focus:bg-white focus:outline-none',
        className,
      )}
      {...rest}
    />
  );
}
