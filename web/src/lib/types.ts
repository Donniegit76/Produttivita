export type Role = 'admin' | 'viewer';

export interface Technician {
  id: string;
  name: string;
  role: string;
  avatarColor: string;
  targetHours: number;
  active: boolean;
  createdAt: string;
}

export interface Entry {
  id: string;
  technicianId: string;
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
  technicians: Technician[];
  entries: Entry[];
}

export interface BackupPayload {
  version?: number;
  exportedAt?: string;
  revision?: number;
  technicians: Technician[];
  entries: Entry[];
}
