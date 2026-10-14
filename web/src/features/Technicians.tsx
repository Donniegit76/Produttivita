import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { ApiError } from '../lib/api';
import { initials } from '../lib/format';
import type { Technician } from '../lib/types';

const ROLES = [
  'Capo Officina',
  'Meccanico Senior',
  'Meccanico Junior',
  'Elettrauto',
  'Tecnico Diagnostica',
  'Carrozziere',
  'Accettatore',
];

export function Technicians() {
  const { role } = useAuth();
  const { technicians, entries, createTechnician, updateTechnician, deleteTechnician, connected } = useData();
  const [name, setName] = useState('');
  const [jobRole, setJobRole] = useState(ROLES[1]);
  const [color, setColor] = useState('#f59e0b');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const editable = role === 'admin' && connected;

  const entriesCount = (tech: Technician) => entries.filter((entry) => entry.technicianId === tech.id).length;

  const handleAdd = async (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createTechnician({ name: name.trim(), role: jobRole, avatarColor: color });
      setName('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Errore durante il salvataggio.');
    } finally {
      setBusy(false);
    }
  };

  const toggleActive = async (tech: Technician) => {
    setError(null);
    try {
      await updateTechnician(tech.id, { active: !tech.active });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Errore durante l’aggiornamento.');
    }
  };

  const remove = async (tech: Technician) => {
    const hasEntries = entriesCount(tech) > 0;
    const message = hasEntries
      ? `${tech.name} ha ore registrate e non può essere cancellato. Disattivalo per toglierlo dalle viste attive.`
      : `Eliminare definitivamente ${tech.name}?`;
    if (hasEntries) {
      setError(message);
      return;
    }
    if (!window.confirm(message)) return;
    setError(null);
    try {
      await deleteTechnician(tech.id);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Errore durante la cancellazione.');
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-extrabold text-white tracking-tight">Gestione tecnici ed anagrafica</h1>
        <p className="text-sm text-gray-400 mt-1">
          Aggiungi, modifica o disattiva i tecnici. La disattivazione conserva tutto lo storico.
        </p>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-200 text-sm rounded-xl px-4 py-3">{error}</div>
      )}

      {editable && (
        <div className="glass-panel p-6 rounded-2xl">
          <h3 className="text-lg font-bold text-white mb-4">➕ Inserisci nuovo tecnico</h3>
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-400 mb-1 font-semibold">Nome e cognome</label>
              <input
                type="text"
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Es. Mario Rossi"
                className="workshop-input"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1 font-semibold">Qualifica</label>
              <select value={jobRole} onChange={(event) => setJobRole(event.target.value)} className="workshop-select w-full">
                {ROLES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1 font-semibold">Colore avatar</label>
              <input
                type="color"
                value={color}
                onChange={(event) => setColor(event.target.value)}
                className="w-full h-10 rounded cursor-pointer bg-transparent border-0"
              />
            </div>
            <button type="submit" disabled={busy} className="btn-gold w-full justify-center">
              Aggiungi
            </button>
          </form>
        </div>
      )}

      <div className="glass-panel p-6 rounded-2xl">
        <h3 className="text-lg font-bold text-white mb-4">Squadra registrata ({technicians.length})</h3>
        {technicians.length === 0 ? (
          <p className="text-sm text-gray-400">Nessun tecnico registrato.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {technicians.map((tech) => (
              <div key={tech.id} className="p-4 rounded-xl border border-gray-800 bg-gray-900/40 flex justify-between items-center">
                <div className="flex items-center space-x-3">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-black text-sm"
                    style={{ backgroundColor: tech.avatarColor }}
                  >
                    {initials(tech.name)}
                  </div>
                  <div>
                    <h4 className="font-bold text-white text-base">{tech.name}</h4>
                    <p className="text-xs text-gray-400">
                      {tech.role} · {entriesCount(tech)} righe di ore
                    </p>
                  </div>
                </div>
                {editable && (
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => void toggleActive(tech)}
                      className={`text-xs px-2.5 py-1 rounded font-bold ${
                        tech.active
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-gray-700 text-gray-400'
                      }`}
                    >
                      {tech.active ? 'Attivo' : 'Disattivato'}
                    </button>
                    <button
                      onClick={() => void remove(tech)}
                      className="text-xs p-1 text-gray-500 hover:text-red-400"
                      title="Elimina"
                    >
                      🗑️
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
