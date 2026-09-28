import { forwardRef, type InputHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../utils/cn';

/** "Label  value" row of the compose form. `underline` draws the Figma divider under the value. */
export function FieldRow({
  label,
  children,
  underline,
  className,
}: {
  label: string;
  children: ReactNode;
  underline?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('flex min-h-[40px] items-center gap-3', underline && 'border-b border-ink-100', className)}>
      <span className="w-14 shrink-0 text-sm text-ink-900">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...rest }, ref) => (
    <input
      ref={ref}
      className={cn(
        'h-9 w-full border-0 bg-transparent px-0 text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none focus:ring-0',
        className,
      )}
      {...rest}
    />
  ),
);
TextInput.displayName = 'TextInput';

/** Small numeric box with a "00" placeholder (delay / hourly limit). Empty is reported as NaN. */
export function NumberBox({
  label,
  value,
  onChange,
  min = 0,
  max,
  title,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  title?: string;
}) {
  return (
    <label className="flex items-center gap-2 text-sm text-ink-900" title={title}>
      <span>{label}</span>
      <input
        type="number"
        inputMode="numeric"
        min={min}
        max={max}
        placeholder="00"
        value={Number.isNaN(value) ? '' : value}
        onChange={(e) => onChange(e.target.valueAsNumber)}
        className="h-8 w-12 rounded-md border border-ink-200 bg-white px-2 text-sm placeholder:text-ink-300 focus:border-brand-500 focus:outline-none focus:ring-0 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
      />
    </label>
  );
}
