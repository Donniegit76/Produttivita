import path from 'node:path';

export interface AppConfig {
  port: number;
  dataDir: string;
  dbPath: string;
  adminPassword: string;
  viewerPassword: string;
  sessionSecret: string;
  backupRetentionDays: number;
  /** Disattivabile nei test per non avviare il job giornaliero. */
  enableBackupJob: boolean;
  /** Cartella dei file statici del frontend compilato. */
  webDistDir: string;
}

function resolveDataDir(): string {
  if (process.env.DATA_DIR) return path.resolve(process.env.DATA_DIR);
  return path.resolve(process.cwd(), 'data');
}

export function loadConfig(overrides: Partial<AppConfig> = {}): AppConfig {
  const dataDir = resolveDataDir();
  const base: AppConfig = {
    port: Number(process.env.PORT || 8080),
    dataDir,
    dbPath: path.join(dataDir, 'fast_prod.sqlite'),
    adminPassword: process.env.ADMIN_PASSWORD || 'admin',
    viewerPassword: process.env.VIEWER_PASSWORD || 'viewer',
    sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    backupRetentionDays: Number(process.env.BACKUP_RETENTION_DAYS || 30),
    enableBackupJob: true,
    webDistDir: process.env.WEB_DIST_DIR || path.resolve(process.cwd(), 'web/dist'),
  };
  const merged: AppConfig = { ...base, ...overrides };
  // se viene fornita una dataDir diversa e non un dbPath esplicito, ricalcola il percorso
  if (overrides.dbPath === undefined) {
    merged.dbPath = path.join(merged.dataDir, 'fast_prod.sqlite');
  }
  return merged;
}
