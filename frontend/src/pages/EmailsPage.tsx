import { AlertTriangle, Clock, Send } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { emailsApi } from '../api';
import { errorMessage } from '../api/client';
import { EmailListItem, EmailListSkeleton } from '../components/emails/EmailListItem';
import { Pagination } from '../components/emails/Pagination';
import { SearchBar } from '../components/emails/SearchBar';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { useStats } from '../context/StatsContext';
import { useDebounce } from '../hooks/useDebounce';
import { useQuery } from '../hooks/useQuery';
import type { EmailTab } from '../types';

const PAGE_SIZE = 50;

const EMPTY: Record<EmailTab, { icon: JSX.Element; title: string; description: string }> = {
  scheduled: {
    icon: <Clock size={24} />,
    title: 'No scheduled emails',
    description: 'Emails you schedule will show up here until they are sent.',
  },
  sent: {
    icon: <Send size={24} />,
    title: 'No sent emails yet',
    description: 'Once scheduled emails go out, you will see them here with their delivery status.',
  },
};

/** Shared page for the Scheduled and Sent tabs. They differ only in the `tab` filter. */
export function EmailsPage({ tab }: { tab: EmailTab }) {
  const navigate = useNavigate();
  const { refreshStats } = useStats();
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const q = useDebounce(search.trim(), 300);

  useEffect(() => setPage(1), [tab, q]);

  const { data, error, loading, reload } = useQuery(
    () => emailsApi.list({ tab, q: q || undefined, page, limit: PAGE_SIZE }),
    [tab, q, page],
    { pollMs: 5000 },
  );

  const refresh = async () => {
    setRefreshing(true);
    await Promise.all([reload(), refreshStats()]);
    setRefreshing(false);
  };

  let content;
  // `loading` is only set for foreground fetches (tab/search/page change), not polling.
  if (loading) {
    content = <EmailListSkeleton />;
  } else if (error && !data) {
    content = (
      <EmptyState
        icon={<AlertTriangle size={24} />}
        title="Could not load emails"
        description={errorMessage(error)}
        action={<Button onClick={refresh}>Try again</Button>}
      />
    );
  } else if (!data?.items.length) {
    content = q ? (
      <EmptyState icon={EMPTY[tab].icon} title="No matches" description={`Nothing in ${tab} matches "${q}".`} />
    ) : (
      <EmptyState {...EMPTY[tab]} action={<Button onClick={() => navigate('/compose')}>Compose new email</Button>} />
    );
  } else {
    content = (
      <>
        <ul>
          {data.items.map((email) => (
            <EmailListItem key={email.id} email={email} />
          ))}
        </ul>
        <Pagination page={page} pageSize={PAGE_SIZE} total={data.total} onPage={setPage} />
      </>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <SearchBar value={search} onChange={setSearch} onRefresh={refresh} refreshing={refreshing} />
      <div className="min-h-0 flex-1 overflow-y-auto">{content}</div>
    </div>
  );
}
