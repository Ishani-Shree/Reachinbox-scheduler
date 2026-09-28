import { cn } from '../../utils/cn';

export function Logo({ className }: { className?: string }) {
  return <span className={cn('select-none font-logo text-[28px] leading-none text-ink-900', className)}>ONB</span>;
}
