import type { Email, EmailStatus, Prisma, Sender } from '@prisma/client';
import { prisma } from '../lib/clients';
import { searchEmailIds } from './search';

export type EmailTab = 'scheduled' | 'sent';

export const TAB_STATUSES: Record<EmailTab, EmailStatus[]> = {
  scheduled: ['SCHEDULED', 'SENDING'],
  sent: ['SENT', 'FAILED'],
};

type EmailWithSender = Email & { sender: Pick<Sender, 'name' | 'email'> };

export const toEmailDto = (e: EmailWithSender) => ({
  id: e.id,
  campaignId: e.campaignId,
  toEmail: e.toEmail,
  subject: e.subject,
  body: e.body,
  status: e.status.toLowerCase() as Lowercase<EmailStatus>,
  scheduledAt: e.scheduledAt.toISOString(),
  originalScheduledAt: e.originalScheduledAt.toISOString(),
  sentAt: e.sentAt?.toISOString() ?? null,
  previewUrl: e.previewUrl,
  error: e.error,
  deferredCount: e.deferredCount,
  sender: { name: e.sender.name, email: e.sender.email },
});

const senderSelect = { sender: { select: { name: true, email: true } } } as const;

export async function listEmails(params: { userId: string; tab: EmailTab; q?: string; page: number; limit: number }) {
  const statuses = TAB_STATUSES[params.tab];
  const skip = (params.page - 1) * params.limit;
  // Scheduled: soonest first. Sent: most recent first.
  const orderBy: Prisma.EmailOrderByWithRelationInput[] =
    params.tab === 'scheduled' ? [{ scheduledAt: 'asc' }, { id: 'asc' }] : [{ sentAt: 'desc' }, { updatedAt: 'desc' }];

  if (params.q) {
    const hits = await searchEmailIds({
      userId: params.userId,
      q: params.q,
      statuses,
      from: skip,
      size: params.limit,
    });
    if (hits) {
      const rows = await prisma.email.findMany({
        where: { id: { in: hits.ids }, userId: params.userId },
        include: senderSelect,
      });
      const byId = new Map(rows.map((r) => [r.id, r]));
      const items = hits.ids.map((id) => byId.get(id)).filter((r): r is EmailWithSender => Boolean(r));
      return { items: items.map(toEmailDto), total: hits.total, source: 'elasticsearch' as const };
    }
  }

  const where: Prisma.EmailWhereInput = {
    userId: params.userId,
    status: { in: statuses },
    ...(params.q
      ? {
          OR: [
            { toEmail: { contains: params.q, mode: 'insensitive' } },
            { subject: { contains: params.q, mode: 'insensitive' } },
            { body: { contains: params.q, mode: 'insensitive' } },
          ],
        }
      : {}),
  };
  const [rows, total] = await Promise.all([
    prisma.email.findMany({ where, include: senderSelect, orderBy, skip, take: params.limit }),
    prisma.email.count({ where }),
  ]);
  return { items: rows.map(toEmailDto), total, source: 'postgres' as const };
}

export async function emailStats(userId: string) {
  const groups = await prisma.email.groupBy({ by: ['status'], where: { userId }, _count: { _all: true } });
  const count = (s: EmailStatus) => groups.find((g) => g.status === s)?._count._all ?? 0;
  return {
    scheduled: count('SCHEDULED') + count('SENDING'),
    sent: count('SENT'),
    failed: count('FAILED'),
  };
}

export async function getEmail(userId: string, id: string) {
  const email = await prisma.email.findFirst({ where: { id, userId }, include: senderSelect });
  return email ? toEmailDto(email) : null;
}
