import { Client as ElasticClient } from '@elastic/elasticsearch';
import { PrismaClient } from '@prisma/client';
import IORedis from 'ioredis';
import { env } from '../config/env';

export const prisma = new PrismaClient();

/** BullMQ requires maxRetriesPerRequest: null on its connections. */
export function createRedisConnection() {
  return new IORedis(env.REDIS_URL, { maxRetriesPerRequest: null });
}

/** Shared connection for app-level commands (rate limit counters, dedupe keys). */
export const redis = createRedisConnection();

export const es = new ElasticClient({
  node: env.ELASTICSEARCH_URL,
  requestTimeout: 5000,
  ...(env.ELASTICSEARCH_API_KEY ? { auth: { apiKey: env.ELASTICSEARCH_API_KEY } } : {}),
});
