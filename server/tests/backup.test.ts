import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { createApp, type CreatedApp } from '../src/app';
import { createAutoBackup, createSnapshotCopy, pruneBackups } from '../src/services/backup';

let created: CreatedApp | null = null;
let tmpDir = '';

afterAll(() => {
  created?.close();
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('backup automatico', () => {
  it('crea una copia compressa consistente e applica la retention', () => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fastprod-backup-'));
    created = createApp({
      config: {
        dataDir: tmpDir,
        adminPassword: 'a',
        viewerPassword: 'v',
        sessionSecret: 's',
        enableBackupJob: false,
        webDistDir: path.join(tmpDir, 'no-web'),
      },
    });
    const db = created.db;

    const file = createAutoBackup(db, tmpDir, '2026-01-01');
    expect(fs.existsSync(file)).toBe(true);
    expect(file.endsWith('.sqlite.gz')).toBe(true);

    // una seconda copia vecchia viene rimossa con retention 1 giorno
    const old = createAutoBackup(db, tmpDir, '2020-01-01');
    const oldDate = new Date('2020-01-02T00:00:00Z');
    fs.utimesSync(old, oldDate, oldDate);
    const removed = pruneBackups(tmpDir, 1, new Date('2026-06-01T00:00:00Z'));
    expect(removed).toBeGreaterThanOrEqual(1);
    expect(fs.existsSync(old)).toBe(false);
    expect(fs.existsSync(file)).toBe(true);
  });

  it('crea una copia non compressa per il download', () => {
    const target = path.join(tmpDir, 'download.sqlite');
    createSnapshotCopy(created!.db, target);
    expect(fs.existsSync(target)).toBe(true);
    expect(fs.statSync(target).size).toBeGreaterThan(0);
  });
});
