import type { Sender } from '@prisma/client';
import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';
import { prisma } from '../lib/clients';
import { createLogger } from '../lib/logger';
import { toPlainText, toSafeHtml } from '../utils/html';

const log = createLogger('mailer');
const transporters = new Map<string, Transporter>();

function getTransporter(sender: Sender): Transporter {
  let t = transporters.get(sender.id);
  if (!t) {
    t = nodemailer.createTransport({
      host: sender.smtpHost,
      port: sender.smtpPort,
      secure: sender.smtpPort === 465,
      auth: { user: sender.smtpUser, pass: sender.smtpPass },
      pool: true,
      maxConnections: 2,
    });
    transporters.set(sender.id, t);
  }
  return t;
}

/** Attachments are identical for every email of a campaign, so keep recent ones in memory. */
const attachmentCache = new Map<string, { filename: string; contentType: string; content: Buffer }[]>();
const ATTACHMENT_CACHE_SIZE = 20;

async function campaignAttachments(campaignId: string) {
  const cached = attachmentCache.get(campaignId);
  if (cached) return cached;
  const rows = await prisma.attachment.findMany({
    where: { campaignId },
    select: { filename: true, contentType: true, data: true },
    orderBy: { createdAt: 'asc' },
  });
  const files = rows.map((r) => ({ filename: r.filename, contentType: r.contentType, content: Buffer.from(r.data) }));
  if (attachmentCache.size >= ATTACHMENT_CACHE_SIZE) {
    attachmentCache.delete(attachmentCache.keys().next().value as string);
  }
  attachmentCache.set(campaignId, files);
  return files;
}

export async function sendMail(
  sender: Sender,
  mail: { id: string; campaignId: string; toEmail: string; subject: string; body: string },
) {
  // Bodies are sanitised on the way in; toSafeHtml also handles legacy plain-text rows.
  const html = toSafeHtml(mail.body);
  const info = await getTransporter(sender).sendMail({
    from: `"${sender.name}" <${sender.email}>`,
    to: mail.toEmail,
    subject: mail.subject,
    text: toPlainText(html),
    html: `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.5">${html}</div>`,
    attachments: await campaignAttachments(mail.campaignId),
    // Deterministic Message-ID: if a crash forces a resend, receivers can dedupe on it.
    messageId: `<${mail.id}@reachinbox.local>`,
    headers: { 'X-ReachInbox-Email-Id': mail.id },
  });
  const preview = nodemailer.getTestMessageUrl(info);
  return { messageId: info.messageId, previewUrl: typeof preview === 'string' ? preview : null };
}

/**
 * Makes sure there are sender accounts to send from. Uses ETHEREAL_ACCOUNTS if
 * given, otherwise creates ETHEREAL_SENDER_COUNT fresh Ethereal accounts once
 * and stores their credentials in the DB so they are reused across restarts.
 */
export async function ensureSenders() {
  if ((await prisma.sender.count()) > 0) return;

  const configured = env.ETHEREAL_ACCOUNTS.split(',')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf(':');
      return { user: pair.slice(0, idx), pass: pair.slice(idx + 1) };
    });

  const accounts = configured.length
    ? configured
    : await Promise.all(
        Array.from({ length: env.ETHEREAL_SENDER_COUNT }, () =>
          nodemailer.createTestAccount().then((a) => ({ user: a.user, pass: a.pass })),
        ),
      );

  for (const [i, acc] of accounts.entries()) {
    await prisma.sender.upsert({
      where: { email: acc.user },
      update: {},
      create: {
        name: `Sender ${i + 1}`,
        email: acc.user,
        smtpHost: 'smtp.ethereal.email',
        smtpPort: 587,
        smtpUser: acc.user,
        smtpPass: acc.pass,
      },
    });
    log.info(`Sender ready: ${acc.user} (login at https://ethereal.email with pass ${acc.pass})`);
  }
}
