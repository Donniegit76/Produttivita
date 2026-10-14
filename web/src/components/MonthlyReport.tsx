import { useMemo } from 'react';
import { MONTH_NAMES_IT } from '@shared/periods';
import { useData } from '../context/DataContext';
import { useFilters } from '../context/FiltersContext';
import { ALL_DEPARTMENTS, matchesDepartment, selectAnalysisTechnicians } from '../lib/filters';
import { formatHours, formatPercent } from '../lib/format';
import { calculateMetrics, getTopPerformer } from '../lib/kpi';

/**
 * Report mensile stampabile. È l'unico contenuto visibile in stampa
 * (il resto dell'app ha la classe `no-print`).
 */
export function MonthlyReport() {
  const { departments, technicians, entries } = useData();
  const { departmentId, selectedMonth, selectedYear } = useFilters();

  const monthName = MONTH_NAMES_IT[selectedMonth];
  const departmentName =
    departmentId === ALL_DEPARTMENTS
      ? 'Tutti i reparti'
      : departments.find((d) => d.id === departmentId)?.name ?? 'Reparto';

  const monthEntries = useMemo(
    () =>
      entries.filter(
        (entry) =>
          entry.calendarYear === selectedYear &&
          entry.calendarMonth === selectedMonth &&
          matchesDepartment(entry.departmentId, departmentId),
      ),
    [entries, selectedYear, selectedMonth, departmentId],
  );

  const visibleTechnicians = useMemo(
    () => selectAnalysisTechnicians(technicians, monthEntries, departmentId),
    [technicians, monthEntries, departmentId],
  );

  const rows = useMemo(
    () =>
      visibleTechnicians.map((tech) => ({
        tech,
        metrics: calculateMetrics(monthEntries.filter((entry) => entry.technicianId === tech.id)),
      })),
    [visibleTechnicians, monthEntries],
  );

  const totals = useMemo(() => calculateMetrics(monthEntries), [monthEntries]);
  const topPerformer = useMemo(
    () => getTopPerformer(monthEntries, technicians),
    [monthEntries, technicians],
  );

  const showDepartmentColumn = departmentId === ALL_DEPARTMENTS;

  return (
    <div className="bg-white text-black p-6 text-[11px]">
      <header className="border-b-2 border-black pb-3 mb-4">
        <h1 className="text-xl font-black">Fast_Prod — Report mensile</h1>
        <p className="text-sm">
          <strong>{monthName}</strong> {selectedYear} · Reparto: <strong>{departmentName}</strong>
        </p>
        <p className="text-[10px] text-gray-600">Stampato il {new Date().toLocaleString('it-IT')}</p>
      </header>

      {topPerformer && (
        <p className="mb-4">
          🏆 <strong>Top performer del periodo:</strong> {topPerformer.name} ({topPerformer.role}) — produttività{' '}
          {formatPercent(topPerformer.metrics.productivity)}, efficienza{' '}
          {formatPercent(topPerformer.metrics.efficiency)}
        </p>
      )}

      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="text-left">Tecnico</th>
            {showDepartmentColumn && <th className="text-left">Reparto</th>}
            <th className="text-right">Presenza</th>
            <th className="text-right">Lavorate</th>
            <th className="text-right">Fatturate</th>
            <th className="text-right">Da fatturare</th>
            <th className="text-right">Produttività</th>
            <th className="text-right">Efficienza</th>
            <th className="text-right">Resa</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ tech, metrics }) => (
            <tr key={tech.id}>
              <td>
                {tech.name}
                {!tech.active ? ' (disattivato)' : ''}
              </td>
              {showDepartmentColumn && (
                <td>{departments.find((d) => d.id === tech.departmentId)?.name ?? '—'}</td>
              )}
              <td className="text-right">{formatHours(metrics.presence)} h</td>
              <td className="text-right">{formatHours(metrics.worked)} h</td>
              <td className="text-right">{formatHours(metrics.billed)} h</td>
              <td className="text-right">{formatHours(metrics.toBeBilled)} h</td>
              <td className="text-right">{formatPercent(metrics.productivity)}</td>
              <td className="text-right">{formatPercent(metrics.efficiency)}</td>
              <td className="text-right">{formatPercent(metrics.globalRendimento)}</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr>
              <td colSpan={showDepartmentColumn ? 9 : 8}>Nessun dato per il periodo selezionato.</td>
            </tr>
          )}
        </tbody>
        <tfoot>
          <tr className="font-bold">
            <td>TOTALE</td>
            {showDepartmentColumn && <td />}
            <td className="text-right">{formatHours(totals.presence)} h</td>
            <td className="text-right">{formatHours(totals.worked)} h</td>
            <td className="text-right">{formatHours(totals.billed)} h</td>
            <td className="text-right">{formatHours(totals.toBeBilled)} h</td>
            <td className="text-right">{formatPercent(totals.productivity)}</td>
            <td className="text-right">{formatPercent(totals.efficiency)}</td>
            <td className="text-right">{formatPercent(totals.globalRendimento)}</td>
          </tr>
        </tfoot>
      </table>

      <p className="text-[10px] text-gray-600 mt-6">
        Resa = ore fatturate / ore presenza. Produttività = ore lavorate / ore presenza. Efficienza = ore fatturate /
        ore lavorate.
      </p>
    </div>
  );
}
