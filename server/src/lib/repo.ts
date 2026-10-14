import { randomUUID } from 'node:crypto';
import type { DB } from './db';
import { MONTH_NAMES_IT, weekMajorityMonth } from '../../../shared/periods';

export interface Technician {
  id: string;
  name: string;
  role: string;
  avatarColor: string;
  targetHours: number;
  active: boolean;
  createdAt: string;
}

export interface Entry {
  id: string;
  technicianId: string;
  periodType: 'week' | 'month';
  weekYear: number | null;
  weekNumber: number | null;
  calendarYear: number;
  calendarMonth: number;
  hoursPresence: number;
  hoursWorked: number;
  hoursBilled: number;
  hoursToBeBilled: number;
  notes: string;
  updatedAt: string;
}

export interface EntryInput {
  technicianId: string;
  periodType: 'week' | 'month';
  weekYear?: number | null;
  weekNumber?: number | null;
  calendarYear?: number | null;
  calendarMonth?: number | null;
  hoursPresence?: number;
  hoursWorked?: number;
  hoursBilled?: number;
  hoursToBeBilled?: number;
  notes?: string | null;
}

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface TechnicianRow {
  id: string;
  name: string;
  role: string;
  avatar_color: string;
  target_hours: number;
  active: number;
  created_at: string;
}

interface EntryRow {
  id: string;
  technician_id: string;
  period_type: 'week' | 'month';
  week_year: number | null;
  week_number: number | null;
  calendar_year: number;
  calendar_month: number;
  hours_presence: number;
  hours_worked: number;
  hours_billed: number;
  hours_to_be_billed: number;
  notes: string;
  updated_at: string;
}

const toTechnician = (row: TechnicianRow): Technician => ({
  id: row.id,
  name: row.name,
  role: row.role,
  avatarColor: row.avatar_color,
  targetHours: row.target_hours,
  active: row.active === 1,
  createdAt: row.created_at,
});

const toEntry = (row: EntryRow): Entry => ({
  id: row.id,
  technicianId: row.technician_id,
  periodType: row.period_type,
  weekYear: row.week_year,
  weekNumber: row.week_number,
  calendarYear: row.calendar_year,
  calendarMonth: row.calendar_month,
  hoursPresence: row.hours_presence,
  hoursWorked: row.hours_worked,
  hoursBilled: row.hours_billed,
  hoursToBeBilled: row.hours_to_be_billed,
  notes: row.notes,
  updatedAt: row.updated_at,
});

// ---------------------------------------------------------------- revision

export function getRevision(db: DB): number {
  const row = db.prepare("SELECT value FROM meta WHERE key = 'revision'").get() as
    | { value: string }
    | undefined;
  return row ? Number(row.value) : 0;
}

