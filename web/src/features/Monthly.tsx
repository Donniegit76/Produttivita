import { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import 'chart.js/auto';
import { MONTH_NAMES_IT } from '@shared/periods';
import { TechStatCard } from '../components/TechStatCard';
import { useData } from '../context/DataContext';
import { useFilters } from '../context/FiltersContext';
import { matchesDepartment, selectAnalysisTechnicians } from '../lib/filters';
import { formatHours, formatPercent } from '../lib/format';
import { calculateMetrics, getTopPerformer, type Metrics } from '../lib/kpi';

export function Monthly() {
  const { entries, technicians } = useData();
  const { departmentId, selectedMonth, selectedYear, setSelectedMonth, setSelectedYear } = useFilters();
  const now = new Date();

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

  const topPerformer = useMemo(
    () => getTopPerformer(monthEntries, technicians),
    [monthEntries, technicians],
  );

  const breakdown = useMemo(() => {
    const visible = selectAnalysisTechnicians(technicians, monthEntries, departmentId);
    return visible
      .map((tech) => ({
        tech,
        metrics: calculateMetrics(monthEntries.filter((entry) => entry.technicianId === tech.id)) as Metrics,
      }))
      .sort((a, b) => b.metrics.productivity - a.metrics.productivity);
  }, [technicians, monthEntries, departmentId]);

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
      {
        label: 'Resa %',
        data: breakdown.map((item) => Number(item.metrics.globalRendimento.toFixed(1))),
        backgroundColor: 'rgba(6, 182, 212, 0.7)',
        borderColor: '#06b6d4',
        borderWidth: 1,
        borderRadius: 6,
      },
    ],
  };

  const years = [now.getFullYear() - 2, now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1];

  const statItems = (metrics: Metrics) => [
    { label: 'Presenza', value: `${formatHours(metrics.presence)} h`, tone: 'cyan' as const },
    { label: 'Lavorate', value: `${formatHours(metrics.worked)} h`, tone: 'gold' as const },
    { label: 'Fatturate', value: `${formatHours(metrics.billed)} h`, tone: 'green' as const },
    { label: 'Produttività', value: formatPercent(metrics.productivity), tone: 'gold' as const },
    { label: 'Efficienza', value: formatPercent(metrics.efficiency), tone: 'green' as const },
    { label: 'Resa', value: formatPercent(metrics.globalRendimento), tone: 'cyan' as const },
  ];

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Riepilogo mensile · {MONTH_NAMES_IT[selectedMonth]} {selectedYear}
          </h1>
          <p className="text-sm text-gray-400 mt-1">Analisi comparativa e classifica delle prestazioni mensili.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
          <select className="workshop-select" value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
            {MONTH_NAMES_IT.map((name, index) => (
              <option key={name} value={index}>
                {name}
              </option>
            ))}
          </select>
          <select className="workshop-select" value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
            {years.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <button onClick={() => window.print()} className="btn-dark text-xs sm:text-sm">
            🖨️ Stampa report
          </button>
        </div>
      </div>

      {topPerformer && (
        <div className="glass-panel trophy-card-gold p-5 sm:p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl trophy-badge flex items-center justify-center text-3xl">🏆</div>
            <div>
              <span className="text-xs font-bold uppercase text-amber-400">
                Top performer di {MONTH_NAMES_IT[selectedMonth]}
              </span>
              <h2 className="text-xl sm:text-2xl font-black text-white">{topPerformer.name}</h2>
              <p className="text-sm text-gray-300">{topPerformer.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-4 sm:gap-6 font-mono-num text-sm bg-gray-900/60 px-4 sm:px-5 py-3 rounded-xl border border-amber-500/20">
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

      <div className="glass-panel rounded-2xl p-4 sm:p-6">
        <h3 className="text-lg font-bold text-white mb-4">Confronto produttività, efficienza e resa</h3>
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

      <div className="glass-panel rounded-2xl p-4 sm:p-6">
        <h3 className="text-lg font-bold text-white mb-4">Dettaglio mensile tecnici</h3>

        <div className="md:hidden grid grid-cols-1 gap-3">
          {breakdown.map((item, index) => (
            <TechStatCard
              key={item.tech.id}
              name={item.tech.name}
              role={item.tech.role}
              color={item.tech.avatarColor}
              inactive={!item.tech.active}
              top={index === 0 && item.metrics.presence > 0}
              stats={statItems(item.metrics)}
            />
          ))}
          {breakdown.length === 0 && <p className="text-sm text-gray-400">Nessun dato per il periodo.</p>}
        </div>

        <div className="hidden md:block overflow-x-auto">
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
                <th className="py-3 px-4 text-center">Resa %</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50 text-sm">
              {breakdown.map((item, index) => (
                <tr key={item.tech.id} className={index === 0 && item.metrics.presence > 0 ? 'bg-amber-500/5 font-semibold' : ''}>
                  <td className="py-3 px-4 text-center font-bold text-amber-400">
                    {index === 0 ? '🥇 1°' : index === 1 ? '🥈 2°' : index === 2 ? '🥉 3°' : `${index + 1}°`}
                  </td>
                  <td className="py-3 px-4 font-bold text-white">
                    {item.tech.name}
                    {!item.tech.active && (
                      <span className="ml-2 text-[10px] px-1.5 py-0.5 rounded bg-gray-700 text-gray-300">disattivato</span>
                    )}
                  </td>
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
