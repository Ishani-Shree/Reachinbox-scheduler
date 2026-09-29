import type { Worker } from 'bullmq';
import { createApp } from './app';
import { env } from './config/env';
import { prisma } from './lib/clients';
import { createLogger } from './lib/logger';
import { startWorker } from './queue/worker';
import { ensureSenders } from './services/mailer';
import { ensureIndex } from './services/search';

const log = createLogger('server');

async function main() {
  await prisma.$connect();
  await ensureSenders();
  await ensureIndex();

  const server = createApp().listen(env.PORT, () => {
    log.info(`API listening on ${env.BACKEND_URL}`);
    log.info(`Bull Board: ${env.BACKEND_URL}/admin/queues`);
  });

  // Single-process mode for hosts without background workers (e.g. Render free plan).
  let worker: Worker | undefined;
  if (env.RUN_WORKER_IN_API) worker = await startWorker();

  const shutdown = () => {
    log.info('Shutting down API...');
    server.close(async () => {
      await worker?.close();
      await prisma.$disconnect();
      process.exit(0);
    });
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  log.error('API failed to start', err);
  process.exit(1);
});
