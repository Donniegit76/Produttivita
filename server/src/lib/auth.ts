import crypto from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import type { AppConfig } from './config';

export type Role = 'admin' | 'viewer';

export interface AuthedRequest extends Request {
  role?: Role;
}

const COOKIE_NAME = 'fp_session';
const SESSION_DAYS = 30;

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) {
    // confronto fittizio per non rivelare la lunghezza
    crypto.timingSafeEqual(ba, ba);
    return false;
  }
  return crypto.timingSafeEqual(ba, bb);
}

export function roleForPassword(password: unknown, config: AppConfig): Role | null {
  if (typeof password !== 'string' || password.length === 0) return null;
  // confronto entrambe le password per non rivelare quale è sbagliata
  const isAdmin = safeEqual(password, config.adminPassword);
  const isViewer = safeEqual(password, config.viewerPassword);
  if (isAdmin) return 'admin';
  if (isViewer) return 'viewer';
  return null;
}

export function setSessionCookie(res: Response, role: Role): void {
  const payload = Buffer.from(
    JSON.stringify({ role, exp: Date.now() + SESSION_DAYS * 86400000 }),
  ).toString('base64url');
  res.cookie(COOKIE_NAME, payload, {
    signed: true,
    httpOnly: true,
    sameSite: 'lax',
    maxAge: SESSION_DAYS * 86400000,
    path: '/',
  });
}

export function clearSessionCookie(res: Response): void {
  res.clearCookie(COOKIE_NAME, { path: '/' });
}

export function readSession(req: Request): Role | null {
  const cookies = (req as Request & { signedCookies?: Record<string, string> }).signedCookies;
  const raw = cookies?.[COOKIE_NAME];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8')) as {
      role?: Role;
      exp?: number;
    };
    if (parsed.role !== 'admin' && parsed.role !== 'viewer') return null;
    if (typeof parsed.exp !== 'number' || parsed.exp < Date.now()) return null;
    return parsed.role;
  } catch {
    return null;
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const role = readSession(req);
  if (!role) {
    res.status(401).json({ error: 'Autenticazione richiesta.', code: 'UNAUTHORIZED' });
    return;
  }
  (req as AuthedRequest).role = role;
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const role = readSession(req);
  if (!role) {
    res.status(401).json({ error: 'Autenticazione richiesta.', code: 'UNAUTHORIZED' });
    return;
  }
  if (role !== 'admin') {
    res.status(403).json({ error: "Solo l'admin può modificare i dati.", code: 'FORBIDDEN' });
    return;
  }
  (req as AuthedRequest).role = role;
  next();
}