/** Incrementa la revision. Va chiamato dentro la transazione della scrittura. */
function bumpRevision(db: DB): number {
  const next = getRevision(db) + 1;
  db.prepare(
    "INSERT INTO meta (key, value) VALUES ('revision', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(String(next));
  return next;
}

// ---------------------------------------------------------------- technicians

export function listTechnicians(db: DB): Technician[] {
  const rows = db
    .prepare('SELECT * FROM technicians ORDER BY created_at ASC')
    .all() as TechnicianRow[];
  return rows.map(toTechnician);
}

function technicianName(db: DB, id: string): string {
  const row = db.prepare('SELECT name FROM technicians WHERE id = ?').get(id) as
    | { name: string }
    | undefined;
  return row?.name ?? 'il tecnico';
}

export function createTechnician(
  db: DB,
  input: { name?: string; role?: string; avatarColor?: string; targetHours?: number },
): { technician: Technician; revision: number } {
  const name = (input.name ?? '').trim();
  if (!name) throw new ApiError(400, 'INVALID_NAME', 'Il nome del tecnico è obbligatorio.');
  const technician: Technician = {
    id: randomUUID(),
    name,
    role: (input.role ?? '').trim() || 'Tecnico',
    avatarColor: input.avatarColor || '#f59e0b',
    targetHours: Number.isFinite(input.targetHours) ? Number(input.targetHours) : 40,
    active: true,
    createdAt: new Date().toISOString(),
  };
  const revision = db.transaction(() => {
    db.prepare(
      `INSERT INTO technicians (id, name, role, avatar_color, target_hours, active, created_at)
       VALUES (@id, @name, @role, @avatarColor, @targetHours, 1, @createdAt)`,
    ).run(technician);
    return bumpRevision(db);
  })();
  return { technician, revision };
}

export function updateTechnician(
  db: DB,
  id: string,
  input: { name?: string; role?: string; avatarColor?: string; targetHours?: number; active?: boolean },
): { technician: Technician; revision: number } {
  const existing = db.prepare('SELECT * FROM technicians WHERE id = ?').get(id) as
    | TechnicianRow
    | undefined;
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Tecnico non trovato.');
  const merged: Technician = {
    id,
    name: input.name !== undefined ? input.name.trim() : existing.name,
    role: input.role !== undefined ? input.role.trim() : existing.role,
    avatarColor: input.avatarColor ?? existing.avatar_color,
    targetHours:
      input.targetHours !== undefined && Number.isFinite(input.targetHours)
        ? Number(input.targetHours)
        : existing.target_hours,
    active: input.active !== undefined ? Boolean(input.active) : existing.active === 1,
    createdAt: existing.created_at,
  };
  if (!merged.name) throw new ApiError(400, 'INVALID_NAME', 'Il nome del tecnico è obbligatorio.');
  const revision = db.transaction(() => {
    db.prepare(
      `UPDATE technicians
         SET name = @name, role = @role, avatar_color = @avatarColor,
             target_hours = @targetHours, active = @active
       WHERE id = @id`,
    ).run({ ...merged, active: merged.active ? 1 : 0 });
    return bumpRevision(db);
  })();
  return { technician: merged, revision };
}

export function deleteTechnician(db: DB, id: string): number {
  const existing = db.prepare('SELECT id FROM technicians WHERE id = ?').get(id);
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Tecnico non trovato.');
  const count = db.prepare('SELECT COUNT(*) AS n FROM entries WHERE technician_id = ?').get(id) as {
    n: number;
  };
  if (count.n > 0) {
    throw new ApiError(
      409,
      'TECHNICIAN_HAS_ENTRIES',
      'Questo tecnico ha ore registrate: non si può cancellare, disattivalo per toglierlo dalle viste attive.',
    );
  }
  return db.transaction(() => {
    db.prepare('DELETE FROM technicians WHERE id = ?').run(id);
    return bumpRevision(db);
  })();
}

// ---------------------------------------------------------------- entries

export function listEntries(db: DB): Entry[] {
  const rows = db
    .prepare('SELECT * FROM entries ORDER BY calendar_year ASC, calendar_month ASC')
    .all() as EntryRow[];
  return rows.map(toEntry);
}

function nonNegative(value: unknown, field: string): number {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n < 0) {
    throw new ApiError(400, 'INVALID_HOURS', `Valore non valido per ${field}.`);
  }
  return n;
}

function resolvePeriod(
  input: EntryInput,
): { periodType: 'week' | 'month'; weekYear: number | null; weekNumber: number | null; calendarYear: number; calendarMonth: number } {
  if (input.periodType === 'week') {
    const weekYear = Number(input.weekYear);
    const weekNumber = Number(input.weekNumber);
    if (!Number.isInteger(weekYear) || !Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > 53) {
      throw new ApiError(400, 'INVALID_PERIOD', 'Settimana non valida.');
    }
    const { calendarYear, calendarMonth } = weekMajorityMonth(weekYear, weekNumber);
    return { periodType: 'week', weekYear, weekNumber, calendarYear, calendarMonth };
  }
  if (input.periodType === 'month') {
    const calendarYear = Number(input.calendarYear);
    const calendarMonth = Number(input.calendarMonth);
    if (!Number.isInteger(calendarYear) || !Number.isInteger(calendarMonth) || calendarMonth < 0 || calendarMonth > 11) {
      throw new ApiError(400, 'INVALID_PERIOD', 'Mese non valido.');
    }
    return { periodType: 'month', weekYear: null, weekNumber: null, calendarYear, calendarMonth };
  }
  throw new ApiError(400, 'INVALID_PERIOD', "periodType deve essere 'week' oppure 'month'.");
}

