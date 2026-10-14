export type Role = 'admin' | 'viewer';

export interface Department {
  id: string;
  name: string;
  color: string;
  createdAt: string;
  technicianCount: number;
}

export interface Technician {
  id: string;
  name: string;
  role: string;
  avatarColor: string;
  targetHours: number;
  active: boolean;
  departmentId: string | null;
  createdAt: string;
}

export interface Entry {
  id: string;
  technicianId: string;
  departmentId: string | null;
  periodType: 'week' | 'month';
  weekYear: number | null;
  weekNumber: number | null;
  calendarYear: number;
  calendarMonth: number;
  hoursPresence: number;
  hoursWorked: number;
  hoursBilled: number;
  hoursToBeBilled: number;
  notes: string;
  updatedAt: string;
}

export interface EntryInput {
  technicianId: string;
  periodType: 'week' | 'month';
  weekYear?: number | null;
  weekNumber?: number | null;
  calendarYear?: number | null;
  calendarMonth?: number | null;
  hoursPresence?: number;
  hoursWorked?: number;
  hoursBilled?: number;
  hoursToBeBilled?: number;
  notes?: string;
}

export interface Snapshot {
  revision: number;
  departments: Department[];
  technicians: Technician[];
  entries: Entry[];
}

export interface BackupPayload {
  version?: number;
  exportedAt?: string;
  revision?: number;
  departments?: Department[];
  technicians: Technician[];
  entries: Entry[];
}
