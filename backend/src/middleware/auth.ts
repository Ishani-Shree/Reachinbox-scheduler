import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { env, isProd } from '../config/env';

export const SESSION_COOKIE = 'rb_session';
const SESSION_TTL_S = 7 * 24 * 3600;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function setSessionCookie(res: Response, userId: string) {
  const token = jwt.sign({ sub: userId }, env.JWT_SECRET, { expiresIn: SESSION_TTL_S });
  res.cookie(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProd,
    maxAge: SESSION_TTL_S * 1000,
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, sameSite: 'lax', secure: isProd });
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const token = req.cookies?.[SESSION_COOKIE];
  if (!token) return res.status(401).json({ error: 'Not authenticated' });
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as { sub: string };
    req.userId = payload.sub;
    next();
  } catch {
    clearSessionCookie(res);
    res.status(401).json({ error: 'Session expired' });
  }
}

/** Short-lived signed token for OAuth `state` params (CSRF protection + carries the user id). */
export const signState = (payload: object) => jwt.sign(payload, env.JWT_SECRET, { expiresIn: 600 });
export const verifyState = <T>(state: string) => jwt.verify(state, env.JWT_SECRET) as T;
