import { useMemo, useState } from 'react';
import { MONTH_NAMES_IT, weekMajorityMonth, weekRangeLabel } from '@shared/periods';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import type { Entry, Technician } from '../lib/types';
import { currentIsoWeek, formatHours, formatPercent, initials } from '../lib/format';
import { calculateMetrics, getTopPerformer } from '../lib/kpi';

type Mode = 'week' | 'month';

const FIELDS = [
  { key: 'hoursPresence', label: 'Ore Presenza (Op)', className: '' },
  { key: 'hoursWorked', label: 'Ore Lavorate (Ol)', className: 'text-amber-300' },
  { key: 'hoursBilled', label: 'Ore Fatturate (Of)', className: 'text-emerald-300 font-bold' },
  { key: 'hoursToBeBilled', label: 'Da Fatturare (Odf)', className: 'text-purple-300' },
] as const;

type FieldKey = (typeof FIELDS)[number]['key'];

const emptyEntry = (techId: string): Entry => ({
  id: `local:empty:${techId}`,
  technicianId: techId,
  periodType: 'week',
  weekYear: null,
  weekNumber: null,
  calendarYear: 0,
  calendarMonth: 0,
  hoursPresence: 0,
  hoursWorked: 0,
  hoursBilled: 0,
  hoursToBeBilled: 0,
  notes: '',
  updatedAt: '',
});

