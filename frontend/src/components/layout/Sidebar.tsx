import { Activity, Clock, Send } from 'lucide-react';
import type { ReactNode } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useStats } from '../../context/StatsContext';
import { cn } from '../../utils/cn';
import { Button } from '../ui/Button';
import { SlackCard } from './SlackCard';
import { UserMenu } from './UserMenu';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:4000';

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
          'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors',
          isActive ? 'bg-brand-50 font-semibold text-ink-900' : 'text-ink-700 hover:bg-ink-50',
        )
      }
    >
      <span className="text-ink-500">{icon}</span>
      <span className="flex-1">{label}</span>
      {count !== undefined && <span className="text-xs font-medium text-ink-500">{count.toLocaleString()}</span>}
    </NavLink>
  );
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const { stats } = useStats();

  return (
    <aside className="flex h-full w-72 flex-col gap-5 border-r border-ink-100 bg-white p-5">
      <div className="px-1 text-2xl font-extrabold tracking-tight">ONB</div>
      <UserMenu />
      <Button
        variant="outline"
        size="lg"
        fullWidth
        onClick={() => {
          navigate('/compose');
          onNavigate?.();
        }}
      >
        Compose
      </Button>

      <nav className="flex flex-col gap-1">
        <p className="px-3 pb-1 text-xs font-semibold uppercase tracking-wider text-ink-400">Core</p>
        <NavItem
          to="/scheduled"
          icon={<Clock size={18} />}
          label="Scheduled"
          count={stats?.scheduled}
          onClick={onNavigate}
        />
        <NavItem
          to="/sent"
          icon={<Send size={18} />}
          label="Sent"
          count={stats ? stats.sent + stats.failed : undefined}
          onClick={onNavigate}
        />
      </nav>

      <div className="mt-auto flex flex-col gap-3">
        <SlackCard />
        <a
          href={`${BACKEND_URL}/admin/queues`}
          target="_blank"
          rel="noreferrer"
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink-500 hover:bg-ink-50 hover:text-ink-900"
        >
          <Activity size={16} /> Queue dashboard
        </a>
      </div>
    </aside>
  );
}
