/**
 * Schedules N emails at (roughly) the same instant to demonstrate rate
 * limiting and throttling under load.
 *
 *   npm run load-test -- --count 1000 --hourly 50 --user you@gmail.com
 *
 * Emails go to @example.com addresses via Ethereal, so nothing is delivered.
 * Watch progress in Bull Board (/admin/queues) and the dashboard.
 */
import { prisma } from '../src/lib/clients';
import { emailQueue } from '../src/queue/emailQueue';
import { createCampaign } from '../src/services/campaigns';

function arg(name: string, fallback?: string) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : fallback;
}

async function main() {
  const count = Number(arg('count', '1000'));
  const hourly = Number(arg('hourly', '100'));
  const userEmail = arg('user');

  const user = userEmail
    ? await prisma.user.findUniqueOrThrow({ where: { email: userEmail } })
    : await prisma.user.findFirstOrThrow({ orderBy: { createdAt: 'asc' } });
  const sender = await prisma.sender.findFirstOrThrow({ orderBy: { name: 'asc' } });

  const started = Date.now();
  const { campaign } = await createCampaign(user.id, {
    senderId: sender.id,
    subject: `Load test (${count} emails)`,
    body: 'Hi there,\n\nThis is a load-test email from the ReachInbox scheduler.\n\nCheers',
    recipients: Array.from({ length: count }, (_, i) => `lead${i + 1}@example.com`),
    startAt: new Date(),
    delayBetweenSeconds: 0,
    hourlyLimit: hourly,
  });

  console.log(`Scheduled ${campaign.totalRecipients} emails for ${user.email} via ${sender.email}`);
  console.log(`Hourly limit ${hourly}: expect ~${Math.ceil(count / hourly)} hour windows`);
  console.log(`Took ${Date.now() - started}ms. Campaign ${campaign.id}`);

  await emailQueue.close();
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
