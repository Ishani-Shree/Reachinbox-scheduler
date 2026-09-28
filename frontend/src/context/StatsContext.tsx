import { createContext, useContext, type ReactNode } from 'react';
import { emailsApi } from '../api';
import { useQuery } from '../hooks/useQuery';
import type { EmailStats } from '../types';

interface StatsState {
  stats: EmailStats | null;
  refreshStats: () => Promise<void>;
}

const StatsContext = createContext<StatsState | null>(null);

/** Sidebar counters, polled so they track the worker as emails go out. */
export function StatsProvider({ children }: { children: ReactNode }) {
  const { data, reload } = useQuery(() => emailsApi.stats(), [], { pollMs: 5000 });
  return <StatsContext.Provider value={{ stats: data, refreshStats: reload }}>{children}</StatsContext.Provider>;
}

export function useStats() {
  const ctx = useContext(StatsContext);
  if (!ctx) throw new Error('useStats must be used inside <StatsProvider>');
  return ctx;
}
