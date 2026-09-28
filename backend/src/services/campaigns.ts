import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/clients';
import { createLogger } from '../lib/logger';
import { enqueueEmails } from '../queue/emailQueue';
import { HttpError } from '../utils/http';
import { indexEmails } from './search';

const log = createLogger('campaigns');

export const createCampaignSchema = z.object({
  senderId: z.string().uuid(),
  subject: z.string().trim().min(1).max(500),
  body: z.string().trim().min(1).max(50_000),
  recipients: z.array(z.string().trim().toLowerCase().email()).min(1).max(20_000),
  startAt: z.coerce.date(),
  delayBetweenSeconds: z.number().int().min(0).max(3600),
  hourlyLimit: z.number().int().min(1).max(100_000),
  idempotencyKey: z.string().max(100).optional(),
});
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;

/**
 * Persists a campaign and one Email row per recipient in a single
 * transaction, then enqueues one delayed BullMQ job per email.
 *
 * Email i is scheduled at startAt + i * delay. The hourly limit is NOT
 * applied here but at send time by the worker, because it is shared with
 * every other campaign on the same sender.
 */
export async function createCampaign(userId: string, input: CreateCampaignInput) {
  if (input.idempotencyKey) {
    const existing = await prisma.campaign.findUnique({
      where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } },
    });
    if (existing) return { campaign: existing, duplicate: true };
  }

  const sender = await prisma.sender.findUnique({ where: { id: input.senderId } });
  if (!sender) throw new HttpError(400, 'Unknown sender');

  const recipients = [...new Set(input.recipients)];
  const startAt = new Date(Math.max(Date.now(), input.startAt.getTime()));
  const delayMs = input.delayBetweenSeconds * 1000;

  const emails = recipients.map((toEmail, i) => {
    const scheduledAt = new Date(startAt.getTime() + i * delayMs);
    return {
      id: randomUUID(),
      userId,
      senderId: sender.id,
      toEmail,
      subject: input.subject,
      body: input.body,
      scheduledAt,
      originalScheduledAt: scheduledAt,
    };
  });

  let campaign;
  try {
    campaign = await prisma.$transaction(async (tx) => {
      const c = await tx.campaign.create({
        data: {
          userId,
          senderId: sender.id,
          subject: input.subject,
          body: input.body,
          startAt,
          delayBetweenMs: delayMs,
          hourlyLimit: input.hourlyLimit,
          totalRecipients: recipients.length,
          idempotencyKey: input.idempotencyKey,
        },
      });
      await tx.email.createMany({ data: emails.map((e) => ({ ...e, campaignId: c.id })) });
      return c;
    });
  } catch (err) {
    // Two identical submits raced: the unique (userId, idempotencyKey) index let only one through.
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' && input.idempotencyKey) {
      const existing = await prisma.campaign.findUniqueOrThrow({
        where: { userId_idempotencyKey: { userId, idempotencyKey: input.idempotencyKey } },
      });
      return { campaign: existing, duplicate: true };
    }
    throw err;
  }

  // If enqueueing fails the rows are still safe in Postgres; the worker's
  // startup reconciliation will enqueue them.
  try {
    await enqueueEmails(emails);
  } catch (err) {
    log.error(`Failed to enqueue campaign ${campaign.id}; reconciliation will retry`, err);
  }

  void indexEmails(
    emails.map((e) => ({
      ...e,
      campaignId: campaign.id,
      status: 'SCHEDULED' as const,
      sentAt: null,
      messageId: null,
      previewUrl: null,
      error: null,
      attempts: 0,
      deferredCount: 0,
      createdAt: campaign.createdAt,
      updatedAt: campaign.createdAt,
      sender: { name: sender.name, email: sender.email },
    })),
  );

  log.info(`Campaign ${campaign.id}: ${recipients.length} emails from ${startAt.toISOString()}`);
  return { campaign, duplicate: false };
}
