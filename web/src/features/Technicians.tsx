import { useEffect, useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { useData } from '../context/DataContext';
import { ApiError } from '../lib/api';
import { initials } from '../lib/format';
import type { Department, Technician } from '../lib/types';

const ROLES = [
  'Capo Officina',
  'Meccanico Senior',
  'Meccanico Junior',
  'Elettrauto',
  'Tecnico Diagnostica',
  'Carrozziere',
  'Accettatore',
];

interface TechDraft {
  name: string;
  role: string;
  avatarColor: string;
  departmentId: string;
}

export function Technicians() {
  const { role } = useAuth();
  const {
    departments,
    technicians,
    entries,
    createTechnician,
    updateTechnician,
    deleteTechnician,
    createDepartment,
    updateDepartment,
    deleteDepartment,
    connected,
  } = useData();

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // nuovo tecnico
  const [name, setName] = useState('');
  const [jobRole, setJobRole] = useState(ROLES[1]);
  const [color, setColor] = useState('#f59e0b');
  const [departmentId, setDepartmentId] = useState('');

  // modifica tecnico
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<TechDraft>({ name: '', role: '', avatarColor: '#f59e0b', departmentId: '' });

  // reparti
  const [deptName, setDeptName] = useState('');
  const [deptColor, setDeptColor] = useState('#06b6d4');
  const [editingDeptId, setEditingDeptId] = useState<string | null>(null);
  const [deptDraft, setDeptDraft] = useState({ name: '', color: '#06b6d4' });

  const editable = role === 'admin' && connected;

  useEffect(() => {
    if (!departmentId && departments.length > 0) setDepartmentId(departments[0].id);
  }, [departments, departmentId]);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Operazione non riuscita.');
    } finally {
      setBusy(false);
    }
  };

  const countEntries = (tech: Technician) => entries.filter((entry) => entry.technicianId === tech.id).length;

  const handleAdd = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !departmentId) return;
    void run(async () => {
      await createTechnician({ name: name.trim(), role: jobRole, avatarColor: color, departmentId });
      setName('');
    });
  };

  const startEdit = (tech: Technician) => {
    setEditingId(tech.id);
    setDraft({
      name: tech.name,
      role: tech.role,
      avatarColor: tech.avatarColor,
      departmentId: tech.departmentId ?? departments[0]?.id ?? '',
    });
  };

  const saveEdit = () => {
    if (!editingId || !draft.name.trim()) return;
    void run(async () => {
      await updateTechnician(editingId, {
        name: draft.name.trim(),
        role: draft.role,
        avatarColor: draft.avatarColor,
        departmentId: draft.departmentId,
      });
      setEditingId(null);
    });
  };

  const toggleActive = (tech: Technician) => {
    void run(() => updateTechnician(tech.id, { active: !tech.active }));
  };

  const removeTech = (tech: Technician) => {
    if (countEntries(tech) > 0) {
      setError(`${tech.name} ha ore registrate: disattivalo invece di cancellarlo.`);
      return;
    }
    if (!window.confirm(`Eliminare definitivamente ${tech.name}?`)) return;
    void run(() => deleteTechnician(tech.id));
  };

  const addDepartment = (event: FormEvent) => {
    event.preventDefault();
    if (!deptName.trim()) return;
    void run(async () => {
      await createDepartment({ name: deptName.trim(), color: deptColor });
      setDeptName('');
    });
  };

  const startDeptEdit = (department: Department) => {
    setEditingDeptId(department.id);
    setDeptDraft({ name: department.name, color: department.color });
  };

  const saveDept = () => {
    if (!editingDeptId || !deptDraft.name.trim()) return;
    void run(async () => {
      await updateDepartment(editingDeptId, { name: deptDraft.name.trim(), color: deptDraft.color });
      setEditingDeptId(null);
    });
  };

  const removeDepartment = (department: Department) => {
    if (!window.confirm(`Eliminare il reparto "${department.name}"?`)) return;
    void run(() => deleteDepartment(department.id));
  };

  return (
    <div className="space-y-6 sm:space-y-8">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">Tecnici e reparti</h1>
        <p className="text-sm text-gray-400 mt-1">
          Crea i reparti, assegna i tecnici e correggi nome, ruolo o colore. Le modifiche si riflettono su tutti i
          dispositivi.
        </p>
      </div>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-200 text-sm rounded-xl px-4 py-3">{error}</div>
      )}

      {/* ---------------- Reparti ---------------- */}
      <div className="glass-panel p-4 sm:p-6 rounded-2xl">
        <h3 className="text-lg font-bold text-white mb-4">🏷️ Reparti</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {departments.map((department) => (
            <div key={department.id} className="p-3 rounded-xl border border-gray-800 bg-gray-900/40">
              {editingDeptId === department.id ? (
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={deptDraft.color}
                    onChange={(e) => setDeptDraft((d) => ({ ...d, color: e.target.value }))}
                    className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                  />
                  <input
                    type="text"
                    value={deptDraft.name}
                    onChange={(e) => setDeptDraft((d) => ({ ...d, name: e.target.value }))}
                    className="workshop-input text-sm"
                  />
                  <button onClick={saveDept} disabled={busy} className="btn-gold text-xs px-3 py-1">
                    ✓
                  </button>
                  <button onClick={() => setEditingDeptId(null)} className="btn-dark text-xs px-2 py-1">
                    ✕
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: department.color }} />
                    <span className="font-semibold text-white truncate">{department.name}</span>
                    <span className="text-xs text-gray-500 shrink-0">({department.technicianCount})</span>
                  </div>
                  {editable && (
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => startDeptEdit(department)} title="Rinomina" className="text-gray-400 hover:text-amber-400 text-xs">
                        ✏️
                      </button>
                      <button onClick={() => removeDepartment(department)} title="Elimina" className="text-gray-500 hover:text-red-400 text-xs">
                        🗑️
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {editable && (
          <form onSubmit={addDepartment} className="flex flex-wrap items-center gap-3 mt-4">
            <input
              type="color"
              value={deptColor}
              onChange={(e) => setDeptColor(e.target.value)}
              className="w-10 h-10 rounded cursor-pointer bg-transparent border-0"
              aria-label="Colore reparto"
            />
            <input
              type="text"
              value={deptName}
              onChange={(e) => setDeptName(e.target.value)}
              placeholder="Nome nuovo reparto (es. Meccanica)"
              className="workshop-input flex-1 min-w-[180px]"
            />
            <button type="submit" disabled={busy || !deptName.trim()} className="btn-gold justify-center">
              ➕ Aggiungi reparto
            </button>
          </form>
        )}
      </div>

      {/* ---------------- Nuovo tecnico ---------------- */}
      {editable && (
        <div className="glass-panel p-4 sm:p-6 rounded-2xl">
          <h3 className="text-lg font-bold text-white mb-4">➕ Inserisci nuovo tecnico</h3>
          <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-6 gap-4 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs text-gray-400 mb-1 font-semibold">Nome e cognome</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Es. Mario Rossi"
                className="workshop-input"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1 font-semibold">Qualifica</label>
              <select value={jobRole} onChange={(e) => setJobRole(e.target.value)} className="workshop-select w-full">
                {ROLES.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1 font-semibold">Reparto</label>
              <select
                value={departmentId}
                onChange={(e) => setDepartmentId(e.target.value)}
                className="workshop-select w-full"
                required
              >
                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1 font-semibold">Colore</label>
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full h-10 rounded cursor-pointer bg-transparent border-0"
              />
            </div>
            <button type="submit" disabled={busy || !name.trim() || !departmentId} className="btn-gold w-full justify-center">
              Aggiungi
            </button>
          </form>
        </div>
      )}

      {/* ---------------- Squadra ---------------- */}
      <div className="glass-panel p-4 sm:p-6 rounded-2xl">
        <h3 className="text-lg font-bold text-white mb-4">Squadra registrata ({technicians.length})</h3>
        {technicians.length === 0 ? (
          <p className="text-sm text-gray-400">Nessun tecnico registrato.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {technicians.map((tech) => {
              const department = departments.find((d) => d.id === tech.departmentId);
              return (
                <div key={tech.id} className="p-4 rounded-xl border border-gray-800 bg-gray-900/40">
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div
                        className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-black text-sm shrink-0"
                        style={{ backgroundColor: tech.avatarColor }}
                      >
                        {initials(tech.name)}
                      </div>
                      <div className="min-w-0">
                        <h4 className="font-bold text-white text-base truncate">{tech.name}</h4>
                        <p className="text-xs text-gray-400 truncate">
                          {tech.role} · {department?.name ?? 'senza reparto'} · {countEntries(tech)} righe
                        </p>
                      </div>
                    </div>
                    {editable && editingId !== tech.id && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => startEdit(tech)}
                          className="text-xs px-2 py-1 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30"
                          title="Modifica tecnico"
                        >
                          ✏️ Modifica
                        </button>
                      </div>
                    )}
                  </div>

                  {editingId === tech.id ? (
                    <div className="mt-3 space-y-2">
                      <input
                        type="text"
                        value={draft.name}
                        onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                        className="workshop-input text-sm"
                        aria-label="Nome tecnico"
                      />
                      <div className="flex gap-2">
                        <select
                          value={draft.role}
                          onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))}
                          className="workshop-select text-sm flex-1"
                        >
                          {[draft.role, ...ROLES.filter((r) => r !== draft.role)].map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                        <select
                          value={draft.departmentId}
                          onChange={(e) => setDraft((d) => ({ ...d, departmentId: e.target.value }))}
                          className="workshop-select text-sm flex-1"
                        >
                          {departments.map((department) => (
                            <option key={department.id} value={department.id}>
                              {department.name}
                            </option>
                          ))}
                        </select>
                        <input
                          type="color"
                          value={draft.avatarColor}
                          onChange={(e) => setDraft((d) => ({ ...d, avatarColor: e.target.value }))}
                          className="w-10 h-10 rounded cursor-pointer bg-transparent border-0"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={saveEdit} disabled={busy} className="btn-gold text-xs justify-center flex-1">
                          Salva
                        </button>
                        <button onClick={() => setEditingId(null)} className="btn-dark text-xs justify-center flex-1">
                          Annulla
                        </button>
                      </div>
                    </div>
                  ) : (
                    editable && (
                      <div className="flex items-center gap-2 mt-3">
                        <button
                          onClick={() => toggleActive(tech)}
                          className={`text-xs px-2.5 py-1 rounded font-bold ${
                            tech.active
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                              : 'bg-gray-700 text-gray-400'
                          }`}
                        >
                          {tech.active ? 'Attivo' : 'Disattivato'}
                        </button>
                        <button onClick={() => removeTech(tech)} className="text-xs p-1 text-gray-500 hover:text-red-400" title="Elimina">
                          🗑️
                        </button>
                      </div>
                    )
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
