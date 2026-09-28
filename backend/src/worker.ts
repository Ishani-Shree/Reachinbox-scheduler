import { Worker } from 'bullmq';
import { env } from './config/env';
import { createRedisConnection, prisma, redis } from './lib/clients';
import { createLogger } from './lib/logger';
import { EMAIL_QUEUE_NAME, emailQueue, type EmailJobData } from './queue/emailQueue';
import { processEmailJob } from './queue/processor';
import { reconcileQueue } from './queue/reconcile';

const log = createLogger('worker');

async function main() {
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

  // Graceful shutdown: stop taking jobs and let in-flight sends finish.
  // Anything interrupted is picked up again by BullMQ's stalled-job check.
  const shutdown = async (signal: string) => {
    log.info(`${signal} received, closing worker...`);
    await worker.close();
    await emailQueue.close();
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));
}

main().catch((err) => {
  log.error('Worker failed to start', err);
  process.exit(1);
});
