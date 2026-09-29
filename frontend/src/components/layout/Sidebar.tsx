import { Activity, Clock, Send } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useStats } from '../../context/StatsContext';
import { cn } from '../../utils/cn';
import { Logo } from '../ui/Logo';
import { SlackCard } from './SlackCard';
import { UserMenu } from './UserMenu';

// Dev: the API runs on :4000 next to Vite. Production: the API serves the app, so same origin.
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? (import.meta.env.DEV ? 'http://localhost:4000' : '');

function NavItem({
  to,
  icon,
  label,
  count,
  onClick,
}: {
  to: string;
  icon: ReactNode;
  label: string;
  count?: number;
  onClick?: () => void;
}) {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          'flex h-9 items-center gap-2.5 rounded-lg px-3 text-sm transition-colors',
          isActive ? 'bg-brand-50 font-medium text-ink-900' : 'text-ink-700 hover:bg-ink-50',
        )
      }
    >
      <span className="text-ink-700">{icon}</span>
      <span className="flex-1">{label}</span>
      {count !== undefined && <span className="text-xs text-ink-500">{count.toLocaleString()}</span>}
    </NavLink>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const { stats } = useStats();

  return (
    <aside className="flex h-full w-64 flex-col gap-4 bg-white px-3 pb-4 pt-5">
      <Logo className="px-2" />
      <UserMenu />
      <button
        onClick={() => {
          navigate('/compose');
          onNavigate?.();
        }}
        className="h-9 w-full rounded-full border border-brand-500 text-sm font-medium text-brand-600 transition-colors hover:bg-brand-50"
      >
        Compose
      </button>

      <nav className="flex flex-col gap-0.5">
        <p className="px-3 pb-1.5 text-[11px] font-medium uppercase tracking-wide text-ink-400">Core</p>
        <NavItem
          to="/scheduled"
          icon={<Clock size={16} />}
          label="Scheduled"
          count={stats?.scheduled}
          onClick={onNavigate}
        />
        <NavItem
          to="/sent"
          icon={<Send size={16} />}
          label="Sent"
          count={stats ? stats.sent + stats.failed : undefined}
          onClick={onNavigate}
        />
      </nav>

      <div className="mt-auto flex flex-col gap-2">
        <SlackCard />
        <a
          href={`${BACKEND_URL}/admin/queues`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-xs text-ink-500 hover:bg-ink-50 hover:text-ink-900"
        >
          <Activity size={14} /> Queue dashboard
        </a>
      </div>
    </aside>
  );
}
