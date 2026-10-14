import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { weekMajorityMonth } from '@shared/periods';
import { useRealtime } from '../hooks/useRealtime';
import { api, ApiError } from '../lib/api';
import type { BackupPayload, Department, Entry, EntryInput, Technician } from '../lib/types';
import { useAuth } from './AuthContext';

const SAVE_DEBOUNCE_MS = 600;

export interface SaveState {
  status: 'idle' | 'saving' | 'saved' | 'error';
  at?: number;
  message?: string;
}

interface DataValue {
  loading: boolean;
  loadError: string | null;
  departments: Department[];
  technicians: Technician[];
  entries: Entry[];
  revision: number;
  connected: boolean;
  saveState: SaveState;
  activeTechnicians: Technician[];
  queueEntrySave: (input: EntryInput) => void;
  deleteEntry: (id: string) => Promise<void>;
  createTechnician: (input: Partial<Technician>) => Promise<void>;
  updateTechnician: (id: string, input: Partial<Technician>) => Promise<void>;
  deleteTechnician: (id: string) => Promise<void>;
  createDepartment: (input: { name: string; color?: string }) => Promise<void>;
  updateDepartment: (id: string, input: { name?: string; color?: string }) => Promise<void>;
  deleteDepartment: (id: string) => Promise<void>;
  restore: (payload: BackupPayload) => Promise<void>;
  reload: () => Promise<void>;
}

const DataContext = createContext<DataValue | null>(null);

function keyOfPeriod(period: {
  technicianId: string;
  periodType: 'week' | 'month';
  weekYear?: number | null;
  weekNumber?: number | null;
  calendarYear?: number | null;
  calendarMonth?: number | null;
}): string {
  return period.periodType === 'week'
    ? `w:${period.technicianId}:${period.weekYear}:${period.weekNumber}`
    : `m:${period.technicianId}:${period.calendarYear}:${period.calendarMonth}`;
}

export const entryKey = keyOfPeriod;
export const entryKeyOf = (entry: Entry): string => keyOfPeriod(entry);

function inputKeyOf(input: EntryInput): string {
  return keyOfPeriod(input);
}

function optimisticEntry(input: EntryInput): Entry {
  const calendar =
    input.periodType === 'week'
      ? weekMajorityMonth(Number(input.weekYear), Number(input.weekNumber))
      : { calendarYear: Number(input.calendarYear), calendarMonth: Number(input.calendarMonth) };
  return {
    id: `local:${inputKeyOf(input)}`,
    technicianId: input.technicianId,
    departmentId: null,
    periodType: input.periodType,
    weekYear: input.periodType === 'week' ? Number(input.weekYear) : null,
    weekNumber: input.periodType === 'week' ? Number(input.weekNumber) : null,
    calendarYear: calendar.calendarYear,
    calendarMonth: calendar.calendarMonth,
    hoursPresence: Number(input.hoursPresence ?? 0),
    hoursWorked: Number(input.hoursWorked ?? 0),
    hoursBilled: Number(input.hoursBilled ?? 0),
    hoursToBeBilled: Number(input.hoursToBeBilled ?? 0),
    notes: input.notes ?? '',
    updatedAt: new Date().toISOString(),
  };
}

function mergeEntries(base: Entry[], updates: Entry[]): Entry[] {
  const updatedKeys = new Set(updates.map(entryKeyOf));
  return [...base.filter((entry) => !updatedKeys.has(entryKeyOf(entry))), ...updates];
}

