import { Worker } from 'bullmq';
import { env } from '../config/env';
import { createRedisConnection } from '../lib/clients';
import { createLogger } from '../lib/logger';
import { EMAIL_QUEUE_NAME, type EmailJobData } from './emailQueue';
import { processEmailJob } from './processor';
import { reconcileQueue } from './reconcile';

const log = createLogger('worker');

/**
 * Re-enqueues anything missing from Redis, then starts consuming the queue.
 * Used by the standalone worker process and, on hosts without background
 * workers (RUN_WORKER_IN_API=true), inside the API process.
 */
export async function startWorker() {
  await reconcileQueue();

  const worker = new Worker<EmailJobData>(EMAIL_QUEUE_NAME, processEmailJob, {
    connection: createRedisConnection(),
    concurrency: env.WORKER_CONCURRENCY,
    // Global ceiling enforced by BullMQ in Redis, across every worker instance.
    limiter: { max: env.QUEUE_LIMITER_MAX, duration: env.QUEUE_LIMITER_DURATION_MS },
  });

  worker.on('failed', (job, err) => log.warn(`Job ${job?.id} failed: ${err.message}`));
  worker.on('error', (err) => log.error('Worker error', err));

  log.info(
    `Worker started: concurrency=${env.WORKER_CONCURRENCY}, ` +
      `minDelay=${env.MIN_DELAY_BETWEEN_SENDS_MS}ms, perSenderHourly=${env.MAX_EMAILS_PER_HOUR_PER_SENDER}`,
  );
  return worker;
}
