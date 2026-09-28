import type { Sender } from '@prisma/client';
import nodemailer, { Transporter } from 'nodemailer';
import { env } from '../config/env';
import { prisma } from '../lib/clients';
import { createLogger } from '../lib/logger';

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

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export async function sendMail(sender: Sender, mail: { id: string; toEmail: string; subject: string; body: string }) {
  const info = await getTransporter(sender).sendMail({
    from: `"${sender.name}" <${sender.email}>`,
    to: mail.toEmail,
    subject: mail.subject,
    text: mail.body,
    html: `<div style="font-family:sans-serif;white-space:pre-wrap">${escapeHtml(mail.body)}</div>`,
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