export function DataProvider({ children }: { children: ReactNode }) {
  const { role } = useAuth();
  const [departments, setDepartments] = useState<Department[]>([]);
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [saveState, setSaveState] = useState<SaveState>({ status: 'idle' });

  const pending = useRef(new Map<string, EntryInput>());
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());

  const reload = useCallback(async () => {
    try {
      const snapshot = await api.snapshot();
      const optimistic = Array.from(pending.current.values()).map(optimisticEntry);
      setDepartments(snapshot.departments);
      setTechnicians(snapshot.technicians);
      setEntries(mergeEntries(snapshot.entries, optimistic));
      setRevision(snapshot.revision);
      setLoadError(null);
    } catch (error) {
      setLoadError(error instanceof ApiError ? error.message : 'Server non raggiungibile.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const handleRevision = useCallback(
    (remote: number) => {
      if (remote !== revision) void reload();
    },
    [revision, reload],
  );

  const sseConnected = useRealtime(revision, handleRevision);
  const connected = sseConnected && loadError === null;

  const flush = useCallback(
    async (key: string) => {
      const input = pending.current.get(key);
      pending.current.delete(key);
      timers.current.delete(key);
      if (!input) return;
      setSaveState({ status: 'saving' });
      try {
        const { entry, revision: remote } = await api.saveEntry(input);
        setRevision(remote);
        setEntries((prev) => mergeEntries(prev, [entry]));
        setSaveState({ status: 'saved', at: Date.now() });
      } catch (error) {
        const message = error instanceof ApiError ? error.message : 'Errore di salvataggio.';
        setSaveState({ status: 'error', at: Date.now(), message });
        await reload();
      }
    },
    [reload],
  );

  const queueEntrySave = useCallback(
    (input: EntryInput) => {
      if (role !== 'admin') return;
      const key = inputKeyOf(input);
      pending.current.set(key, input);
      setEntries((prev) => mergeEntries(prev, [optimisticEntry(input)]));
      const existing = timers.current.get(key);
      if (existing) clearTimeout(existing);
      timers.current.set(
        key,
        setTimeout(() => void flush(key), SAVE_DEBOUNCE_MS),
      );
    },
    [flush, role],
  );

  const deleteEntry = useCallback(async (id: string) => {
    const { revision: remote } = await api.deleteEntry(id);
    setRevision(remote);
    setEntries((prev) => prev.filter((entry) => entry.id !== id));
  }, []);

  const createTechnician = useCallback(async (input: Partial<Technician>) => {
    const { technician, revision: remote } = await api.createTechnician(input);
    setRevision(remote);
    setTechnicians((prev) => [...prev, technician]);
  }, []);

  const updateTechnician = useCallback(async (id: string, input: Partial<Technician>) => {
    const { technician, revision: remote } = await api.updateTechnician(id, input);
    setRevision(remote);
    setTechnicians((prev) => prev.map((t) => (t.id === id ? technician : t)));
  }, []);

  const deleteTechnician = useCallback(async (id: string) => {
    const { revision: remote } = await api.deleteTechnician(id);
    setRevision(remote);
    setTechnicians((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const createDepartment = useCallback(async (input: { name: string; color?: string }) => {
    const { department, revision: remote } = await api.createDepartment(input);
    setRevision(remote);
    setDepartments((prev) => [...prev, department].sort((a, b) => a.name.localeCompare(b.name, 'it')));
  }, []);

  const updateDepartment = useCallback(async (id: string, input: { name?: string; color?: string }) => {
    const { department, revision: remote } = await api.updateDepartment(id, input);
    setRevision(remote);
    setDepartments((prev) =>
      prev
        .map((d) => (d.id === id ? { ...department, technicianCount: d.technicianCount } : d))
        .sort((a, b) => a.name.localeCompare(b.name, 'it')),
    );
  }, []);

  const deleteDepartment = useCallback(async (id: string) => {
    const { revision: remote } = await api.deleteDepartment(id);
    setRevision(remote);
    setDepartments((prev) => prev.filter((d) => d.id !== id));
  }, []);

  const restore = useCallback(
    async (payload: BackupPayload) => {
      await api.restore(payload);
      pending.current.clear();
      await reload();
    },
    [reload],
  );

  const activeTechnicians = useMemo(() => technicians.filter((t) => t.active), [technicians]);

  const value = useMemo<DataValue>(
    () => ({
      loading,
      loadError,
      departments,
      technicians,
      entries,
      revision,
      connected,
      saveState,
      activeTechnicians,
      queueEntrySave,
      deleteEntry,
      createTechnician,
      updateTechnician,
      deleteTechnician,
      createDepartment,
      updateDepartment,
      deleteDepartment,
      restore,
      reload,
    }),
    [
      loading,
      loadError,
      departments,
      technicians,
      entries,
      revision,
      connected,
      saveState,
      activeTechnicians,
      queueEntrySave,
      deleteEntry,
      createTechnician,
      updateTechnician,
      deleteTechnician,
      createDepartment,
      updateDepartment,
      deleteDepartment,
      restore,
      reload,
    ],
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): DataValue {
  const context = useContext(DataContext);
  if (!context) throw new Error('useData deve essere usato dentro DataProvider');
  return context;
}
