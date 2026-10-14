import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ALL_DEPARTMENTS } from '../lib/filters';

interface FiltersValue {
  /** Reparto selezionato: 'all' oppure l'id di un reparto. Vale per tutte le viste. */
  departmentId: string;
  setDepartmentId: (id: string) => void;
  /** Mese e anno di riferimento condivisi da Mensile, Annuale, inserimento mensile e report stampato. */
  selectedYear: number;
  setSelectedYear: (year: number) => void;
  selectedMonth: number;
  setSelectedMonth: (month: number) => void;
}

const FiltersContext = createContext<FiltersValue | null>(null);

export function FiltersProvider({ children }: { children: ReactNode }) {
  const now = new Date();
  const [departmentId, setDepartmentId] = useState<string>(ALL_DEPARTMENTS);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());

  const value = useMemo<FiltersValue>(
    () => ({
      departmentId,
      setDepartmentId,
      selectedYear,
      setSelectedYear,
      selectedMonth,
      setSelectedMonth,
    }),
    [departmentId, selectedYear, selectedMonth],
  );

  return <FiltersContext.Provider value={value}>{children}</FiltersContext.Provider>;
}

export function useFilters(): FiltersValue {
  const context = useContext(FiltersContext);
  if (!context) throw new Error('useFilters deve essere usato dentro FiltersProvider');
  return context;
}
