import { describe, expect, it } from 'vitest';
import { calculateMetrics, getTopPerformer } from '../lib/kpi';
import type { Entry, Technician } from '../lib/types';

const entry = (technicianId: string, values: Partial<Entry>): Entry => ({
  id: `${technicianId}-${Math.random()}`,
  technicianId,
  periodType: 'week',
  weekYear: 2026,
  weekNumber: 1,
  calendarYear: 2026,
  calendarMonth: 0,
  hoursPresence: 0,
  hoursWorked: 0,
  hoursBilled: 0,
  hoursToBeBilled: 0,
  notes: '',
  updatedAt: '',
  ...values,
});

const tech = (id: string, name: string): Technician => ({
  id,
  name,
  role: 'Meccanico',
  avatarColor: '#f59e0b',
  targetHours: 40,
  active: true,
  createdAt: '',
});

describe('calcolo KPI', () => {
  it('applica le formule esistenti', () => {
    const metrics = calculateMetrics([
      entry('a', { hoursPresence: 40, hoursWorked: 32, hoursBilled: 28, hoursToBeBilled: 4 }),
    ]);
    expect(metrics.productivity).toBeCloseTo(80);
    expect(metrics.efficiency).toBeCloseTo(87.5);
    expect(metrics.globalRendimento).toBeCloseTo(70);
    expect(metrics.potentialEfficiency).toBeCloseTo(100);
  });

  it('evita divisioni per zero', () => {
    const metrics = calculateMetrics([entry('a', {})]);
    expect(metrics.productivity).toBe(0);
    expect(metrics.efficiency).toBe(0);
  });
});

describe('top performer', () => {
  it('sceglie il tecnico con il punteggio più alto', () => {
    const technicians = [tech('a', 'Anna'), tech('b', 'Bruno')];
    const entries = [
      entry('a', { hoursPresence: 40, hoursWorked: 38, hoursBilled: 37 }),
      entry('b', { hoursPresence: 40, hoursWorked: 30, hoursBilled: 20 }),
    ];
    expect(getTopPerformer(entries, technicians)?.name).toBe('Anna');
  });

  it('restituisce null senza dati utili', () => {
    expect(getTopPerformer([], [tech('a', 'Anna')])).toBeNull();
  });
});
