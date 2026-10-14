import { useMemo, useState } from 'react';
import { MONTH_NAMES_IT, weekMajorityMonth, weekRangeLabel } from '@shared/periods';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useFilters } from '../context/FiltersContext';
import { matchesDepartment } from '../lib/filters';
import type { Entry } from '../lib/types';
import { currentIsoWeek, formatHours, formatPercent, initials } from '../lib/format';
import { calculateMetrics, getTopPerformer } from '../lib/kpi';

type Mode = 'week' | 'month';

const FIELDS = [
  { key: 'hoursPresence', label: 'Presenza', className: '' },
  { key: 'hoursWorked', label: 'Lavorate', className: 'text-amber-300' },
  { key: 'hoursBilled', label: 'Fatturate', className: 'text-emerald-300 font-bold' },
  { key: 'hoursToBeBilled', label: 'Da fatturare', className: 'text-purple-300' },
] as const;

type FieldKey = (typeof FIELDS)[number]['key'];

const emptyEntry = (techId: string): Entry => ({
  id: `local:empty:${techId}`,
  technicianId: techId,
  departmentId: null,
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
  const { departmentId, selectedMonth, selectedYear, setSelectedMonth, setSelectedYear } = useFilters();

  const current = currentIsoWeek();
  const [mode, setMode] = useState<Mode>('week');
  const [weekYear, setWeekYear] = useState(current.weekYear);
  const [weekNumber, setWeekNumber] = useState(current.weekNumber);

  const editable = role === 'admin' && connected;

  const visibleTechnicians = useMemo(
    () => activeTechnicians.filter((tech) => matchesDepartment(tech.departmentId, departmentId)),
    [activeTechnicians, departmentId],
  );
  const visibleIds = useMemo(() => new Set(visibleTechnicians.map((t) => t.id)), [visibleTechnicians]);

  const periodEntries = useMemo(() => {
    if (mode === 'week') {
      return entries.filter(
        (entry) =>
          entry.periodType === 'week' &&
          entry.weekYear === weekYear &&
          entry.weekNumber === weekNumber &&
          visibleIds.has(entry.technicianId),
      );
    }
    return entries.filter(
      (entry) =>
        entry.periodType === 'month' &&
        entry.calendarYear === selectedYear &&
        entry.calendarMonth === selectedMonth &&
        visibleIds.has(entry.technicianId),
    );
  }, [entries, mode, weekYear, weekNumber, selectedYear, selectedMonth, visibleIds]);

  const metrics = useMemo(() => calculateMetrics(periodEntries), [periodEntries]);
  const topPerformer = useMemo(
    () => getTopPerformer(periodEntries, activeTechnicians),
    [periodEntries, activeTechnicians],
  );

  const dataFor = (techId: string): Entry =>
    periodEntries.find((entry) => entry.technicianId === techId) ?? emptyEntry(techId);

  const period =
    mode === 'week'
      ? { periodType: 'week' as const, weekYear, weekNumber }
      : { periodType: 'month' as const, calendarYear: selectedYear, calendarMonth: selectedMonth };

  const update = (techId: string, field: FieldKey, raw: string) => {
    const data = dataFor(techId);
    const value = raw === '' ? 0 : Math.max(0, Number.parseFloat(raw) || 0);
    queueEntrySave({
      technicianId: techId,
      ...period,
      hoursPresence: data.hoursPresence,
      hoursWorked: data.hoursWorked,
      hoursBilled: data.hoursBilled,
      hoursToBeBilled: data.hoursToBeBilled,
      notes: data.notes,
      [field]: value,
    });
  };

  const updateNotes = (techId: string, notes: string) => {
    const data = dataFor(techId);
    queueEntrySave({
      technicianId: techId,
      ...period,
      hoursPresence: data.hoursPresence,
      hoursWorked: data.hoursWorked,
      hoursBilled: data.hoursBilled,
      hoursToBeBilled: data.hoursToBeBilled,
      notes,
    });
  };

  const clearRow = (techId: string) => {
    const existing = periodEntries.find((entry) => entry.technicianId === techId);
    if (existing && !existing.id.startsWith('local:')) void deleteEntry(existing.id);
    else {
      queueEntrySave({
        technicianId: techId,
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

  const renderInput = (techId: string, field: (typeof FIELDS)[number]) => {
    const data = dataFor(techId);
    const name = visibleTechnicians.find((tech) => tech.id === techId)?.name ?? '';
    return (
      <input
        type="number"
        step="0.5"
        min="0"
        inputMode="decimal"
        disabled={!editable}
        value={data[field.key] || ''}
        onChange={(event) => update(techId, field.key, event.target.value)}
        placeholder="0"
        className={`workshop-input text-center ${field.className}`}
        aria-label={`${field.label} ${name}`}
      />
    );
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Inserimento ore</h1>
          <p className="text-sm text-gray-400 mt-1">
            Per settimana oppure con un totale mensile. I dati si salvano da soli e si aggiornano su tutti i
            dispositivi.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:gap-3">
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
              <select className="workshop-select" value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))}>
                {MONTH_NAMES_IT.map((name, index) => (
                  <option key={name} value={index}>
                    {name}
                  </option>
                ))}
              </select>
              <select className="workshop-select" value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))}>
                {[selectedYear - 1, selectedYear, selectedYear + 1].map((y) => (
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
        <div className="glass-panel p-4 rounded-xl border border-amber-500/30 bg-amber-500/5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl sm:text-3xl">🏆</span>
            <div>
              <span className="text-xs font-bold uppercase text-amber-400">Top performer del periodo</span>
              <p className="text-base sm:text-lg font-extrabold text-white">
                {topPerformer.name} ({topPerformer.role})
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 font-mono-num text-sm">
            <span className="text-amber-400">{formatPercent(topPerformer.metrics.productivity)}</span>
            <span className="text-emerald-400">{formatPercent(topPerformer.metrics.efficiency)}</span>
          </div>
        </div>
      )}

      <div className="glass-panel rounded-2xl p-4 sm:p-6">
        {visibleTechnicians.length === 0 ? (
          <p className="text-sm text-gray-400">
            Nessun tecnico attivo in questo reparto: aggiungine uno nella sezione Tecnici o cambia reparto.
          </p>
        ) : (
          <>
            {/* Mobile: card per tecnico */}
            <div className="lg:hidden space-y-3">
              {visibleTechnicians.map((tech) => {
                const data = dataFor(tech.id);
                const prod = data.hoursPresence > 0 ? (data.hoursWorked / data.hoursPresence) * 100 : 0;
                const eff = data.hoursWorked > 0 ? (data.hoursBilled / data.hoursWorked) * 100 : 0;
                return (
                  <div key={tech.id} className="rounded-xl border border-gray-800 bg-gray-900/40 p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0">
                        <div
                          className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-black shrink-0"
                          style={{ backgroundColor: tech.avatarColor }}
                        >
                          {initials(tech.name)}
                        </div>
                        <span className="font-semibold text-white truncate">{tech.name}</span>
                        {topPerformer?.id === tech.id && <span>🏆</span>}
                      </div>
                      {editable && (
                        <button onClick={() => clearRow(tech.id)} title="Azzera riga" className="text-gray-500 hover:text-rose-400">
                          🗑️
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3 mt-3">
                      {FIELDS.map((field) => (
                        <label key={field.key} className="block">
                          <span className="block text-[10px] uppercase text-gray-500 mb-1">{field.label}</span>
                          {renderInput(tech.id, field)}
                        </label>
                      ))}
                    </div>
                    <label className="block mt-3">
                      <span className="block text-[10px] uppercase text-gray-500 mb-1">Note</span>
                      <input
                        type="text"
                        disabled={!editable}
                        value={data.notes || ''}
                        onChange={(event) => updateNotes(tech.id, event.target.value)}
                        placeholder="Note o commesse..."
                        className="workshop-input text-xs"
                      />
                    </label>
                    <div className="flex gap-2 mt-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${prod >= 85 ? 'badge-green' : prod >= 70 ? 'badge-amber' : 'badge-red'}`}>
                        Prod {formatPercent(prod)}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${eff >= 100 ? 'badge-green' : eff >= 85 ? 'badge-amber' : 'badge-red'}`}>
                        Eff {formatPercent(eff)}
                      </span>
                    </div>
                  </div>
                );
              })}
              <div className="rounded-xl border border-gray-700 bg-gray-900/60 p-4">
                <p className="text-xs uppercase font-bold text-gray-400 mb-2">
                  Totale {mode === 'week' ? `settimana ${weekNumber}` : MONTH_NAMES_IT[selectedMonth]}
                </p>
                <div className="grid grid-cols-2 gap-2 text-sm font-mono-num">
                  <span className="text-cyan-400">Presenza {formatHours(metrics.presence)} h</span>
                  <span className="text-amber-400">Lavorate {formatHours(metrics.worked)} h</span>
                  <span className="text-emerald-400">Fatturate {formatHours(metrics.billed)} h</span>
                  <span className="text-purple-400">Da fatt. {formatHours(metrics.toBeBilled)} h</span>
                  <span className="text-amber-400">Prod {formatPercent(metrics.productivity)}</span>
                  <span className="text-emerald-400">Eff {formatPercent(metrics.efficiency)}</span>
                </div>
              </div>
            </div>

            {/* Desktop: tabella */}
            <div className="hidden lg:block overflow-x-auto">
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
                  {visibleTechnicians.map((tech) => {
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
                            {renderInput(tech.id, field)}
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
                            onChange={(event) => updateNotes(tech.id, event.target.value)}
                            placeholder="Note o commesse..."
                            className="workshop-input text-xs"
                            aria-label={`Note ${tech.name}`}
                          />
                        </td>
                        {editable && (
                          <td className="py-2 px-2 text-center">
                            <button onClick={() => clearRow(tech.id)} title="Azzera questa riga" className="text-gray-500 hover:text-rose-400">
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
                      TOTALE {mode === 'week' ? `SETTIMANA ${weekNumber}` : MONTH_NAMES_IT[selectedMonth].toUpperCase()}
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
          </>
        )}
      </div>
    </div>
  );
}
