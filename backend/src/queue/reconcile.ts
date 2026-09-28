import { prisma } from '../lib/clients';
import { createLogger } from '../lib/logger';
import { emailQueue, enqueueEmails, jobIdFor } from './emailQueue';

const log = createLogger('reconcile');

/**
 * Postgres is the source of truth for what should be sent. On worker startup,
 * make sure every unsent email still has a live job in Redis. This covers the
 * case where Redis lost data, or the API crashed between committing emails and
 * enqueueing them. Existing jobs are left alone, so nothing starts over.
 */
export async function reconcileQueue() {
  const BATCH = 500;
  let cursor: string | undefined;
  let checked = 0;
  let requeued = 0;

  for (;;) {
    const batch = await prisma.email.findMany({
      where: { status: { in: ['SCHEDULED', 'SENDING'] } },
      select: { id: true, scheduledAt: true },
      orderBy: { id: 'asc' },
      take: BATCH,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (!batch.length) break;
    cursor = batch[batch.length - 1].id;
    checked += batch.length;

    const missing: typeof batch = [];
    for (const email of batch) {
      const job = await emailQueue.getJob(jobIdFor(email.id));
      if (!job) {
        missing.push(email);
        continue;
      }
      const state = await job.getState();
      if (state === 'completed' || state === 'failed') {
        // The job finished but the row never reached a final state (crash in between).
        await job.remove();
        missing.push(email);
      }
    }
    if (missing.length) {
      await enqueueEmails(missing);
      requeued += missing.length;
    }
  }

  log.info(`Checked ${checked} pending emails, re-enqueued ${requeued}`);
}
