import fs from 'node:fs';
import path from 'node:path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type Express } from 'express';
import { loadConfig, type AppConfig } from './lib/config';
import { openDatabase, type DB } from './lib/db';
import { RealtimeHub } from './lib/realtime';
import { registerRoutes } from './routes';
import { startBackupScheduler } from './services/backup';

export interface CreateAppOptions {
  config?: Partial<AppConfig>;
  db?: DB;
}

export interface CreatedApp {
  app: Express;
  db: DB;
  hub: RealtimeHub;
  config: AppConfig;
  close: () => void;
}

export function createApp(options: CreateAppOptions = {}): CreatedApp {
  const config = loadConfig(options.config);
  const db = options.db ?? openDatabase(config.dbPath);
  const hub = new RealtimeHub();

  const app = express();
  app.set('trust proxy', true);
  app.use(cors({ origin: true, credentials: true }));
  app.use(express.json({ limit: '20mb' }));
  app.use(cookieParser(config.sessionSecret));

  registerRoutes(app, { db, hub, config });

  // Frontend compilato (Vite build): in sviluppo è servito da Vite con proxy /api
  if (fs.existsSync(config.webDistDir)) {
    app.use(express.static(config.webDistDir));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/')) {
        next();
        return;
      }
      res.sendFile(path.join(config.webDistDir, 'index.html'));
    });
  }

  const heartbeat = setInterval(() => hub.heartbeat(), 25_000);
  heartbeat.unref();

  const stopBackup = config.enableBackupJob
    ? startBackupScheduler(db, config.dataDir, config.backupRetentionDays)
    : () => undefined;

  const close = () => {
    clearInterval(heartbeat);
    stopBackup();
    hub.closeAll();
    db.close();
  };

  return { app, db, hub, config, close };
}
