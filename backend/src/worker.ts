import { prisma, redis } from './lib/clients';
import { createLogger } from './lib/logger';
import { emailQueue } from './queue/emailQueue';
import { startWorker } from './queue/worker';

const log = createLogger('worker');

async function main() {
  const worker = await startWorker();

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
