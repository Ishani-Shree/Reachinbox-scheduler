import { Router } from 'express';
import { z } from 'zod';
import { env } from '../config/env';
import { prisma } from '../lib/clients';
import { createLogger } from '../lib/logger';
import { requireAuth, signState, verifyState } from '../middleware/auth';
import { createCampaign, createCampaignSchema } from '../services/campaigns';
import { emailStats, getAttachment, getEmail, listEmails } from '../services/emails';
import { completeSlackOAuth, disconnectSlack, notifyUser, slackAuthorizeUrl, slackConfigured } from '../services/slack';
import { asyncHandler, HttpError } from '../utils/http';

const log = createLogger('api');
export const apiRouter = Router();

// ---------- Senders ----------
apiRouter.get(
  '/senders',
  requireAuth,
  asyncHandler(async (_req, res) => {
    const senders = await prisma.sender.findMany({
      select: { id: true, name: true, email: true },
      orderBy: { name: 'asc' },
    });
    res.json(senders);
  }),
);

// ---------- Campaigns ----------
apiRouter.post(
  '/campaigns',
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = createCampaignSchema.parse({
      ...req.body,
      idempotencyKey: req.get('Idempotency-Key') ?? req.body?.idempotencyKey,
    });
    const { campaign, duplicate } = await createCampaign(req.userId!, input);
    res.status(duplicate ? 200 : 201).json({
      id: campaign.id,
      totalRecipients: campaign.totalRecipients,
      startAt: campaign.startAt.toISOString(),
      duplicate,
    });
  }),
);

// ---------- Emails ----------
const listQuery = z.object({
  tab: z.enum(['scheduled', 'sent']).default('scheduled'),
  filter: z.enum(['all', 'sent', 'failed', 'deferred']).default('all'),
  q: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

apiRouter.get(
  '/emails',
  requireAuth,
  asyncHandler(async (req, res) => {
    const query = listQuery.parse(req.query);
    const result = await listEmails({ userId: req.userId!, ...query, q: query.q || undefined });
    res.json({ ...result, page: query.page, hasMore: query.page * query.limit < result.total });
  }),
);

apiRouter.get(
  '/emails/stats',
  requireAuth,
  asyncHandler(async (req, res) => res.json(await emailStats(req.userId!))),
);

apiRouter.get(
  '/emails/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const email = await getEmail(req.userId!, req.params.id);
    if (!email) throw new HttpError(404, 'Email not found');
    res.json(email);
  }),
);

apiRouter.get(
  '/attachments/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const file = await getAttachment(req.userId!, req.params.id);
    if (!file) throw new HttpError(404, 'Attachment not found');
    res.setHeader('Content-Type', file.contentType);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(file.filename)}"`);
    res.setHeader('Cache-Control', 'private, max-age=86400');
    // Uploaded files are served back to the browser, so never let them run as HTML/script.
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox");
    res.send(Buffer.from(file.data));
  }),
);

// ---------- Slack ----------
apiRouter.get(
  '/slack/status',
  requireAuth,
  asyncHandler(async (req, res) => {
    const c = await prisma.slackConnection.findUnique({ where: { userId: req.userId } });
    res.json({
      configured: slackConfigured(),
      connected: Boolean(c),
      teamName: c?.teamName ?? null,
      channelName: c?.channelName ?? null,
    });
  }),
);

apiRouter.get('/slack/connect', requireAuth, (req, res) => {
  if (!slackConfigured()) throw new HttpError(400, 'Slack is not configured on the server');
  res.json({ url: slackAuthorizeUrl(signState({ userId: req.userId, purpose: 'slack' })) });
});

// Not behind requireAuth: Slack may redirect to a different host (ngrok) where
// the session cookie is absent. The signed `state` identifies the user instead.
apiRouter.get(
  '/slack/oauth/callback',
  asyncHandler(async (req, res) => {
    const { code, state, error } = req.query as Record<string, string | undefined>;
    const back = (status: string) => res.redirect(`${env.FRONTEND_URL}/scheduled?slack=${status}`);
    if (error || !code || !state) return back('cancelled');
    try {
      const { userId, purpose } = verifyState<{ userId: string; purpose: string }>(state);
      if (purpose !== 'slack') return back('error');
      await completeSlackOAuth(userId, code);
      back('connected');
    } catch (err) {
      log.error('Slack OAuth callback failed', err);
      back('error');
    }
  }),
);

apiRouter.delete(
  '/slack',
  requireAuth,
  asyncHandler(async (req, res) => {
    await disconnectSlack(req.userId!);
    res.status(204).end();
  }),
);

apiRouter.post(
  '/slack/test',
  requireAuth,
  asyncHandler(async (req, res) => {
    const sent = await notifyUser(req.userId!, { text: ':wave: Test notification from ReachInbox scheduler.' });
    if (!sent) throw new HttpError(400, 'Slack is not connected');
    res.json({ ok: true });
  }),
);
