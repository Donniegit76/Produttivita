import Database from 'better-sqlite3';
import { describe, expect, it } from 'vitest';
import { applyMigrations, MIGRATIONS } from '../src/lib/db';

describe('migrazione 002_departments', () => {
  it('crea il reparto predefinito e riempie i dati esistenti', () => {
    const db = new Database(':memory:');
    db.pragma('foreign_keys = ON');

    // database "vecchio": solo migrazione 001, con dati dentro
    applyMigrations(db, [MIGRATIONS[0]]);
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO technicians (id, name, role, avatar_color, target_hours, active, created_at)
       VALUES ('t1', 'Marco Rossi', 'Meccanico', '#f59e0b', 40, 1, ?)`,
    ).run(now);
    db.prepare(
      `INSERT INTO entries (id, technician_id, period_type, week_year, week_number,
                            calendar_year, calendar_month, hours_presence, hours_worked,
                            hours_billed, hours_to_be_billed, notes, updated_at)
       VALUES ('e1', 't1', 'week', 2026, 14, 2026, 3, 40, 30, 25, 2, '', ?)`,
    ).run(now);

    // applica la migrazione 002
    applyMigrations(db, [MIGRATIONS[1]]);

    const departments = db.prepare('SELECT * FROM departments').all() as {
      id: string;
      name: string;
    }[];
    expect(departments).toHaveLength(1);
    expect(departments[0].name).toBe('Generale');

    const technician = db.prepare('SELECT department_id FROM technicians WHERE id = ?').get('t1') as {
      department_id: string;
    };
    expect(technician.department_id).toBe('dept-generale');

    const entry = db.prepare('SELECT department_id FROM entries WHERE id = ?').get('e1') as {
      department_id: string;
    };
    expect(entry.department_id).toBe('dept-generale');
  });

  it('non applica due volte la stessa migrazione', () => {
    const db = new Database(':memory:');
    applyMigrations(db);
    applyMigrations(db);
    const reported = db.prepare('SELECT COUNT(*) AS n FROM departments').get() as { n: number };
    expect(reported.n).toBe(1);
  });
});
