import { useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import 'chart.js/auto';
import { MONTH_NAMES_IT } from '@shared/periods';
import { useData } from '../context/DataContext';
import { useFilters } from '../context/FiltersContext';
import { matchesDepartment } from '../lib/filters';
import { formatHours, formatPercent } from '../lib/format';
import { calculateMetrics, getTopPerformer } from '../lib/kpi';

export function Yearly() {
  const { entries, technicians } = useData();
  const { departmentId, selectedYear, setSelectedYear } = useFilters();
  const now = new Date();

  const yearEntries = useMemo(
    () =>
      entries.filter(
        (entry) =>
          entry.calendarYear === selectedYear && matchesDepartment(entry.departmentId, departmentId),
      ),
    [entries, selectedYear, departmentId],
  );

  const topPerformer = useMemo(
    () => getTopPerformer(yearEntries, technicians),
    [yearEntries, technicians],
  );

  const monthlyTrend = useMemo(
    () =>
      MONTH_NAMES_IT.map((name, monthIndex) => {
        const metrics = calculateMetrics(
          yearEntries.filter((entry) => entry.calendarMonth === monthIndex),
        );
        return { name, metrics };
      }),
    [yearEntries],
  );

  const years = [now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Riepilogo annuale · {selectedYear}</h1>
          <p className="text-sm text-gray-400 mt-1">Andamento annuale delle ore e produttività complessiva.</p>
        </div>
        <select className="workshop-select" value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
          {years.map((year) => (
            <option key={year} value={year}>
              Anno {year}
            </option>
          ))}
        </select>
      </div>

      {topPerformer && (
        <div className="glass-panel trophy-card-gold p-5 sm:p-6 rounded-2xl flex items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="text-4xl">🏆</span>
            <div>
              <span className="text-xs font-bold uppercase text-amber-400">Tecnico dell'anno {selectedYear}</span>
              <h2 className="text-xl sm:text-2xl font-black text-white">{topPerformer.name}</h2>
            </div>
          </div>
          <div className="font-mono-num text-right">
            <span className="text-xs text-gray-400 block">Produttività media</span>
            <span className="text-xl sm:text-2xl font-extrabold text-amber-400">
              {formatPercent(topPerformer.metrics.productivity)}
            </span>
          </div>
        </div>
      )}

      <div className="glass-panel rounded-2xl p-4 sm:p-6">
        <h3 className="text-lg font-bold text-white mb-4">Trend mensile ore ({selectedYear})</h3>
        <div className="h-72 sm:h-80 w-full">
          <Line
            data={{
              labels: monthlyTrend.map((item) => item.name.substring(0, 3)),
              datasets: [
                {
                  label: 'Ore Fatturate',
                  data: monthlyTrend.map((item) => item.metrics.billed),
                  borderColor: '#10b981',
                  backgroundColor: 'rgba(16, 185, 129, 0.1)',
                  tension: 0.3,
                  fill: true,
                },
                {
                  label: 'Ore Lavorate',
                  data: monthlyTrend.map((item) => item.metrics.worked),
                  borderColor: '#f59e0b',
                  borderDash: [5, 5],
                  tension: 0.3,
                },
                {
                  label: 'Ore Presenza',
                  data: monthlyTrend.map((item) => item.metrics.presence),
                  borderColor: '#06b6d4',
                  borderDash: [2, 2],
                  tension: 0.3,
                },
              ],
            }}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { labels: { color: '#9ca3af' } } },
              scales: {
                x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } },
              },
            }}
          />
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-4 sm:p-6">
        <h3 className="text-lg font-bold text-white mb-4">Dettaglio per mese</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase font-bold">
                <th className="py-3 px-4">Mese</th>
                <th className="py-3 px-4 text-center">Presenza</th>
                <th className="py-3 px-4 text-center">Lavorate</th>
                <th className="py-3 px-4 text-center">Fatturate</th>
                <th className="py-3 px-4 text-center">Produttività %</th>
                <th className="py-3 px-4 text-center">Efficienza %</th>
                <th className="py-3 px-4 text-center">Resa %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50 text-sm">
              {monthlyTrend.map((item) => (
                <tr key={item.name} className="hover:bg-gray-800/20">
                  <td className="py-3 px-4 font-semibold text-white">{item.name}</td>
                  <td className="py-3 px-4 text-center font-mono-num">{formatHours(item.metrics.presence)} h</td>
                  <td className="py-3 px-4 text-center font-mono-num">{formatHours(item.metrics.worked)} h</td>
                  <td className="py-3 px-4 text-center font-mono-num text-emerald-400">{formatHours(item.metrics.billed)} h</td>
                  <td className="py-3 px-4 text-center font-mono-num">{formatPercent(item.metrics.productivity)}</td>
                  <td className="py-3 px-4 text-center font-mono-num">{formatPercent(item.metrics.efficiency)}</td>
                  <td className="py-3 px-4 text-center font-mono-num text-cyan-300">{formatPercent(item.metrics.globalRendimento)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
