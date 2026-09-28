import { DelayedError, Job } from 'bullmq';
import { env } from '../config/env';
import { prisma } from '../lib/clients';
import { createLogger } from '../lib/logger';
import { sendMail } from '../services/mailer';
import { syncEmail } from '../services/search';
import { notifyRateLimitHit } from '../services/slack';
import { HOUR_MS, hourWindow, sleep, windowStart } from '../utils/time';
import type { EmailJobData } from './emailQueue';
import { reserveHourWindow, reserveSendSlot, type LimitReason } from './rateLimiter';

const log = createLogger('processor');

/** Waits longer than this are handed back to Redis instead of holding a worker slot. */
const MAX_INLINE_WAIT_MS = 15_000;

/**
 * Hands the job back to BullMQ as a delayed job. This does not consume a retry
 * attempt, and the new run time lives in Redis, so it survives restarts.
 */
async function deferJob(
  job: Job<EmailJobData>,
  token: string | undefined,
  emailId: string,
  runAt: number,
  countAsDeferral: boolean,
): Promise<never> {
  await prisma.email.update({
    where: { id: emailId },
    data: {
      status: 'SCHEDULED',
      scheduledAt: new Date(runAt),
      ...(countAsDeferral ? { deferredCount: { increment: 1 } } : {}),
    },
  });
  void syncEmail(emailId);
  await job.moveToDelayed(runAt, token);
  throw new DelayedError();
}

export async function processEmailJob(job: Job<EmailJobData>, token?: string) {
  const { emailId } = job.data;
  const email = await prisma.email.findUnique({
    where: { id: emailId },
    include: { sender: true, campaign: { select: { hourlyLimit: true, subject: true } } },
  });

  // Idempotency: never send an email that already reached a final state.
  if (!email) return { skipped: 'missing' };
  if (email.status === 'SENT' || email.status === 'FAILED') return { skipped: email.status };

  // ---- 1. Hourly rate limit (Redis counters shared by every worker) ----
  const now = Date.now();
  const currentWindow = hourWindow(now);
  let reservedWindow = job.data.reservedWindow;

  if (reservedWindow === undefined || reservedWindow < currentWindow) {
    const campaignLimit = Math.min(email.campaign.hourlyLimit, env.MAX_EMAILS_PER_HOUR_PER_SENDER);
    const res = await reserveHourWindow({
      senderId: email.senderId,
      campaignId: email.campaignId,
      campaignHourlyLimit: email.campaign.hourlyLimit,
      fromWindow: currentWindow,
    });

    const notify = (kind: Exclude<LimitReason, 'none'>, deferredUntil: Date | null) =>
      void notifyRateLimitHit({
        userId: email.userId,
        kind,
        limitKey: kind === 'sender' ? email.senderId : email.campaignId,
        window: currentWindow,
        senderEmail: email.sender.email,
        limit: kind === 'sender' ? env.MAX_EMAILS_PER_HOUR_PER_SENDER : campaignLimit,
        subject: email.campaign.subject,
        deferredUntil,
      });

    if (res.window === null) {
      // Every window in the lookahead is full: park the job at the end of it and try again then.
      await job.updateData({ emailId });
      notify(res.reason === 'campaign' ? 'campaign' : 'sender', null);
      return deferJob(job, token, emailId, windowStart(currentWindow + env.RATE_LIMIT_MAX_LOOKAHEAD_HOURS), true);
    }

    await job.updateData({ emailId, reservedWindow: res.window });
    reservedWindow = res.window;

    if (res.window > currentWindow) {
      // Limit was already full: spread deferred jobs across the target window in
      // reservation order, so the original ordering is preserved.
      const offset = Math.min((res.senderCount - 1) * env.MIN_DELAY_BETWEEN_SENDS_MS, HOUR_MS - 60_000);
      const runAt = windowStart(res.window) + offset;
      notify(res.reason === 'campaign' ? 'campaign' : 'sender', new Date(windowStart(res.window)));
      log.info(`Email ${emailId} deferred to ${new Date(runAt).toISOString()} (${res.reason} limit)`);
      return deferJob(job, token, emailId, runAt, true);
    }

    // This send is the one that fills the limit: notify right away.
    if (res.senderCount >= env.MAX_EMAILS_PER_HOUR_PER_SENDER) {
      notify('sender', new Date(windowStart(currentWindow + 1)));
    } else if (res.campaignCount >= campaignLimit) {
      notify('campaign', new Date(windowStart(currentWindow + 1)));
    }
  } else if (reservedWindow > currentWindow) {
    // Woke up early (e.g. clock skew): go back to sleep until the reserved window.
    return deferJob(job, token, emailId, windowStart(reservedWindow), false);
  }

  // ---- 2. Minimum delay between sends from the same sender ----
  const slot = await reserveSendSlot(email.senderId);
  const wait = slot - Date.now();
  if (wait > MAX_INLINE_WAIT_MS) return deferJob(job, token, emailId, slot, false);
  if (wait > 0) await sleep(wait);

  // ---- 3. Claim the row: a conditional update, so two copies of a job can never both send ----
  const claimed = await prisma.email.updateMany({
    where: { id: emailId, status: { in: ['SCHEDULED', 'SENDING'] } },
    data: { status: 'SENDING', attempts: { increment: 1 } },
  });
  if (claimed.count === 0) return { skipped: 'already-claimed' };
  void syncEmail(emailId);

  // ---- 4. Send ----
  try {
    const result = await sendMail(email.sender, email);
    await prisma.email.update({
      where: { id: emailId },
      data: {
        status: 'SENT',
        sentAt: new Date(),
        messageId: result.messageId,
        previewUrl: result.previewUrl,
        error: null,
      },
    });
    void syncEmail(emailId);
    log.info(`Sent ${emailId} to ${email.toEmail} via ${email.sender.email}`);
    return { sent: true, previewUrl: result.previewUrl };
  } catch (err) {
    const isFinalAttempt = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
    await prisma.email.update({
      where: { id: emailId },
      data: { status: isFinalAttempt ? 'FAILED' : 'SCHEDULED', error: (err as Error).message.slice(0, 1000) },
    });
    void syncEmail(emailId);
    log.warn(`Send failed for ${emailId} (attempt ${job.attemptsMade + 1})`, (err as Error).message);
    throw err;
  }
}