export function Weekly() {
  const { role } = useAuth();
  const { entries, activeTechnicians, queueEntrySave, deleteEntry, connected, saveState } = useData();

  const now = new Date();
  const current = currentIsoWeek();
  const [mode, setMode] = useState<Mode>('week');
  const [weekYear, setWeekYear] = useState(current.weekYear);
  const [weekNumber, setWeekNumber] = useState(current.weekNumber);
  const [calendarYear, setCalendarYear] = useState(now.getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(now.getMonth());

  const editable = role === 'admin' && connected;

  const periodEntries = useMemo(() => {
    if (mode === 'week') {
      return entries.filter(
        (entry) => entry.periodType === 'week' && entry.weekYear === weekYear && entry.weekNumber === weekNumber,
      );
    }
    return entries.filter(
      (entry) => entry.periodType === 'month' && entry.calendarYear === calendarYear && entry.calendarMonth === calendarMonth,
    );
  }, [entries, mode, weekYear, weekNumber, calendarYear, calendarMonth]);

  const metrics = useMemo(() => calculateMetrics(periodEntries), [periodEntries]);
  const topPerformer = useMemo(() => getTopPerformer(periodEntries, activeTechnicians), [periodEntries, activeTechnicians]);

  const dataFor = (techId: string): Entry => periodEntries.find((entry) => entry.technicianId === techId) ?? emptyEntry(techId);

  const period = mode === 'week'
    ? { periodType: 'week' as const, weekYear, weekNumber }
    : { periodType: 'month' as const, calendarYear, calendarMonth };

  const update = (techId: string, field: FieldKey, raw: string) => {
    const currentData = dataFor(techId);
    const value = raw === '' ? 0 : Math.max(0, Number.parseFloat(raw) || 0);
    queueEntrySave({
      technicianId: techId,
      ...period,
      hoursPresence: currentData.hoursPresence,
      hoursWorked: currentData.hoursWorked,
      hoursBilled: currentData.hoursBilled,
      hoursToBeBilled: currentData.hoursToBeBilled,
      notes: currentData.notes,
      [field]: value,
    });
  };

  const updateNotes = (techId: string, notes: string) => {
    const currentData = dataFor(techId);
    queueEntrySave({
      technicianId: techId,
      ...period,
      hoursPresence: currentData.hoursPresence,
      hoursWorked: currentData.hoursWorked,
      hoursBilled: currentData.hoursBilled,
      hoursToBeBilled: currentData.hoursToBeBilled,
      notes,
    });
  };

  const clearRow = (tech: Technician) => {
    const existing = periodEntries.find((entry) => entry.technicianId === tech.id);
    if (existing && !existing.id.startsWith('local:')) void deleteEntry(existing.id);
    else {
      queueEntrySave({
        technicianId: tech.id,
        ...period,
        hoursPresence: 0,
        hoursWorked: 0,
        hoursBilled: 0,
        hoursToBeBilled: 0,
        notes: '',
      });
    }
  };

  const majority = mode === 'week' ? weekMajorityMonth(weekYear, weekNumber) : null;

  return (
    <div className="space-y-8">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-extrabold text-white tracking-tight">Inserimento ore</h1>
          <p className="text-sm text-gray-400 mt-1">
            Inserisci le ore <strong>per settimana</strong> oppure, se preferisci, un <strong>totale mensile</strong>.
            I dati si salvano da soli e si aggiornano su tutti i dispositivi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex bg-gray-900/60 border border-gray-800 rounded-xl p-1">
            <button
              onClick={() => setMode('week')}
              className={`px-3 py-1.5 rounded-lg text-sm ${mode === 'week' ? 'bg-amber-500 text-black font-bold' : 'text-gray-300'}`}
            >
              Settimanale
            </button>
            <button
              onClick={() => setMode('month')}
              className={`px-3 py-1.5 rounded-lg text-sm ${mode === 'month' ? 'bg-amber-500 text-black font-bold' : 'text-gray-300'}`}
            >
              Mensile
            </button>
          </div>

          {mode === 'week' ? (
            <>
              <button onClick={() => setWeekNumber((w) => Math.max(1, w - 1))} className="btn-dark text-sm">
                ←
              </button>
              <select className="workshop-select" value={weekNumber} onChange={(e) => setWeekNumber(Number(e.target.value))}>
                {Array.from({ length: 53 }, (_, i) => i + 1).map((w) => (
                  <option key={w} value={w}>
                    Settimana {w}
                  </option>
                ))}
              </select>
              <select className="workshop-select" value={weekYear} onChange={(e) => setWeekYear(Number(e.target.value))}>
                {[weekYear - 1, weekYear, weekYear + 1].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
              <button onClick={() => setWeekNumber((w) => Math.min(53, w + 1))} className="btn-dark text-sm">
                →
              </button>
            </>
          ) : (
            <>
              <select className="workshop-select" value={calendarMonth} onChange={(e) => setCalendarMonth(Number(e.target.value))}>
                {MONTH_NAMES_IT.map((name, index) => (
                  <option key={name} value={index}>
                    {name}
                  </option>
                ))}
              </select>
              <select className="workshop-select" value={calendarYear} onChange={(e) => setCalendarYear(Number(e.target.value))}>
                {[calendarYear - 1, calendarYear, calendarYear + 1].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>

      {mode === 'week' && majority && (
        <p className="text-xs text-gray-400">
          Settimana {weekNumber} · {weekRangeLabel(weekYear, weekNumber)} → conta nel mese di{' '}
          <strong className="text-amber-300">
            {MONTH_NAMES_IT[majority.calendarMonth]} {majority.calendarYear}
          </strong>
        </p>
      )}

      {saveState.status === 'error' && saveState.message && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-200 text-sm rounded-xl px-4 py-3">
          {saveState.message}
        </div>
      )}

      {topPerformer && (
        <div className="glass-panel p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-3xl">🏆</span>
            <div>
              <span className="text-xs font-bold uppercase text-amber-400">Top performer del periodo</span>
              <p className="text-lg font-extrabold text-white">
                {topPerformer.name} ({topPerformer.role})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4 font-mono-num text-sm">
            <span className="text-amber-400">{formatPercent(topPerformer.metrics.productivity)}</span>
            <span className="text-emerald-400">{formatPercent(topPerformer.metrics.efficiency)}</span>
          </div>
        </div>
      )}

      <div className="glass-panel rounded-2xl p-6">
        {activeTechnicians.length === 0 ? (
          <p className="text-sm text-gray-400">Nessun tecnico attivo: aggiungine uno nella sezione Tecnici.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-xs uppercase font-bold tracking-wider">
                  <th className="py-3 px-4 min-w-[200px]">Tecnico</th>
                  {FIELDS.map((field) => (
                    <th key={field.key} className="py-3 px-4 w-32 text-center">
                      {field.label}
                    </th>
                  ))}
                  <th className="py-3 px-4 text-center">Produttività %</th>
                  <th className="py-3 px-4 text-center">Efficienza %</th>
                  <th className="py-3 px-4 min-w-[180px]">Note</th>
                  {editable && <th className="py-3 px-4 w-16 text-center"> </th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50 text-sm">
                {activeTechnicians.map((tech) => {
                  const data = dataFor(tech.id);
                  const prod = data.hoursPresence > 0 ? (data.hoursWorked / data.hoursPresence) * 100 : 0;
                  const eff = data.hoursWorked > 0 ? (data.hoursBilled / data.hoursWorked) * 100 : 0;
                  return (
                    <tr key={tech.id} className="hover:bg-gray-800/20">
                      <td className="py-3 px-4 font-semibold text-white">
                        <div className="flex items-center space-x-2">
                          <div
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-black"
                            style={{ backgroundColor: tech.avatarColor }}
                          >
                            {initials(tech.name)}
                          </div>
                          <span>{tech.name}</span>
                          {topPerformer?.id === tech.id && <span title="Top performer">🏆</span>}
                        </div>
                      </td>
                      {FIELDS.map((field) => (
                        <td key={field.key} className="py-2 px-2">
                          <input
                            type="number"
                            step="0.5"
                            min="0"
                            inputMode="decimal"
                            disabled={!editable}
                            value={data[field.key] || ''}
                            onChange={(e) => update(tech.id, field.key, e.target.value)}
                            placeholder="0"
                            className={`workshop-input text-center ${field.className}`}
                            aria-label={`${field.label} ${tech.name}`}
                          />
                        </td>
                      ))}
                      <td className="py-3 px-4 text-center font-mono-num">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${prod >= 85 ? 'badge-green' : prod >= 70 ? 'badge-amber' : 'badge-red'}`}>
                          {formatPercent(prod)}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono-num">
                        <span className={`px-2 py-0.5 rounded text-xs font-bold ${eff >= 100 ? 'badge-green' : eff >= 85 ? 'badge-amber' : 'badge-red'}`}>
                          {formatPercent(eff)}
                        </span>
                      </td>
                      <td className="py-2 px-2">
                        <input
                          type="text"
                          disabled={!editable}
                          value={data.notes || ''}
                          onChange={(e) => updateNotes(tech.id, e.target.value)}
                          placeholder="Note o commesse..."
                          className="workshop-input text-xs"
                          aria-label={`Note ${tech.name}`}
                        />
                      </td>
                      {editable && (
                        <td className="py-2 px-2 text-center">
                          <button
                            onClick={() => clearRow(tech)}
                            title="Azzera questa riga"
                            className="text-gray-500 hover:text-rose-400"
                          >
                            🗑️
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-700 font-bold text-white bg-gray-900/60">
                  <td className="py-3 px-4">
                    TOTALE {mode === 'week' ? `SETTIMANA ${weekNumber}` : MONTH_NAMES_IT[calendarMonth].toUpperCase()}
                  </td>
                  <td className="py-3 px-4 text-center font-mono-num text-cyan-400">{formatHours(metrics.presence)} h</td>
                  <td className="py-3 px-4 text-center font-mono-num text-amber-400">{formatHours(metrics.worked)} h</td>
                  <td className="py-3 px-4 text-center font-mono-num text-emerald-400">{formatHours(metrics.billed)} h</td>
                  <td className="py-3 px-4 text-center font-mono-num text-purple-400">{formatHours(metrics.toBeBilled)} h</td>
                  <td className="py-3 px-4 text-center font-mono-num text-amber-400">{formatPercent(metrics.productivity)}</td>
                  <td className="py-3 px-4 text-center font-mono-num text-emerald-400">{formatPercent(metrics.efficiency)}</td>
                  <td className="py-3 px-4 text-xs text-gray-400 italic" colSpan={editable ? 2 : 1}>
                    {connected ? 'Salvataggio automatico attivo' : 'Server non raggiungibile'}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
