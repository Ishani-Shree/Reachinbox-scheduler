import { ChevronDown, LogOut } from 'lucide-react';
import { useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useDismiss } from '../../hooks/useDismiss';
import { Avatar } from '../ui/Avatar';

export function UserMenu() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useDismiss(ref, close, open);

  if (!user) return null;
  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2.5 rounded-xl bg-ink-50 px-2.5 py-2 text-left transition-colors hover:bg-ink-100"
        aria-expanded={open}
      >
        <Avatar name={user.name} src={user.avatarUrl} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink-900">{user.name}</span>
          <span className="block truncate text-[11px] text-ink-500">{user.email}</span>
        </span>
        <ChevronDown size={15} className={`shrink-0 text-ink-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-xl border border-ink-100 bg-white p-1 shadow-pop">
          <button
            onClick={async () => {
              await logout();
              navigate('/login', { replace: true });
            }}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50"
          >
            <LogOut size={15} /> Logout
          </button>
        </div>
      )}
    </div>
  );
}
