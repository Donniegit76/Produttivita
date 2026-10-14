import type { Entry, Technician } from './types';

type Hours = Pick<Entry, 'hoursPresence' | 'hoursWorked' | 'hoursBilled' | 'hoursToBeBilled'>;

export interface Metrics {
  presence: number;
  worked: number;
  billed: number;
  toBeBilled: number;
  productivity: number;
  efficiency: number;
  globalRendimento: number;
  potentialEfficiency: number;
}

const n = (value: unknown): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

/** Stesse formule della versione precedente: compatibilità dei KPI garantita. */
export function calculateMetrics(entries: Hours[]): Metrics {
  let presence = 0;
  let worked = 0;
  let billed = 0;
  let toBeBilled = 0;
  for (const entry of entries) {
    presence += n(entry.hoursPresence);
    worked += n(entry.hoursWorked);
    billed += n(entry.hoursBilled);
    toBeBilled += n(entry.hoursToBeBilled);
  }
  return {
    presence,
    worked,
    billed,
    toBeBilled,
    productivity: presence > 0 ? (worked / presence) * 100 : 0,
    efficiency: worked > 0 ? (billed / worked) * 100 : 0,
    globalRendimento: presence > 0 ? (billed / presence) * 100 : 0,
    potentialEfficiency: worked > 0 ? ((billed + toBeBilled) / worked) * 100 : 0,
  };
}

export interface TopPerformer extends Technician {
  metrics: Metrics & { score: number };
}

/** Miglior tecnico per media pesata di produttività ed efficienza. */
export function getTopPerformer(entries: Entry[], technicians: Technician[]): TopPerformer | null {
  if (entries.length === 0) return null;
  const stats = new Map<string, { presence: number; worked: number; billed: number; toBeBilled: number }>();
  for (const entry of entries) {
    const current =
      stats.get(entry.technicianId) ?? { presence: 0, worked: 0, billed: 0, toBeBilled: 0 };
    current.presence += n(entry.hoursPresence);
    current.worked += n(entry.hoursWorked);
    current.billed += n(entry.hoursBilled);
    current.toBeBilled += n(entry.hoursToBeBilled);
    stats.set(entry.technicianId, current);
  }

  let bestId: string | null = null;
  let bestScore = -1;
  let bestMetrics: Metrics & { score: number } | null = null;
  for (const [techId, s] of stats) {
    if (s.presence <= 0 || s.worked <= 0) continue;
    const metrics = calculateMetrics([
      {
        hoursPresence: s.presence,
        hoursWorked: s.worked,
        hoursBilled: s.billed,
        hoursToBeBilled: s.toBeBilled,
      },
    ]);
    const score = metrics.productivity * 0.5 + metrics.efficiency * 0.5;
    if (score > bestScore) {
      bestScore = score;
      bestId = techId;
      bestMetrics = { ...metrics, score };
    }
  }
  if (!bestId || !bestMetrics) return null;
  const technician = technicians.find((t) => t.id === bestId);
  return technician ? { ...technician, metrics: bestMetrics } : null;
}
