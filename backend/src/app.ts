import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import { existsSync } from 'node:fs';
import path from 'node:path';
import express, { type NextFunction, type Request, type Response } from 'express';
import { ZodError } from 'zod';
import { env } from './config/env';
import { createLogger } from './lib/logger';
import { emailQueue } from './queue/emailQueue';
import { apiRouter } from './routes/api';
import { authRouter } from './routes/auth';
import { HttpError } from './utils/http';

const log = createLogger('http');

function bullBoardAuth(req: Request, res: Response, next: NextFunction) {
  if (!env.BULL_BOARD_USER) return next();
  const [scheme, encoded] = (req.headers.authorization ?? '').split(' ');
  const [user, pass] = Buffer.from(encoded ?? '', 'base64')
    .toString()
    .split(':');
  if (scheme === 'Basic' && user === env.BULL_BOARD_USER && pass === env.BULL_BOARD_PASS) return next();
  res.set('WWW-Authenticate', 'Basic realm="Bull Board"').status(401).send('Authentication required');
}

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.use(cors({ origin: env.FRONTEND_URL, credentials: true }));
  // Attachments arrive base64 encoded (10 MB of files is ~13.4 MB of JSON).
  app.use(express.json({ limit: '16mb' }));
  app.use(cookieParser());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRouter);
  app.use('/api', apiRouter);

  // Live queue dashboard
  const boardAdapter = new ExpressAdapter();
  boardAdapter.setBasePath('/admin/queues');
  createBullBoard({ queues: [new BullMQAdapter(emailQueue)], serverAdapter: boardAdapter });
  app.use('/admin/queues', bullBoardAuth, boardAdapter.getRouter());

  // In production the built React app is served by this same service (one URL,
  // same-origin cookies). Locally the Vite dev server on :5173 is used instead.
  const frontendDist = path.resolve(process.cwd(), '../frontend/dist');
  if (existsSync(path.join(frontendDist, 'index.html'))) {
    app.use(express.static(frontendDist, { index: false, maxAge: '1h' }));
    app.get(/^\/(?!api\/|admin\/).*/, (_req, res) => res.sendFile(path.join(frontendDist, 'index.html')));
  }

  app.use((_req, res) => res.status(404).json({ error: 'Not found' }));

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof ZodError) {
      return res.status(400).json({ error: 'Validation failed', details: err.flatten().fieldErrors });
    }
    if (err instanceof HttpError) return res.status(err.status).json({ error: err.message, details: err.details });
    log.error('Unhandled error', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}
