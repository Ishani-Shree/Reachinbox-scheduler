import { Slack } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { useSearchParams } from 'react-router-dom';
import { slackApi } from '../../api';
import { errorMessage } from '../../api/client';
import { useQuery } from '../../hooks/useQuery';
import { Button } from '../ui/Button';

const CALLBACK_MESSAGES: Record<string, [ok: boolean, msg: string]> = {
  connected: [true, 'Slack connected. You will be notified when a rate limit is hit.'],
  cancelled: [false, 'Slack connection was cancelled.'],
  error: [false, 'Could not connect Slack. Please try again.'],
};

export function SlackCard() {
  const { data: status, loading, reload } = useQuery(() => slackApi.status(), []);
  const [busy, setBusy] = useState(false);
  const [params, setParams] = useSearchParams();

  // Show the result of the OAuth round-trip once, then clean the URL.
  useEffect(() => {
    const result = params.get('slack');
    if (!result || !CALLBACK_MESSAGES[result]) return;
    const [ok, msg] = CALLBACK_MESSAGES[result];
    ok ? toast.success(msg) : toast.error(msg);
    params.delete('slack');
    setParams(params, { replace: true });
    void reload();
  }, [params, setParams, reload]);

  const act = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const connect = () =>
    act(async () => {
      const { url } = await slackApi.connectUrl();
      window.location.href = url;
    });
  const disconnect = () =>
    act(async () => {
      await slackApi.disconnect();
      await reload();
      toast.success('Slack disconnected');
    });
  const test = () =>
    act(async () => {
      await slackApi.test();
      toast.success('Test message sent to Slack');
    });

  return (
    <div className="rounded-xl border border-ink-100 p-3">
      <div className="mb-2 flex items-center gap-2 text-sm font-semibold">
        <Slack size={16} className="text-[#611f69]" /> Slack alerts
      </div>
      {loading ? (
        <div className="h-8 animate-pulse rounded bg-ink-100" />
      ) : status?.connected ? (
        <>
          <p className="mb-2 truncate text-xs text-ink-500">
            Connected to <span className="font-medium text-ink-700">{status.teamName}</span>
            {status.channelName && <> · {status.channelName}</>}
          </p>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={test} disabled={busy}>
              Test
            </Button>
            <Button size="sm" variant="danger" onClick={disconnect} disabled={busy}>
              Disconnect
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mb-2 text-xs text-ink-500">Get notified the moment a sender hits its hourly limit.</p>
          <Button
            size="sm"
            variant="outline"
            fullWidth
            onClick={connect}
            loading={busy}
            disabled={status?.configured === false}
          >
            {status?.configured === false ? 'Not configured on server' : 'Connect Slack'}
          </Button>
        </>
      )}
    </div>
  );
}
