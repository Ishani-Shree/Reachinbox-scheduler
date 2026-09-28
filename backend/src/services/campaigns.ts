import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../lib/clients';
import { createLogger } from '../lib/logger';
import { enqueueEmails } from '../queue/emailQueue';
import { toPlainText, toSafeHtml } from '../utils/html';
import { HttpError } from '../utils/http';
import { indexEmails } from './search';

const log = createLogger('campaigns');

const MAX_ATTACHMENTS = 5;
const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;

const attachmentSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  contentType: z.string().trim().min(1).max(150),
  /** File contents, base64 encoded. */
  data: z.string().min(1),
});

export const createCampaignSchema = z.object({
  senderId: z.string().uuid(),
  subject: z.string().trim().min(1).max(500),
  /** HTML from the rich-text editor, or plain text. Sanitised before storage. */
  body: z.string().trim().min(1).max(200_000),
  recipients: z.array(z.string().trim().toLowerCase().email()).min(1).max(20_000),
  startAt: z.coerce.date(),
  delayBetweenSeconds: z.number().int().min(0).max(3600),
  hourlyLimit: z.number().int().min(1).max(100_000),
  idempotencyKey: z.string().max(100).optional(),
  attachments: z.array(attachmentSchema).max(MAX_ATTACHMENTS).default([]),
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

  const body = toSafeHtml(input.body);
  if (!toPlainText(body)) throw new HttpError(400, 'Email body is empty');

  const attachments = input.attachments.map((a) => {
    const data = Buffer.from(a.data, 'base64');
    return { filename: a.filename, contentType: a.contentType, size: data.length, data };
  });
  if (attachments.reduce((sum, a) => sum + a.size, 0) > MAX_ATTACHMENT_BYTES) {
    throw new HttpError(400, 'Attachments exceed the 10 MB limit');
  }

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
      body,
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
          body,
          startAt,
          delayBetweenMs: delayMs,
          hourlyLimit: input.hourlyLimit,
          totalRecipients: recipients.length,
          idempotencyKey: input.idempotencyKey,
          attachments: { create: attachments },
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
