import fs from 'node:fs';
import path from 'node:path';
import type { Express, Request, Response } from 'express';
import type { DB } from '../lib/db';
import type { AppConfig } from '../lib/config';
import type { RealtimeHub } from '../lib/realtime';
import {
  ApiError,
  createTechnician,
  deleteEntry,
  deleteTechnician,
  exportBackup,
  getRevision,
  listEntries,
  listTechnicians,
  restoreBackup,
  updateTechnician,
  upsertEntry,
  type EntryInput,
} from '../lib/repo';
import {
  clearSessionCookie,
  readSession,
  requireAdmin,
  requireAuth,
  roleForPassword,
  setSessionCookie,
} from '../lib/auth';
import { createAutoBackup, createSnapshotCopy } from '../services/backup';

export interface RouteContext {
  db: DB;
  hub: RealtimeHub;
  config: AppConfig;
}

function sendError(res: Response, err: unknown): void {
  if (err instanceof ApiError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }
  console.error('[api] errore inatteso:', err);
  res.status(500).json({ error: 'Errore interno del server.', code: 'INTERNAL' });
}

export function registerRoutes(app: Express, ctx: RouteContext): void {
  const { db, hub, config } = ctx;

  // ---- login rate limit (per IP) ------------------------------------------
  const attempts = new Map<string, { count: number; resetAt: number }>();
  const WINDOW_MS = 5 * 60_000;
  const MAX_ATTEMPTS = 10;
  function tooManyAttempts(ip: string): boolean {
    const now = Date.now();
    const entry = attempts.get(ip);
    if (!entry || entry.resetAt < now) {
      attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
      return false;
    }
    entry.count += 1;
    return entry.count > MAX_ATTEMPTS;
  }

  // ---- auth ----------------------------------------------------------------
  app.post('/api/login', (req: Request, res: Response) => {
    const ip = req.ip ?? 'unknown';
    if (tooManyAttempts(ip)) {
      res
        .status(429)
        .json({ error: 'Troppi tentativi di accesso, riprova tra qualche minuto.', code: 'RATE_LIMITED' });
      return;
    }
    const role = roleForPassword(req.body?.password, config);
    if (!role) {
      res.status(401).json({ error: 'Password non corretta.', code: 'INVALID_PASSWORD' });
      return;
    }
    attempts.delete(ip);
    setSessionCookie(res, role);
    res.json({ role });
  });

  app.post('/api/logout', (_req: Request, res: Response) => {
    clearSessionCookie(res);
    res.json({ ok: true });
  });

  app.get('/api/me', (req: Request, res: Response) => {
    const role = readSession(req);
    if (!role) {
      res.status(401).json({ error: 'Autenticazione richiesta.', code: 'UNAUTHORIZED' });
      return;
    }
    res.json({ role });
  });

  // ---- health --------------------------------------------------------------
  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ status: 'online', app: 'Fast_Prod', revision: getRevision(db), time: new Date().toISOString() });
  });

  // ---- lettura dati --------------------------------------------------------
  app.get('/api/snapshot', requireAuth, (_req: Request, res: Response) => {
    res.json({
      revision: getRevision(db),
      technicians: listTechnicians(db),
      entries: listEntries(db),
    });
  });

  app.get('/api/revision', requireAuth, (_req: Request, res: Response) => {
    res.json({ revision: getRevision(db) });
  });

  // ---- realtime (SSE) ------------------------------------------------------
  app.get('/api/events', requireAuth, (req: Request, res: Response) => {
    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders?.();
    res.write('retry: 3000\n\n');
    res.write(`event: changed\ndata: ${JSON.stringify({ revision: getRevision(db) })}\n\n`);
    hub.add(res);
    req.on('close', () => hub.remove(res));
  });

  // ---- entries -------------------------------------------------------------
  app.put('/api/entries', requireAdmin, (req: Request, res: Response) => {
    try {
      const { entry, revision } = upsertEntry(db, req.body as EntryInput);
      hub.broadcast(revision);
      res.json({ entry, revision });
    } catch (err) {
      sendError(res, err);
    }
  });

  app.delete('/api/entries/:id', requireAdmin, (req: Request, res: Response) => {
    try {
      const revision = deleteEntry(db, String(req.params.id));
      hub.broadcast(revision);
      res.json({ revision });
    } catch (err) {
      sendError(res, err);
    }
  });

  // ---- technicians ---------------------------------------------------------
  app.post('/api/technicians', requireAdmin, (req: Request, res: Response) => {
    try {
      const { technician, revision } = createTechnician(db, req.body ?? {});
      hub.broadcast(revision);
      res.status(201).json({ technician, revision });
    } catch (err) {
      sendError(res, err);
    }
  });

  app.patch('/api/technicians/:id', requireAdmin, (req: Request, res: Response) => {
    try {
      const { technician, revision } = updateTechnician(db, String(req.params.id), req.body ?? {});
      hub.broadcast(revision);
      res.json({ technician, revision });
    } catch (err) {
      sendError(res, err);
    }
  });

  app.delete('/api/technicians/:id', requireAdmin, (req: Request, res: Response) => {
    try {
      const revision = deleteTechnician(db, String(req.params.id));
      hub.broadcast(revision);
      res.json({ revision });
    } catch (err) {
      sendError(res, err);
    }
  });

  // ---- backup / restore ----------------------------------------------------
  app.get('/api/backup', requireAdmin, (_req: Request, res: Response) => {
    const payload = exportBackup(db);
    const date = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=Fast_Prod_Backup_${date}.json`);
    res.send(JSON.stringify(payload, null, 2));
  });

  app.get('/api/backup/sqlite', requireAdmin, (_req: Request, res: Response) => {
    try {
      const dir = path.join(config.dataDir, 'backups');
      const target = path.join(dir, `download_${Date.now()}.sqlite`);
      createSnapshotCopy(db, target);
      const date = new Date().toISOString().slice(0, 10);
      res.download(target, `Fast_Prod_${date}.sqlite`, () => {
        fs.rm(target, { force: true }, () => undefined);
      });
    } catch (err) {
      sendError(res, err);
    }
  });

  app.post('/api/restore', requireAdmin, (req: Request, res: Response) => {
    try {
      // backup automatico di sicurezza prima di sovrascrivere
      try {
        createAutoBackup(db, config.dataDir, `pre-restore-${Date.now()}`);
      } catch (err) {
        console.warn('[restore] backup pre-ripristino non riuscito:', err);
      }
      const revision = restoreBackup(db, req.body);
      hub.broadcast(revision);
      res.json({ ok: true, revision });
    } catch (err) {
      sendError(res, err);
    }
  });
}
