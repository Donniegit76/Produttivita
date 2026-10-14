import { describe, expect, it } from 'vitest';
import {
  isoWeekFromDate,
  isoWeeksInYear,
  weekMajorityMonth,
  weekRangeIso,
  weekRangeLabel,
} from '../../shared/periods';

describe('settimane ISO', () => {
  it('calcola la settimana ISO di una data', () => {
    expect(isoWeekFromDate(new Date(2026, 0, 1))).toEqual({ weekYear: 2026, weekNumber: 1 });
    expect(isoWeekFromDate(new Date(2025, 11, 29))).toEqual({ weekYear: 2026, weekNumber: 1 });
    expect(isoWeekFromDate(new Date(2026, 0, 5))).toEqual({ weekYear: 2026, weekNumber: 2 });
  });

  it('conosce gli anni da 53 settimane', () => {
    expect(isoWeeksInYear(2020)).toBe(53);
    expect(isoWeeksInYear(2026)).toBe(53);
    expect(isoWeeksInYear(2025)).toBe(52);
  });
});

describe('mese di competenza (maggioranza dei giorni)', () => {
  it('settimana 1 del 2026 (29/12-04/01) va a gennaio 2026', () => {
    expect(weekMajorityMonth(2026, 1)).toEqual({ calendarYear: 2026, calendarMonth: 0 });
  });

  it('settimana 53 del 2020 (28/12-03/01) va a dicembre 2020', () => {
    expect(weekMajorityMonth(2020, 53)).toEqual({ calendarYear: 2020, calendarMonth: 11 });
  });

  it('una settimana interamente in un mese resta in quel mese', () => {
    expect(weekMajorityMonth(2026, 14)).toEqual({ calendarYear: 2026, calendarMonth: 3 });
  });
});

describe('etichette del range', () => {
  it('produce il range leggibile e in formato ISO', () => {
    expect(weekRangeLabel(2026, 14)).toBe('30/03–05/04');
    expect(weekRangeIso(2026, 14)).toEqual({ start: '2026-03-30', end: '2026-04-05' });
  });
});
