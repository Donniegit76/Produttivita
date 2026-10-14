/**
 * Utility condivise tra server e frontend per il calcolo delle settimane ISO
 * e del mese di competenza di una settimana (regola: maggioranza dei giorni).
 *
 * Tutte le date sono trattate in UTC per evitare differenze di fuso orario.
 */

export interface IsoWeek {
  weekYear: number;
  weekNumber: number;
}

export interface CalendarPeriod {
  calendarYear: number;
  calendarMonth: number; // 0 = gennaio ... 11 = dicembre
}

/** Numero di settimana ISO e anno ISO di una data. */
export function isoWeekFromDate(date: Date): IsoWeek {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7; // lunedì=1 ... domenica=7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum); // giovedì della settimana
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return { weekYear: d.getUTCFullYear(), weekNumber: weekNo };
}

/** Lunedì (UTC) della settimana ISO indicata. */
export function isoWeekStart(weekYear: number, weekNumber: number): Date {
  const jan4 = new Date(Date.UTC(weekYear, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  const mondayOfWeek1 = new Date(jan4);
  mondayOfWeek1.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));
  const start = new Date(mondayOfWeek1);
  start.setUTCDate(mondayOfWeek1.getUTCDate() + (weekNumber - 1) * 7);
  return start;
}

/** I sette giorni (UTC) della settimana ISO indicata. */
export function isoWeekDays(weekYear: number, weekNumber: number): Date[] {
  const start = isoWeekStart(weekYear, weekNumber);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    return d;
  });
}

/** Quante settimane ISO ha un anno (52 o 53). */
export function isoWeeksInYear(year: number): number {
  return isoWeekFromDate(new Date(Date.UTC(year, 11, 28))).weekNumber;
}

/**
 * Anno e mese di competenza di una settimana ISO: il mese in cui cadono
 * più giorni della settimana. In caso di parità (impossibile con 7 giorni)
 * vince il mese del primo giorno.
 */
export function weekMajorityMonth(weekYear: number, weekNumber: number): CalendarPeriod {
  const counts = new Map<string, { year: number; month: number; count: number }>();
  for (const day of isoWeekDays(weekYear, weekNumber)) {
    const key = `${day.getUTCFullYear()}-${day.getUTCMonth()}`;
    const entry = counts.get(key) ?? { year: day.getUTCFullYear(), month: day.getUTCMonth(), count: 0 };
    entry.count += 1;
    counts.set(key, entry);
  }
  let best: { year: number; month: number; count: number } | null = null;
  for (const entry of counts.values()) {
    if (!best || entry.count > best.count) best = entry;
  }
  // counts non è mai vuoto (7 giorni), ma TypeScript non lo sa
  const winner = best ?? { year: weekYear, month: 0, count: 7 };
  return { calendarYear: winner.year, calendarMonth: winner.month };
}

const pad2 = (n: number) => String(n).padStart(2, '0');

/** Etichetta leggibile del range della settimana, es. "30/03–05/04". */
export function weekRangeLabel(weekYear: number, weekNumber: number): string {
  const days = isoWeekDays(weekYear, weekNumber);
  const first = days[0];
  const last = days[6];
  return `${pad2(first.getUTCDate())}/${pad2(first.getUTCMonth() + 1)}–${pad2(last.getUTCDate())}/${pad2(last.getUTCMonth() + 1)}`;
}

/** Data ISO (YYYY-MM-DD) della settimana, per debug e API. */
export function weekRangeIso(weekYear: number, weekNumber: number): { start: string; end: string } {
  const days = isoWeekDays(weekYear, weekNumber);
  const iso = (d: Date) => `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
  return { start: iso(days[0]), end: iso(days[6]) };
}

export const MONTH_NAMES_IT = [
  'Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno',
  'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre',
];
