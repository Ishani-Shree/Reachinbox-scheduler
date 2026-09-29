import 'dotenv/config';
import { z } from 'zod';

const int = (def: number) => z.coerce.number().int().positive().default(def);
const bool = (def: boolean) =>
  z
    .enum(['true', 'false'])
    .default(def ? 'true' : 'false')
    .transform((v) => v === 'true');

// On Render the public URL is provided as RENDER_EXTERNAL_URL. The frontend is
// served by the same service, so it doubles as FRONTEND_URL.
const publicUrl = process.env.RENDER_EXTERNAL_URL;

const schema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: int(4000),
  BACKEND_URL: z
    .string()
    .url()
    .default(publicUrl ?? 'http://localhost:4000'),
  FRONTEND_URL: z
    .string()
    .url()
    .default(publicUrl ?? 'http://localhost:5173'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),

  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().default('redis://localhost:6380'),
  ELASTICSEARCH_URL: z.string().default('http://localhost:9200'),
  ELASTICSEARCH_INDEX: z.string().default('emails'),
  /** Needed for Elastic Cloud; leave empty for the local Docker container. */
  ELASTICSEARCH_API_KEY: z.string().default(''),

  GOOGLE_CLIENT_ID: z.string().default(''),
  GOOGLE_CLIENT_SECRET: z.string().default(''),
  /** Defaults to BACKEND_URL + /api/auth/google/callback */
  GOOGLE_CALLBACK_URL: z.string().default(''),

  SLACK_CLIENT_ID: z.string().default(''),
  SLACK_CLIENT_SECRET: z.string().default(''),
  /** Defaults to BACKEND_URL + /api/slack/oauth/callback (Slack requires HTTPS). */
  SLACK_REDIRECT_URI: z.string().default(''),

  ETHEREAL_ACCOUNTS: z.string().default(''),
  ETHEREAL_SENDER_COUNT: int(3),

  /** Run the BullMQ worker inside the API process (hosts without background workers). */
  RUN_WORKER_IN_API: bool(false),
  WORKER_CONCURRENCY: int(5),
  MIN_DELAY_BETWEEN_SENDS_MS: z.coerce.number().int().min(0).default(2000),
  MAX_EMAILS_PER_HOUR_PER_SENDER: int(200),
  QUEUE_LIMITER_MAX: int(50),
  QUEUE_LIMITER_DURATION_MS: int(1000),
  RATE_LIMIT_MAX_LOOKAHEAD_HOURS: int(720),
  JOB_ATTEMPTS: int(3),
  JOB_BACKOFF_MS: int(5000),

  BULL_BOARD_USER: z.string().default(''),
  BULL_BOARD_PASS: z.string().default(''),
});

// Treat empty values (e.g. `BACKEND_URL=` in .env) as unset so defaults apply.
const parsed = schema.safeParse(Object.fromEntries(Object.entries(process.env).filter(([, v]) => v !== '')));
if (!parsed.success) {
  console.error('Invalid environment configuration:');
  for (const issue of parsed.error.issues) console.error(`  ${issue.path.join('.')}: ${issue.message}`);
  process.exit(1);
}

export const env = {
  ...parsed.data,
  GOOGLE_CALLBACK_URL: parsed.data.GOOGLE_CALLBACK_URL || `${parsed.data.BACKEND_URL}/api/auth/google/callback`,
  SLACK_REDIRECT_URI: parsed.data.SLACK_REDIRECT_URI || `${parsed.data.BACKEND_URL}/api/slack/oauth/callback`,
};
export const isProd = env.NODE_ENV === 'production';
