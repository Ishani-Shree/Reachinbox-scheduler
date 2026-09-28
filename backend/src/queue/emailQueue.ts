import { Queue } from 'bullmq';
import { env } from '../config/env';
import { createRedisConnection } from '../lib/clients';

export const EMAIL_QUEUE_NAME = 'email-send';

export interface EmailJobData {
  emailId: string;
  /** Hour window this job already holds a rate-limit slot in (set by the worker). */
  reservedWindow?: number;
}

export const emailQueue = new Queue<EmailJobData>(EMAIL_QUEUE_NAME, {
  connection: createRedisConnection(),
  defaultJobOptions: {
    attempts: env.JOB_ATTEMPTS,
    backoff: { type: 'exponential', delay: env.JOB_BACKOFF_MS },
    removeOnComplete: { age: 7 * 24 * 3600, count: 10000 },
    removeOnFail: { age: 14 * 24 * 3600 },
  },
});

/** BullMQ rejects purely numeric custom ids, so prefix the email uuid. */
export const jobIdFor = (emailId: string) => `email-${emailId}`;

/**
 * Enqueue one delayed job per email. The job id is derived from the email id,
 * so re-adding the same email (retry, reconciliation after a restart) is a
 * no-op while the job still exists in Redis.
 */
export async function enqueueEmails(emails: { id: string; scheduledAt: Date }[]) {
  const now = Date.now();
  const CHUNK = 500;
  for (let i = 0; i < emails.length; i += CHUNK) {
    await emailQueue.addBulk(
      emails.slice(i, i + CHUNK).map((e) => ({
        name: 'send',
        data: { emailId: e.id },
        opts: { jobId: jobIdFor(e.id), delay: Math.max(0, e.scheduledAt.getTime() - now) },
      })),
    );
  }
}
