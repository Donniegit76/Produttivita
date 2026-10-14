import { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import { MONTH_NAMES_IT } from '@shared/periods';
import type { TabKey } from '../components/Layout';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { useFilters } from '../context/FiltersContext';
import { ApiError } from '../lib/api';
import { matchesDepartment } from '../lib/filters';
import type { BackupPayload } from '../lib/types';

function csvCell(value: unknown): string {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export function ExportView({ onNavigate }: { onNavigate: (tab: TabKey) => void }) {
  const { role } = useAuth();
  const { entries, technicians, departments, restore } = useData();
  const { departmentId } = useFilters();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  const scopedEntries = useMemo(
    () => entries.filter((entry) => matchesDepartment(entry.departmentId, departmentId)),
    [entries, departmentId],
  );

  const departmentName = (id: string | null) =>
    departments.find((department) => department.id === id)?.name ?? '—';

  const rows = () =>
    scopedEntries.map((entry) => {
      const tech = technicians.find((t) => t.id === entry.technicianId);
      const presence = Number(entry.hoursPresence) || 0;
      const worked = Number(entry.hoursWorked) || 0;
      const billed = Number(entry.hoursBilled) || 0;
      return {
        anno: entry.calendarYear,
        periodo:
          entry.periodType === 'week'
            ? `Settimana ${entry.weekNumber}/${entry.weekYear}`
            : `Mese ${MONTH_NAMES_IT[entry.calendarMonth]}`,
        mese: MONTH_NAMES_IT[entry.calendarMonth],
        reparto: departmentName(entry.departmentId),
        tecnico: tech?.name ?? 'N/D',
        qualifica: tech?.role ?? 'N/D',
        presenza: presence,
        lavorate: worked,
        fatturate: billed,
        daFatturare: Number(entry.hoursToBeBilled) || 0,
        produttivita: presence > 0 ? Number(((worked / presence) * 100).toFixed(1)) : 0,
        efficienza: worked > 0 ? Number(((billed / worked) * 100).toFixed(1)) : 0,
        resa: presence > 0 ? Number(((billed / presence) * 100).toFixed(1)) : 0,
        note: entry.notes ?? '',
      };
    });

  const exportToExcel = () => {
    const data = rows().map((row) => ({
      Anno: row.anno,
      Periodo: row.periodo,
      Mese: row.mese,
      Reparto: row.reparto,
      Tecnico: row.tecnico,
      Qualifica: row.qualifica,
      'Ore Presenza': row.presenza,
      'Ore Lavorate': row.lavorate,
      'Ore Fatturate': row.fatturate,
      'Ore da Fatturare': row.daFatturare,
      'Produttività (%)': row.produttivita,
      'Efficienza (%)': row.efficienza,
      'Resa (%)': row.resa,
      Note: row.note,
    }));
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rendimento');
    XLSX.writeFile(workbook, `Fast_Prod_Rendimento_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportToCsv = () => {
    const headers = [
      'Anno',
      'Periodo',
      'Mese',
      'Reparto',
      'Tecnico',
      'Qualifica',
      'Presenza',
      'Lavorate',
      'Fatturate',
      'Da Fatturare',
      'Produttivita',
      'Efficienza',
      'Resa',
      'Note',
    ];
    const lines = rows().map((row) =>
      [
        row.anno,
        row.periodo,
        row.mese,
        row.reparto,
        row.tecnico,
        row.qualifica,
        row.presenza,
        row.lavorate,
        row.fatturate,
        row.daFatturare,
        row.produttivita,
        row.efficienza,
        row.resa,
        row.note,
      ]
        .map(csvCell)
        .join(','),
    );
    const csv = '\uFEFF' + [headers.map(csvCell).join(','), ...lines].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `Fast_Prod_Report_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const onRestoreFile = async (file: File) => {
    setMessage(null);
    try {
      const text = await file.text();
      const payload = JSON.parse(text) as BackupPayload;
      if (!Array.isArray(payload.technicians) || !Array.isArray(payload.entries)) {
        throw new Error('Il file non contiene un backup valido.');
      }
      const confirmed = window.confirm(
        'Ripristinare questo backup? I dati attuali verranno sostituiti (prima viene creato automaticamente un backup di sicurezza).',
      );
      if (!confirmed) return;
      await restore(payload);
      setMessage({ kind: 'ok', text: 'Backup ripristinato correttamente.' });
    } catch (err) {
      setMessage({
        kind: 'error',
        text: err instanceof ApiError ? err.message : err instanceof Error ? err.message : 'Ripristino non riuscito.',
      });
    }
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Stampa ed esportazione</h1>
        <p className="text-sm text-gray-400 mt-1">
          Scarica i dati in Excel o CSV (rispettano il reparto selezionato) oppure stampa il <strong>report
          mensile</strong> del mese e reparto correnti.
        </p>
      </div>

      {message && (
        <div
          className={`text-sm rounded-xl px-4 py-3 border ${
            message.kind === 'ok'
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
              : 'bg-rose-500/10 border-rose-500/30 text-rose-200'
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
        <div className="glass-panel p-5 sm:p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="text-3xl mb-3">📊</div>
            <h3 className="text-lg font-bold text-white">Esporta in Excel (.xlsx)</h3>
            <p className="text-xs text-gray-400 mt-1">Foglio di calcolo con ore, percentuali e reparto.</p>
          </div>
          <button onClick={exportToExcel} className="btn-gold mt-6 justify-center">
            Scarica Excel
          </button>
        </div>

        <div className="glass-panel p-5 sm:p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="text-3xl mb-3">📁</div>
            <h3 className="text-lg font-bold text-white">Esporta in CSV</h3>
            <p className="text-xs text-gray-400 mt-1">Formato standard compatibile con qualsiasi gestionale.</p>
          </div>
          <button onClick={exportToCsv} className="btn-dark mt-6 justify-center">
            Scarica CSV
          </button>
        </div>

        <div className="glass-panel p-5 sm:p-6 rounded-2xl flex flex-col justify-between">
          <div>
            <div className="text-3xl mb-3">🖨️</div>
            <h3 className="text-lg font-bold text-white">Stampa report mensile</h3>
            <p className="text-xs text-gray-400 mt-1">
              Stampa il report del mese e del reparto selezionati (salvalo come PDF dal browser).
            </p>
          </div>
          <button onClick={() => window.print()} className="btn-gold mt-6 justify-center">
            Stampa / Salva PDF
          </button>
        </div>
      </div>

      {role === 'admin' && (
        <div className="glass-panel p-5 sm:p-6 rounded-2xl border border-gray-800">
          <h3 className="text-lg font-bold text-white mb-4">💾 Backup del database</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
            <p className="text-xs text-gray-400 md:col-span-1">
              Il backup automatico giornaliero resta sul server (30 giorni). Qui puoi scaricarlo o ripristinarlo.
            </p>
            <a href="/api/backup" className="btn-dark justify-center">
              ⬇️ Scarica backup JSON
            </a>
            <a href="/api/backup/sqlite" className="btn-dark justify-center">
              ⬇️ Scarica file SQLite
            </a>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void onRestoreFile(file);
                event.target.value = '';
              }}
            />
            <button onClick={() => fileRef.current?.click()} className="btn-dark text-xs">
              ⬆️ Ripristina da backup JSON
            </button>
            <button onClick={() => onNavigate('technicians')} className="text-xs text-amber-400 hover:underline">
              Gestisci tecnici e reparti →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
