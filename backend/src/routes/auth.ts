import { randomBytes } from 'node:crypto';
import { Router } from 'express';
import { OAuth2Client } from 'google-auth-library';
import { env, isProd } from '../config/env';
import { prisma } from '../lib/clients';
import { createLogger } from '../lib/logger';
import { clearSessionCookie, requireAuth, setSessionCookie } from '../middleware/auth';
import { asyncHandler } from '../utils/http';

const log = createLogger('auth');
const STATE_COOKIE = 'rb_oauth_state';
const google = new OAuth2Client(env.GOOGLE_CLIENT_ID, env.GOOGLE_CLIENT_SECRET, env.GOOGLE_CALLBACK_URL);

export const authRouter = Router();

authRouter.get('/google', (_req, res) => {
  if (!env.GOOGLE_CLIENT_ID) return res.status(500).send('Google OAuth is not configured (GOOGLE_CLIENT_ID).');
  const state = randomBytes(16).toString('hex');
  res.cookie(STATE_COOKIE, state, { httpOnly: true, sameSite: 'lax', secure: isProd, maxAge: 10 * 60 * 1000 });
  const url = google.generateAuthUrl({
    access_type: 'online',
    scope: ['openid', 'email', 'profile'],
    prompt: 'select_account',
    state,
  });
  res.redirect(url);
});

authRouter.get(
  '/google/callback',
  asyncHandler(async (req, res) => {
    const { code, state, error } = req.query as Record<string, string | undefined>;
    const fail = (reason: string) => res.redirect(`${env.FRONTEND_URL}/login?error=${encodeURIComponent(reason)}`);

    if (error) return fail(error);
    if (!code || !state || state !== req.cookies?.[STATE_COOKIE]) return fail('invalid_state');
    res.clearCookie(STATE_COOKIE);

    try {
      const { tokens } = await google.getToken(code);
      const ticket = await google.verifyIdToken({ idToken: tokens.id_token!, audience: env.GOOGLE_CLIENT_ID });
      const p = ticket.getPayload();
      if (!p?.sub || !p.email) return fail('no_profile');

      const profile = { email: p.email, name: p.name ?? p.email, avatarUrl: p.picture ?? null };
      const user = await prisma.user.upsert({
        where: { googleId: p.sub },
        update: profile,
        create: { googleId: p.sub, ...profile },
      });
      setSessionCookie(res, user.id);
      res.redirect(`${env.FRONTEND_URL}/scheduled`);
    } catch (err) {
      log.error('Google OAuth callback failed', err);
      fail('oauth_failed');
    }
  }),
);

authRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.userId } });
    if (!user) {
      clearSessionCookie(res);
      return res.status(401).json({ error: 'User not found' });
    }
    res.json({ id: user.id, email: user.email, name: user.name, avatarUrl: user.avatarUrl });
  }),
);

authRouter.post('/logout', (_req, res) => {
  clearSessionCookie(res);
  res.status(204).end();
});