/**
 * Inserisce o aggiorna la riga di un tecnico per il periodo indicato.
 * Applica il blocco alla fonte: per uno stesso tecnico/anno/mese non possono
 * coesistere righe settimanali e un totale mensile.
 */
export function upsertEntry(db: DB, input: EntryInput): { entry: Entry; revision: number } {
  const techId = String(input.technicianId ?? '');
  if (!db.prepare('SELECT 1 FROM technicians WHERE id = ?').get(techId)) {
    throw new ApiError(404, 'NOT_FOUND', 'Tecnico non trovato.');
  }
  const period = resolvePeriod(input);
  const opposite = period.periodType === 'week' ? 'month' : 'week';
  const values = {
    id: randomUUID(),
    technicianId: techId,
    periodType: period.periodType,
    weekYear: period.weekYear,
    weekNumber: period.weekNumber,
    calendarYear: period.calendarYear,
    calendarMonth: period.calendarMonth,
    hoursPresence: nonNegative(input.hoursPresence, 'ore presenza'),
    hoursWorked: nonNegative(input.hoursWorked, 'ore lavorate'),
    hoursBilled: nonNegative(input.hoursBilled, 'ore fatturate'),
    hoursToBeBilled: nonNegative(input.hoursToBeBilled, 'ore da fatturare'),
    notes: (input.notes ?? '').toString(),
    updatedAt: new Date().toISOString(),
  };

  return db.transaction(() => {
    // Blocco settimane + totale mensile sullo stesso tecnico/mese
    const conflict = db
      .prepare(
        `SELECT 1 FROM entries
          WHERE technician_id = ? AND calendar_year = ? AND calendar_month = ? AND period_type = ?`,
      )
      .get(techId, period.calendarYear, period.calendarMonth, opposite);
    if (conflict) {
      const who = technicianName(db, techId);
      const month = MONTH_NAMES_IT[period.calendarMonth];
      const message =
        period.periodType === 'week'
          ? `Per ${who} a ${month} esiste già un totale mensile: aggiorna quello invece delle singole settimane.`
          : `Per ${who} a ${month} stai già inserendo le settimane: completa quelle invece di un totale mensile.`;
      throw new ApiError(409, 'PERIOD_CONFLICT', message);
    }

    const where =
      period.periodType === 'week'
        ? 'technician_id = ? AND period_type = ? AND week_year = ? AND week_number = ?'
        : 'technician_id = ? AND period_type = ? AND calendar_year = ? AND calendar_month = ?';
    const key =
      period.periodType === 'week'
        ? [techId, 'week', period.weekYear, period.weekNumber]
        : [techId, 'month', period.calendarYear, period.calendarMonth];

    const existing = db.prepare(`SELECT id FROM entries WHERE ${where}`).get(...key) as
      | { id: string }
      | undefined;

    if (existing) {
      db.prepare(
        `UPDATE entries SET
           calendar_year = @calendarYear, calendar_month = @calendarMonth,
           hours_presence = @hoursPresence, hours_worked = @hoursWorked,
           hours_billed = @hoursBilled, hours_to_be_billed = @hoursToBeBilled,
           notes = @notes, updated_at = @updatedAt
         WHERE id = @id`,
      ).run({ ...values, id: existing.id });
    } else {
      db.prepare(
        `INSERT INTO entries
           (id, technician_id, period_type, week_year, week_number, calendar_year, calendar_month,
            hours_presence, hours_worked, hours_billed, hours_to_be_billed, notes, updated_at)
         VALUES
           (@id, @technicianId, @periodType, @weekYear, @weekNumber, @calendarYear, @calendarMonth,
            @hoursPresence, @hoursWorked, @hoursBilled, @hoursToBeBilled, @notes, @updatedAt)`,
      ).run(values);
    }

    const savedId = existing ? existing.id : values.id;
    const row = db.prepare('SELECT * FROM entries WHERE id = ?').get(savedId) as EntryRow;
    return { entry: toEntry(row), revision: bumpRevision(db) };
  })();
}

