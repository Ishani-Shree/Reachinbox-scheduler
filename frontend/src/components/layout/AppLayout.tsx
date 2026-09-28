import { Menu } from 'lucide-react';
import { useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { StatsProvider } from '../../context/StatsContext';
import { IconButton } from '../ui/Button';
import { Logo } from '../ui/Logo';
import { FullPageSpinner } from '../ui/Spinner';
import { Sidebar } from './Sidebar';

/** Authenticated shell: sidebar + routed content. Redirects to /login when signed out. */
export function AppLayout() {
  const { user, loading } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  if (loading) return <FullPageSpinner />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;

  return (
    <StatsProvider>
      <div className="flex h-full">
        <div className="hidden md:block">
          <Sidebar />
        </div>

        {mobileOpen && (
          <div className="fixed inset-0 z-40 md:hidden">
            <div className="absolute inset-0 bg-black/30" onClick={() => setMobileOpen(false)} />
            <div className="relative h-full w-72">
              <Sidebar onNavigate={() => setMobileOpen(false)} />
            </div>
          </div>
        )}

        <main className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-ink-100 px-4 py-2 md:hidden">
            <IconButton label="Open menu" onClick={() => setMobileOpen(true)}>
              <Menu size={20} />
            </IconButton>
            <Logo className="text-xl" />
          </div>
          <Outlet />
        </main>
      </div>
    </StatsProvider>
  );
}
