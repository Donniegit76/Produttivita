import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export type DB = Database.Database;

interface Migration {
  id: string;
  sql: string;
}

const MIGRATIONS: Migration[] = [
  {
    id: '001_init',
    sql: `
      CREATE TABLE IF NOT EXISTS technicians (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT '',
        avatar_color TEXT NOT NULL DEFAULT '#f59e0b',
        target_hours REAL NOT NULL DEFAULT 40,
        active INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS entries (
        id TEXT PRIMARY KEY,
        technician_id TEXT NOT NULL REFERENCES technicians(id) ON DELETE RESTRICT,
        period_type TEXT NOT NULL CHECK (period_type IN ('week', 'month')),
        week_year INTEGER,
        week_number INTEGER,
        calendar_year INTEGER NOT NULL,
        calendar_month INTEGER NOT NULL CHECK (calendar_month BETWEEN 0 AND 11),
        hours_presence REAL NOT NULL DEFAULT 0,
        hours_worked REAL NOT NULL DEFAULT 0,
        hours_billed REAL NOT NULL DEFAULT 0,
        hours_to_be_billed REAL NOT NULL DEFAULT 0,
        notes TEXT NOT NULL DEFAULT '',
        updated_at TEXT NOT NULL,
        CHECK (
          (period_type = 'week' AND week_year IS NOT NULL AND week_number BETWEEN 1 AND 53)
          OR
          (period_type = 'month' AND week_year IS NULL AND week_number IS NULL)
        )
      );

      CREATE UNIQUE INDEX IF NOT EXISTS ux_entry_week
        ON entries(technician_id, week_year, week_number) WHERE period_type = 'week';
      CREATE UNIQUE INDEX IF NOT EXISTS ux_entry_month
        ON entries(technician_id, calendar_year, calendar_month) WHERE period_type = 'month';
      CREATE INDEX IF NOT EXISTS ix_entries_calendar
        ON entries(calendar_year, calendar_month);

      CREATE TABLE IF NOT EXISTS meta (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `,
  },
];

function migrate(db: DB): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL
    );
  `);
  const applied = new Set(
    db.prepare('SELECT id FROM schema_migrations').all().map((row) => (row as { id: string }).id),
  );
  const apply = db.transaction((migration: Migration) => {
    db.exec(migration.sql);
    db.prepare('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)').run(
      migration.id,
      new Date().toISOString(),
    );
  });
  for (const migration of MIGRATIONS) {
    if (!applied.has(migration.id)) apply(migration);
  }
}

/** Apre (o crea) il database, applica il pragma e le migrazioni. */
export function openDatabase(dbPath: string): DB {
  if (dbPath !== ':memory:') {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  migrate(db);
  return db;
}
