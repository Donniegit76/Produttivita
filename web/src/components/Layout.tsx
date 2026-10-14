import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { formatTime } from '../lib/format';
import { Dashboard } from '../features/Dashboard';
import { ExportView } from '../features/ExportView';
import { Monthly } from '../features/Monthly';
import { Technicians } from '../features/Technicians';
import { Weekly } from '../features/Weekly';
import { Yearly } from '../features/Yearly';

export type TabKey = 'dashboard' | 'weekly' | 'monthly' | 'yearly' | 'technicians' | 'export';

const TABS: { key: TabKey; label: string; short: string }[] = [
  { key: 'dashboard', label: '📊 Dashboard', short: 'Dashboard' },
  { key: 'weekly', label: '📅 Settimanale / Mensile', short: 'Inserisci' },
  { key: 'monthly', label: '🗓️ Riepilogo Mensile', short: 'Mensile' },
  { key: 'yearly', label: '📈 Riepilogo Annuale', short: 'Annuale' },
  { key: 'technicians', label: '👨‍🔧 Tecnici', short: 'Tecnici' },
  { key: 'export', label: '🖨️ Stampa & Esporta', short: 'Esporta' },
];

function SaveIndicator() {
  const { saveState } = useData();
  if (saveState.status === 'saving') {
    return <span className="text-[11px] text-amber-300 font-semibold">Salvataggio…</span>;
  }
  if (saveState.status === 'saved') {
    return (
      <span className="text-[11px] text-emerald-300 font-semibold">
        Salvato {saveState.at ? formatTime(saveState.at) : ''}
      </span>
    );
  }
  if (saveState.status === 'error') {
    return <span className="text-[11px] text-rose-300 font-semibold">Errore: {saveState.message}</span>;
  }
  return null;
}

export function Layout({ tab, setTab }: { tab: TabKey; setTab: (tab: TabKey) => void }) {
  const { role, logout } = useAuth();
  const { connected, activeTechnicians } = useData();

  return (
    <div className="flex flex-col min-h-screen">
      <header className="no-print bg-[#111722]/90 backdrop-blur-md border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between gap-4">
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setTab('dashboard')}>
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-amber-500 to-yellow-300 flex items-center justify-center text-slate-950 font-black shadow-lg shadow-amber-500/20 text-xl">
              ⚡
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-amber-400 via-amber-200 to-yellow-400 bg-clip-text text-transparent">
                  Fast_Prod
                </span>
                <span className="text-xs uppercase font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Officina
                </span>
              </div>
              <div className="flex items-center gap-3 mt-0.5">
                <span className="text-[10px] text-gray-400 font-semibold">
                  {role === 'admin' ? '🔑 Admin' : '👁️ Sola lettura'}
                </span>
                <SaveIndicator />
              </div>
            </div>
          </div>

          <nav className="hidden lg:flex items-center space-x-1 bg-gray-900/60 p-1.5 rounded-xl border border-gray-800">
            {TABS.map((item) => (
              <button
                key={item.key}
                onClick={() => setTab(item.key)}
                className={`px-3 py-2 rounded-lg font-medium text-sm transition-all ${
                  tab === item.key
                    ? 'bg-amber-500 text-slate-950 font-bold shadow-md shadow-amber-500/20'
                    : 'text-gray-300 hover:text-white hover:bg-gray-800/60'
                }`}
              >
                {item.label}
                {item.key === 'technicians' ? ` (${activeTechnicians.length})` : ''}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} className="btn-dark text-xs sm:text-sm no-print">
              🖨️ Stampa
            </button>
            <button onClick={() => void logout()} className="btn-dark text-xs sm:text-sm no-print">
              Esci
            </button>
          </div>
        </div>

        <div className="lg:hidden flex overflow-x-auto px-4 py-2 border-t border-gray-800 space-x-2 text-xs">
          {TABS.map((item) => (
            <button
              key={item.key}
              onClick={() => setTab(item.key)}
              className={`px-3 py-1.5 rounded-lg whitespace-nowrap ${
                tab === item.key ? 'bg-amber-500 text-black font-bold' : 'bg-gray-800 text-gray-300'
              }`}
            >
              {item.short}
            </button>
          ))}
        </div>
      </header>

      {!connected && (
        <div className="no-print bg-rose-500/10 border-b border-rose-500/30 text-rose-200 text-sm px-4 py-2 text-center">
          Server non raggiungibile: i campi sono in sola lettura e le modifiche non vengono salvate. Riprovo
          automaticamente.
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {tab === 'dashboard' && <Dashboard onNavigate={setTab} />}
        {tab === 'weekly' && <Weekly />}
        {tab === 'monthly' && <Monthly />}
        {tab === 'yearly' && <Yearly />}
        {tab === 'technicians' && <Technicians />}
        {tab === 'export' && <ExportView onNavigate={setTab} />}
      </main>

      <footer className="no-print border-t border-gray-800/60 py-6 mt-12 bg-gray-950/40 text-center text-xs text-gray-500">
        <p>Fast_Prod 3.0 — Gestione produttività ed efficienza officina · database SQLite · uso interno rete locale</p>
      </footer>
    </div>
  );
}
