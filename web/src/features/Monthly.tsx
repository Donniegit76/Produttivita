import { useMemo, useState } from 'react';
import { Bar } from 'react-chartjs-2';
import 'chart.js/auto';
import { MONTH_NAMES_IT } from '@shared/periods';
import { useData } from '../context/DataContext';
import { formatHours, formatPercent } from '../lib/format';
import { calculateMetrics, getTopPerformer, type Metrics } from '../lib/kpi';

export function Monthly() {
  const { entries, activeTechnicians } = useData();
  const now = new Date();
  const [calendarYear, setCalendarYear] = useState(now.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth());

  const monthEntries = useMemo(
    () =>
      entries.filter(
        (entry) => entry.calendarYear === calendarYear && entry.calendarMonth === calendarMonth,
      ),
    [entries, calendarYear, calendarMonth],
  );

  const topPerformer = useMemo(
    () => getTopPerformer(monthEntries, activeTechnicians),
    [monthEntries, activeTechnicians],
  );

  const breakdown = useMemo(() => {
    return activeTechnicians
      .map((tech) => ({
        tech,
        metrics: calculateMetrics(monthEntries.filter((entry) => entry.technicianId === tech.id)) as Metrics,
      }))
      .sort((a, b) => b.metrics.productivity - a.metrics.productivity);
  }, [activeTechnicians, monthEntries]);

  const chartData = {
    labels: breakdown.map((item) => item.tech.name),
    datasets: [
      {
        label: 'Produttività %',
        data: breakdown.map((item) => Number(item.metrics.productivity.toFixed(1))),
        backgroundColor: 'rgba(245, 158, 11, 0.7)',
        borderColor: '#f59e0b',
        borderWidth: 1,
        borderRadius: 6,
      },
      {
        label: 'Efficienza %',
        data: breakdown.map((item) => Number(item.metrics.efficiency.toFixed(1))),
        backgroundColor: 'rgba(16, 185, 129, 0.7)',
        borderColor: '#10b981',
        borderWidth: 1,
        borderRadius: 6,
      },
    ],
  };

  const years = [now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">
            Riepilogo mensile · {MONTH_NAMES_IT[calendarMonth]} {calendarYear}
          </h1>
          <p className="text-sm text-gray-400 mt-1">Analisi comparativa e classifica delle prestazioni mensili.</p>
        </div>
        <div className="flex items-center gap-3">
          <select className="workshop-select" value={calendarMonth} onChange={(e) => setCalendarMonth(Number(e.target.value))}>
            {MONTH_NAMES_IT.map((name, index) => (
              <option key={name} value={index}>
                {name}
              </option>
            ))}
          </select>
          <select className="workshop-select" value={calendarYear} onChange={(e) => setCalendarYear(Number(e.target.value))}>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
        </div>
      </div>

      {topPerformer && (
        <div className="glass-panel trophy-card-gold p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-2xl trophy-badge flex items-center justify-center text-3xl">🏆</div>
            <div>
              <span className="text-xs font-bold uppercase text-amber-400">
                Top performer di {MONTH_NAMES_IT[calendarMonth]}
              </span>
              <h2 className="text-2xl font-black text-white">{topPerformer.name}</h2>
              <p className="text-sm text-gray-300">{topPerformer.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-6 font-mono-num text-sm bg-gray-900/60 px-5 py-3 rounded-xl border border-amber-500/20">
            <div>
              <span className="text-xs text-gray-400 block uppercase">Produttività</span>
              <span className="text-lg font-bold text-amber-400">{formatPercent(topPerformer.metrics.productivity)}</span>
            </div>
            <div className="h-8 w-px bg-gray-800" />
            <div>
              <span className="text-xs text-gray-400 block uppercase">Efficienza</span>
              <span className="text-lg font-bold text-emerald-400">{formatPercent(topPerformer.metrics.efficiency)}</span>
            </div>
          </div>
        </div>
      )}

      <div className="glass-panel rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">Confronto produttività ed efficienza tecnici</h3>
        <div className="h-72 w-full">
          <Bar
            data={chartData}
            options={{
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { labels: { color: '#9ca3af' } } },
              scales: {
                x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } },
                y: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' }, max: 120 },
              },
            }}
          />
        </div>
      </div>

      <div className="glass-panel rounded-2xl p-6">
        <h3 className="text-lg font-bold text-white mb-4">Dettaglio mensile tecnici</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase font-bold">
                <th className="py-3 px-4">Posizione</th>
                <th className="py-3 px-4">Tecnico</th>
                <th className="py-3 px-4 text-center">Presenza</th>
                <th className="py-3 px-4 text-center">Lavorate</th>
                <th className="py-3 px-4 text-center">Fatturate</th>
                <th className="py-3 px-4 text-center">Produttività %</th>
                <th className="py-3 px-4 text-center">Efficienza %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50 text-sm">
              {breakdown.map((item, index) => (
                <tr key={item.tech.id} className={index === 0 && item.metrics.presence > 0 ? 'bg-amber-500/5 font-semibold' : ''}>
                  <td className="py-3 px-4 text-center font-bold text-amber-400">
                    {index === 0 ? '🥇 1°' : index === 1 ? '🥈 2°' : index === 2 ? '🥉 3°' : `${index + 1}°`}
                  </td>
                  <td className="py-3 px-4 font-bold text-white">{item.tech.name}</td>
                  <td className="py-3 px-4 text-center font-mono-num">{formatHours(item.metrics.presence)} h</td>
                  <td className="py-3 px-4 text-center font-mono-num">{formatHours(item.metrics.worked)} h</td>
                  <td className="py-3 px-4 text-center font-mono-num text-emerald-400">{formatHours(item.metrics.billed)} h</td>
                  <td className="py-3 px-4 text-center font-mono-num">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${item.metrics.productivity >= 85 ? 'badge-green' : 'badge-amber'}`}>
                      {formatPercent(item.metrics.productivity)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-center font-mono-num">
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${item.metrics.efficiency >= 100 ? 'badge-green' : 'badge-amber'}`}>
                      {formatPercent(item.metrics.efficiency)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