export function deleteEntry(db: DB, id: string): number {
  const existing = db.prepare('SELECT id FROM entries WHERE id = ?').get(id);
  if (!existing) throw new ApiError(404, 'NOT_FOUND', 'Riga non trovata.');
  return db.transaction(() => {
    db.prepare('DELETE FROM entries WHERE id = ?').run(id);
    return bumpRevision(db);
  })();
}

// ---------------------------------------------------------------- backup

export interface BackupPayload {
  version: number;
  exportedAt: string;
  revision: number;
  technicians: Technician[];
  entries: Entry[];
}

export function exportBackup(db: DB): BackupPayload {
  return {
    version: 3,
    exportedAt: new Date().toISOString(),
    revision: getRevision(db),
    technicians: listTechnicians(db),
    entries: listEntries(db),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** Sostituisce l'intero contenuto del database con il backup fornito. */
export function restoreBackup(db: DB, payload: unknown): number {
  if (!isRecord(payload) || !Array.isArray(payload.technicians) || !Array.isArray(payload.entries)) {
    throw new ApiError(400, 'INVALID_BACKUP', 'Struttura del backup non valida.');
  }
  const technicians = payload.technicians as unknown[];
  const entries = payload.entries as unknown[];
  for (const t of technicians) {
    if (!isRecord(t) || typeof t.id !== 'string' || typeof t.name !== 'string') {
      throw new ApiError(400, 'INVALID_BACKUP', 'Tecnico non valido nel backup.');
    }
  }
  for (const e of entries) {
    if (!isRecord(e) || typeof e.technicianId !== 'string' || (e.periodType !== 'week' && e.periodType !== 'month')) {
      throw new ApiError(400, 'INVALID_BACKUP', 'Riga non valida nel backup.');
    }
  }

  const insertTech = db.prepare(
    `INSERT INTO technicians (id, name, role, avatar_color, target_hours, active, created_at)
     VALUES (@id, @name, @role, @avatarColor, @targetHours, @active, @createdAt)`,
  );
  const insertEntry = db.prepare(
    `INSERT INTO entries
       (id, technician_id, period_type, week_year, week_number, calendar_year, calendar_month,
        hours_presence, hours_worked, hours_billed, hours_to_be_billed, notes, updated_at)
     VALUES
       (@id, @technicianId, @periodType, @weekYear, @weekNumber, @calendarYear, @calendarMonth,
        @hoursPresence, @hoursWorked, @hoursBilled, @hoursToBeBilled, @notes, @updatedAt)`,
  );

  return db.transaction(() => {
    db.prepare('DELETE FROM entries').run();
    db.prepare('DELETE FROM technicians').run();
    for (const raw of technicians) {
      const t = raw as Record<string, unknown>;
      insertTech.run({
        id: String(t.id),
        name: String(t.name),
        role: String(t.role ?? ''),
        avatarColor: String(t.avatarColor ?? '#f59e0b'),
        targetHours: Number(t.targetHours ?? 40),
        active: t.active === false ? 0 : 1,
        createdAt: String(t.createdAt ?? new Date().toISOString()),
      });
    }
    for (const raw of entries) {
      const e = raw as Record<string, unknown>;
      const periodType = e.periodType as 'week' | 'month';
      const weekYear = periodType === 'week' ? Number(e.weekYear) : null;
      const weekNumber = periodType === 'week' ? Number(e.weekNumber) : null;
      let calendarYear = Number(e.calendarYear);
      let calendarMonth = Number(e.calendarMonth);
      if (periodType === 'week') {
        const derived = weekMajorityMonth(weekYear as number, weekNumber as number);
        calendarYear = derived.calendarYear;
        calendarMonth = derived.calendarMonth;
      }
      insertEntry.run({
        id: String(e.id ?? randomUUID()),
        technicianId: String(e.technicianId),
        periodType,
        weekYear,
        weekNumber,
        calendarYear,
        calendarMonth,
        hoursPresence: Number(e.hoursPresence ?? 0),
        hoursWorked: Number(e.hoursWorked ?? 0),
        hoursBilled: Number(e.hoursBilled ?? 0),
        hoursToBeBilled: Number(e.hoursToBeBilled ?? 0),
        notes: String(e.notes ?? ''),
        updatedAt: String(e.updatedAt ?? new Date().toISOString()),
      });
    }
    return bumpRevision(db);
  })();
}
