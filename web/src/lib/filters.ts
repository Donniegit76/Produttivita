import type { Entry, Technician } from './types';

export const ALL_DEPARTMENTS = 'all';

export function matchesDepartment(departmentId: string | null | undefined, selected: string): boolean {
  return selected === ALL_DEPARTMENTS || departmentId === selected;
}

/**
 * Tecnici da mostrare nelle viste di analisi: gli attivi del reparto scelto,
 * più chi ha ore nel periodo anche se ora è disattivato (storico corretto).
 */
export function selectAnalysisTechnicians(
  technicians: Technician[],
  entriesInScope: Entry[],
  selectedDepartment: string,
): Technician[] {
  const withEntries = new Set(entriesInScope.map((entry) => entry.technicianId));
  return technicians
    .filter(
      (tech) =>
        (tech.active && matchesDepartment(tech.departmentId, selectedDepartment)) || withEntries.has(tech.id),
    )
    .sort((a, b) => a.name.localeCompare(b.name, 'it'));
}
