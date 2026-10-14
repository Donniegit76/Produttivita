import { describe, expect, it } from 'vitest';
import { ALL_DEPARTMENTS, matchesDepartment, selectAnalysisTechnicians } from './filters';
import type { Entry, Technician } from './types';

const tech = (id: string, name: string, departmentId: string, active = true): Technician => ({
  id,
  name,
  role: 'Meccanico',
  avatarColor: '#f59e0b',
  targetHours: 40,
  active,
  departmentId,
  createdAt: '',
});

const entry = (technicianId: string, departmentId: string): Entry => ({
  id: `${technicianId}-1`,
  technicianId,
  departmentId,
  periodType: 'week',
  weekYear: 2026,
  weekNumber: 14,
  calendarYear: 2026,
  calendarMonth: 3,
  hoursPresence: 40,
  hoursWorked: 35,
  hoursBilled: 30,
  hoursToBeBilled: 2,
  notes: '',
  updatedAt: '',
});

describe('filtro reparto', () => {
  it('"Tutti i reparti" accetta tutto', () => {
    expect(matchesDepartment('a', ALL_DEPARTMENTS)).toBe(true);
    expect(matchesDepartment(null, ALL_DEPARTMENTS)).toBe(true);
  });

  it('confronta l\'id esatto', () => {
    expect(matchesDepartment('a', 'a')).toBe(true);
    expect(matchesDepartment('b', 'a')).toBe(false);
  });
});

describe('tecnici da mostrare nelle analisi', () => {
  const technicians = [
    tech('t1', 'Anna', 'A'),
    tech('t2', 'Bruno', 'B'),
    tech('t3', 'Carla', 'A', false), // disattivata ma con ore nel periodo
    tech('t4', 'Dario', 'B', false), // disattivato senza ore
  ];
  const entries = [entry('t1', 'A'), entry('t3', 'A')];

  it('include gli attivi del reparto scelto e i disattivati con ore', () => {
    const result = selectAnalysisTechnicians(technicians, entries, 'A').map((t) => t.id);
    expect(result.sort()).toEqual(['t1', 't3']);
  });

  it('con "tutti i reparti" mostra attivi e disattivati con ore', () => {
    const result = selectAnalysisTechnicians(technicians, entries, ALL_DEPARTMENTS).map((t) => t.id);
    expect(result.sort()).toEqual(['t1', 't2', 't3']);
    expect(result).not.toContain('t4');
  });
});
