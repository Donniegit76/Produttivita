import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import type { DB } from '../lib/db';

export function backupsDir(dataDir: string): string {
  return path.join(dataDir, 'backups');
}

function localDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Crea una copia consistente del database compressa in backups/. */
export function createAutoBackup(db: DB, dataDir: string, label = localDateKey(new Date())): string {
  const dir = backupsDir(dataDir);
  fs.mkdirSync(dir, { recursive: true });
  const tmp = path.join(dir, `.tmp-${Date.now()}.sqlite`);
  const escaped = tmp.replace(/'/g, "''");
  db.exec(`VACUUM INTO '${escaped}'`);
  const target = path.join(dir, `fast_prod_${label}.sqlite.gz`);
  fs.writeFileSync(target, zlib.gzipSync(fs.readFileSync(tmp)));
  fs.unlinkSync(tmp);
  return target;
}

/** Crea una copia consistente non compressa (per il download manuale). */
export function createSnapshotCopy(db: DB, targetPath: string): string {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  const escaped = targetPath.replace(/'/g, "''");
  db.exec(`VACUUM INTO '${escaped}'`);
  return targetPath;
}

export function pruneBackups(dataDir: string, retentionDays: number, now = new Date()): number {
  const dir = backupsDir(dataDir);
  if (!fs.existsSync(dir)) return 0;
  const cutoff = now.getTime() - retentionDays * 86400000;
  let removed = 0;
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith('.sqlite.gz')) continue;
    const full = path.join(dir, file);
    if (fs.statSync(full).mtimeMs < cutoff) {
      fs.unlinkSync(full);
      removed += 1;
    }
  }
  return removed;
}

/**
 * Avvia il job di backup giornaliero alle 03:00 (ora locale del container).
 * Restituisce una funzione per fermarlo.
 */
export function startBackupScheduler(
  db: DB,
  dataDir: string,
  retentionDays: number,
): () => void {
  let lastRun = '';
  const interval = setInterval(() => {
    const now = new Date();
    const key = localDateKey(now);
    if (now.getHours() === 3 && now.getMinutes() === 0 && lastRun !== key) {
      lastRun = key;
      try {
        const file = createAutoBackup(db, dataDir, key);
        const removed = pruneBackups(dataDir, retentionDays, now);
        console.log(`[backup] creato ${path.basename(file)} (rimossi ${removed} vecchi)`);
      } catch (err) {
        console.error('[backup] errore durante il backup automatico:', err);
      }
    }
  }, 60_000);
  interval.unref();
  return () => clearInterval(interval);
}
