import { env } from '../config/env';
import { prisma, redis } from '../lib/clients';
import { createLogger } from '../lib/logger';

const log = createLogger('slack');

export const slackConfigured = () => Boolean(env.SLACK_CLIENT_ID && env.SLACK_CLIENT_SECRET && env.SLACK_REDIRECT_URI);

export function slackAuthorizeUrl(state: string) {
  const params = new URLSearchParams({
    client_id: env.SLACK_CLIENT_ID,
    scope: 'incoming-webhook',
    redirect_uri: env.SLACK_REDIRECT_URI,
    state,
  });
  return `https://slack.com/oauth/v2/authorize?${params}`;
}

interface SlackOAuthResponse {
  ok: boolean;
  error?: string;
  access_token: string;
  team: { id: string; name: string };
  incoming_webhook?: { url: string; channel: string; channel_id: string };
}

/** Exchanges the OAuth code and stores (or replaces) the user's Slack connection. */
export async function completeSlackOAuth(userId: string, code: string) {
  const res = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.SLACK_CLIENT_ID,
      client_secret: env.SLACK_CLIENT_SECRET,
      code,
      redirect_uri: env.SLACK_REDIRECT_URI,
    }),
  });
  const data = (await res.json()) as SlackOAuthResponse;
  if (!data.ok || !data.incoming_webhook) {
    throw new Error(`Slack OAuth failed: ${data.error ?? 'no incoming webhook returned'}`);
  }

  const fields = {
    teamId: data.team.id,
    teamName: data.team.name,
    channelId: data.incoming_webhook.channel_id,
    channelName: data.incoming_webhook.channel,
    webhookUrl: data.incoming_webhook.url,
    accessToken: data.access_token,
  };
  const connection = await prisma.slackConnection.upsert({
    where: { userId },
    update: fields,
    create: { userId, ...fields },
  });
  await postToWebhook(connection.webhookUrl, {
    text: ':white_check_mark: ReachInbox is connected. You will be notified here when a sender hits its hourly limit.',
  });
  return connection;
}

export async function disconnectSlack(userId: string) {
  const connection = await prisma.slackConnection.findUnique({ where: { userId } });
  if (!connection) return;
  try {
    await fetch('https://slack.com/api/auth.revoke', {
      method: 'POST',
      headers: { Authorization: `Bearer ${connection.accessToken}` },
    });
  } catch (err) {
    log.warn('Token revoke failed (continuing with disconnect)', (err as Error).message);
  }
  await prisma.slackConnection.delete({ where: { userId } });
}

async function postToWebhook(url: string, payload: object) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Slack webhook responded ${res.status}: ${await res.text()}`);
}

/**
 * Sends a message to the user's connected Slack channel. Looks up the
 * connection on every call, so connecting/disconnecting takes effect
 * immediately without a restart. No connection means no-op.
 */
export async function notifyUser(userId: string, payload: object): Promise<boolean> {
  const connection = await prisma.slackConnection.findUnique({ where: { userId } });
  if (!connection) return false;
  await postToWebhook(connection.webhookUrl, payload);
  return true;
}

/**
 * Called by the worker when a rate limit is reached. Deduped per
 * (limit, window, user) with SET NX so N parallel workers produce exactly one
 * message per hour window.
 */
export async function notifyRateLimitHit(params: {
  userId: string;
  kind: 'sender' | 'campaign';
  limitKey: string;
  window: number;
  senderEmail: string;
  limit: number;
  subject: string;
  deferredUntil: Date | null;
}) {
  // Check the connection before claiming the dedupe key, so a user who
  // connects mid-hour still gets notified for the current window.
  if (!(await prisma.slackConnection.findUnique({ where: { userId: params.userId }, select: { id: true } }))) {
    return;
  }
  const dedupeKey = `slack:ratelimit:${params.kind}:${params.limitKey}:${params.window}:${params.userId}`;
  const first = await redis.set(dedupeKey, '1', 'EX', 2 * 3600, 'NX');
  if (!first) return;

  const what =
    params.kind === 'sender'
      ? `Sender *${params.senderEmail}* reached its hourly limit of *${params.limit}* emails.`
      : `Campaign *"${params.subject}"* reached its hourly limit of *${params.limit}* emails (sender ${params.senderEmail}).`;
  const next = params.deferredUntil
    ? `Remaining emails are rescheduled from *${params.deferredUntil.toUTCString()}*.`
    : 'Remaining emails will go out in the next available hour window.';

  try {
    const sent = await notifyUser(params.userId, {
      text: `:warning: Rate limit reached. ${what} ${next}`,
      blocks: [
        { type: 'section', text: { type: 'mrkdwn', text: `:warning: *Hourly rate limit reached*\n${what}\n${next}` } },
      ],
    });
    if (sent) log.info(`Rate-limit notification sent to user ${params.userId}`);
  } catch (err) {
    // Allow a retry later in this window if Slack was down.
    await redis.del(dedupeKey);
    log.warn('Failed to send Slack notification', (err as Error).message);
  }
}
