import { useEffect, type RefObject } from 'react';

/** Calls onClose on a click outside `ref` or on Escape, while `enabled`. Used by menus and popovers. */
export function useDismiss(ref: RefObject<HTMLElement>, onClose: () => void, enabled = true) {
  useEffect(() => {
    if (!enabled) return;
    const onPointer = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, onClose, enabled]);
}
