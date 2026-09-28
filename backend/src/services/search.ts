import type { Email, EmailStatus, Sender } from '@prisma/client';
import { env } from '../config/env';
import { es, prisma } from '../lib/clients';
import { createLogger } from '../lib/logger';

const log = createLogger('search');
const index = env.ELASTICSEARCH_INDEX;

// While Elasticsearch is down every status change would log a failure; warn at most once a minute.
let lastWarnAt = 0;
function warnThrottled(msg: string, err: unknown) {
  if (Date.now() - lastWarnAt < 60_000) return;
  lastWarnAt = Date.now();
  const e = err as Error;
  log.warn(msg, e?.message || e?.name || String(err));
}

type EmailWithSender = Email & { sender: Pick<Sender, 'name' | 'email'> };

const toDoc = (e: EmailWithSender) => ({
  userId: e.userId,
  campaignId: e.campaignId,
  toEmail: e.toEmail,
  subject: e.subject,
  body: e.body,
  status: e.status,
  senderEmail: e.sender.email,
  senderName: e.sender.name,
  scheduledAt: e.scheduledAt,
  sentAt: e.sentAt,
  createdAt: e.createdAt,
});

export async function ensureIndex() {
  try {
    if (await es.indices.exists({ index })) return;
    await es.indices.create({
      index,
      mappings: {
        properties: {
          userId: { type: 'keyword' },
          campaignId: { type: 'keyword' },
          toEmail: { type: 'text', fields: { keyword: { type: 'keyword' } } },
          subject: { type: 'text' },
          body: { type: 'text' },
          status: { type: 'keyword' },
          senderEmail: { type: 'keyword' },
          senderName: { type: 'text' },
          scheduledAt: { type: 'date' },
          sentAt: { type: 'date' },
          createdAt: { type: 'date' },
        },
      },
    });
    log.info(`Created Elasticsearch index "${index}"`);
  } catch (err) {
    warnThrottled('Elasticsearch unavailable, search will fall back to Postgres', err);
  }
}

/** Bulk index. Search is secondary to sending, so failures are logged, never thrown. */
export async function indexEmails(emails: EmailWithSender[]) {
  if (!emails.length) return;
  try {
    const operations = emails.flatMap((e) => [{ index: { _index: index, _id: e.id } }, toDoc(e)]);
    const res = await es.bulk({ operations, refresh: false });
    if (res.errors) log.warn('Some documents failed to index');
  } catch (err) {
    warnThrottled('Bulk index failed (is Elasticsearch running?)', err);
  }
}

/** Re-index one email from the DB after its status changes. */
export async function syncEmail(emailId: string) {
  const email = await prisma.email.findUnique({
    where: { id: emailId },
    include: { sender: { select: { name: true, email: true } } },
  });
  if (email) await indexEmails([email]);
}

/**
 * Full-text search over recipient, subject and body. Returns matching email
 * ids in relevance order, or null if Elasticsearch is unreachable (the caller
 * then falls back to a Postgres ILIKE query).
 */
export async function searchEmailIds(params: {
  userId: string;
  q: string;
  statuses: EmailStatus[];
  from: number;
  size: number;
}): Promise<{ ids: string[]; total: number } | null> {
  try {
    const res = await es.search({
      index,
      from: params.from,
      size: params.size,
      _source: false,
      query: {
        bool: {
          filter: [{ term: { userId: params.userId } }, { terms: { status: params.statuses } }],
          should: [
            {
              multi_match: {
                query: params.q,
                fields: ['toEmail^3', 'subject^2', 'body', 'senderName'],
                fuzziness: 'AUTO',
              },
            },
            { multi_match: { query: params.q, type: 'phrase_prefix', fields: ['subject', 'body'] } },
            {
              wildcard: {
                'toEmail.keyword': { value: `*${params.q.toLowerCase()}*`, case_insensitive: true },
              },
            },
          ],
          minimum_should_match: 1,
        },
      },
    });
    const total = typeof res.hits.total === 'number' ? res.hits.total : (res.hits.total?.value ?? 0);
    return { ids: res.hits.hits.map((h) => h._id as string), total };
  } catch (err) {
    warnThrottled('Search failed, falling back to Postgres', err);
    return null;
  }
}
