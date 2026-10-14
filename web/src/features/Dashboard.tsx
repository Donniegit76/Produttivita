import { useMemo } from 'react';
import type { TabKey } from '../components/Layout';
import { useData } from '../context/DataContext';
import { formatHours, formatPercent, initials } from '../lib/format';
import { calculateMetrics, getTopPerformer } from '../lib/kpi';

export function Dashboard({ onNavigate }: { onNavigate: (tab: TabKey) => void }) {
  const { entries, technicians, activeTechnicians } = useData();

  const globalMetrics = useMemo(() => calculateMetrics(entries), [entries]);
  const topPerformer = useMemo(() => getTopPerformer(entries, technicians), [entries, technicians]);

  const ranking = useMemo(
    () =>
      activeTechnicians
        .map((tech) => ({
          tech,
          stats: calculateMetrics(entries.filter((entry) => entry.technicianId === tech.id)),
        }))
        .sort((a, b) => b.stats.productivity - a.stats.productivity),
    [activeTechnicians, entries],
  );

  const celebrate = () => {
    // piccola animazione senza librerie esterne
    const emoji = document.createElement('div');
    emoji.textContent = '🏆';
    emoji.style.position = 'fixed';
    emoji.style.left = '50%';
    emoji.style.top = '40%';
    emoji.style.fontSize = '64px';
    emoji.style.zIndex = '9999';
    emoji.style.transition = 'all 1s ease-out';
    document.body.appendChild(emoji);
    requestAnimationFrame(() => {
      emoji.style.transform = 'translateY(-120px) scale(1.6) rotate(20deg)';
      emoji.style.opacity = '0';
    });
    setTimeout(() => emoji.remove(), 1100);
  };

  const kpiCards = [
    { label: 'Ore Presenza Totali', value: `${formatHours(globalMetrics.presence)} h`, color: 'border-l-cyan-500', icon: '⏱️' },
    { label: 'Ore Lavorate (Commessa)', value: `${formatHours(globalMetrics.worked)} h`, color: 'border-l-amber-500', icon: '🔧' },
    { label: 'Ore Fatturate', value: `${formatHours(globalMetrics.billed)} h`, color: 'border-l-emerald-500', icon: '💶' },
    { label: 'Ore da Fatturare', value: `${formatHours(globalMetrics.toBeBilled)} h`, color: 'border-l-purple-500', icon: '📋' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Dashboard Officina</h1>
          <p className="text-sm text-gray-400 mt-1">
            Panoramica completa delle ore, produttività ed efficienza della squadra.
          </p>
        </div>
        <button onClick={() => onNavigate('weekly')} className="btn-gold">
          ➕ Inserisci ore
        </button>
      </div>

      {topPerformer && (
        <div className="glass-panel trophy-card-gold p-6 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-20 h-20 rounded-2xl trophy-badge flex items-center justify-center text-4xl">🏆</div>
            <div>
              <span className="text-xs font-extrabold uppercase tracking-widest text-amber-400">
                Dipendente più produttivo del periodo
              </span>
              <h2 className="text-2xl font-black text-white mt-1">{topPerformer.name}</h2>
              <p className="text-sm text-gray-300">{topPerformer.role}</p>
            </div>
          </div>
          <div className="flex items-center gap-6 bg-slate-900/60 p-4 rounded-xl border border-amber-500/20">
            <div className="text-center px-3">
              <p className="text-xs text-gray-400 uppercase font-semibold">Produttività</p>
              <p className="text-xl font-extrabold text-amber-400 font-mono-num">
                {formatPercent(topPerformer.metrics.productivity)}
              </p>
            </div>
            <div className="h-8 w-px bg-gray-800" />
            <div className="text-center px-3">
              <p className="text-xs text-gray-400 uppercase font-semibold">Efficienza</p>
              <p className="text-xl font-extrabold text-emerald-400 font-mono-num">
                {formatPercent(topPerformer.metrics.efficiency)}
              </p>
            </div>
            <div className="h-8 w-px bg-gray-800" />
            <button onClick={celebrate} className="btn-gold text-xs">
              🎉 Festeggia
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        {kpiCards.map((card) => (
          <div key={card.label} className={`glass-panel p-5 rounded-2xl border-l-4 ${card.color}`}>
            <div className="flex justify-between items-start">
              <div>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{card.label}</p>
                <h3 className="text-3xl font-extrabold text-white mt-2 font-mono-num">{card.value}</h3>
              </div>
              <div className="text-2xl">{card.icon}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Produttività Media', value: globalMetrics.productivity, hint: '(Lavorate / Presenza)', color: 'text-amber-400' },
          { label: 'Efficienza Media', value: globalMetrics.efficiency, hint: '(Fatturate / Lavorate)', color: 'text-emerald-400' },
          { label: 'Rendimento Globale', value: globalMetrics.globalRendimento, hint: '(Fatturate / Presenza)', color: 'text-cyan-400' },
        ].map((card) => (
          <div key={card.label} className="glass-panel p-6 rounded-2xl">
            <div className="flex justify-between items-center mb-4">
              <span className={`text-sm font-bold uppercase tracking-wider ${card.color}`}>{card.label}</span>
              <span className="text-xs text-gray-500">{card.hint}</span>
            </div>
            <span className="text-4xl font-extrabold text-white font-mono-num">{formatPercent(card.value)}</span>
          </div>
        ))}
      </div>

      <div className="glass-panel rounded-2xl p-6">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-xl font-bold text-white">Classifica e rendimento tecnici</h3>
            <p className="text-xs text-gray-400">L'icona coppa 🏆 indica il tecnico più produttivo ed efficiente.</p>
          </div>
          <button onClick={() => onNavigate('technicians')} className="text-xs text-amber-400 hover:underline">
            Gestisci tecnici →
          </button>
        </div>

        {ranking.length === 0 ? (
          <p className="text-sm text-gray-400">
            Nessun tecnico attivo. Vai in <button className="text-amber-400 hover:underline" onClick={() => onNavigate('technicians')}>Tecnici</button> per aggiungerne uno.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase font-bold tracking-wider">
                  <th className="py-3 px-4">Tecnico</th>
                  <th className="py-3 px-4">Qualifica</th>
                  <th className="py-3 px-4 text-center">Presenza</th>
                  <th className="py-3 px-4 text-center">Lavorate</th>
                  <th className="py-3 px-4 text-center">Fatturate</th>
                  <th className="py-3 px-4 text-center">Da Fatturare</th>
                  <th className="py-3 px-4 text-center">Produttività %</th>
                  <th className="py-3 px-4 text-center">Efficienza %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50 text-sm">
                {ranking.map(({ tech, stats }) => {
                  const isTop = topPerformer?.id === tech.id;
                  return (
                    <tr key={tech.id} className={`hover:bg-gray-800/30 ${isTop ? 'bg-amber-500/5' : ''}`}>
                      <td className="py-3.5 px-4 font-semibold text-white">
                        <div className="flex items-center space-x-3">
                          <div
                            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-black text-black"
                            style={{ backgroundColor: tech.avatarColor }}
                          >
                            {initials(tech.name)}
                          </div>
                          <span>{tech.name}</span>
                          {isTop && <span className="trophy-badge px-2 py-0.5 rounded-full text-xs font-black">🏆 TOP</span>}
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-gray-400">{tech.role}</td>
                      <td className="py-3.5 px-4 text-center font-mono-num">{formatHours(stats.presence)} h</td>
                      <td className="py-3.5 px-4 text-center font-mono-num">{formatHours(stats.worked)} h</td>
                      <td className="py-3.5 px-4 text-center font-mono-num text-emerald-400 font-bold">
                        {formatHours(stats.billed)} h
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono-num text-purple-400">
                        {formatHours(stats.toBeBilled)} h
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono-num">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            stats.productivity >= 85 ? 'badge-green' : stats.productivity >= 70 ? 'badge-amber' : 'badge-red'
                          }`}
                        >
                          {formatPercent(stats.productivity)}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-center font-mono-num">
                        <span
                          className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                            stats.efficiency >= 100 ? 'badge-green' : stats.efficiency >= 85 ? 'badge-amber' : 'badge-red'
                          }`}
                        >
                          {formatPercent(stats.efficiency)}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
