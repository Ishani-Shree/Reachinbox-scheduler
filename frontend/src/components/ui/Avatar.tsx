import { useState } from 'react';
import { cn } from '../../utils/cn';
import { initials } from '../../utils/format';

const sizes = { sm: 'h-8 w-8 text-xs', md: 'h-10 w-10 text-sm', lg: 'h-12 w-12 text-base' };

export function Avatar({ name, src, size = 'md' }: { name: string; src?: string | null; size?: keyof typeof sizes }) {
  const [broken, setBroken] = useState(false);
  const base = cn('shrink-0 rounded-full', sizes[size]);

  if (src && !broken) {
    return (
      <img
        src={src}
        alt={name}
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className={cn(base, 'object-cover')}
      />
    );
  }
  return (
    <span className={cn(base, 'inline-flex items-center justify-center bg-brand-100 font-semibold text-brand-700')}>
      {initials(name)}
    </span>
  );
}
