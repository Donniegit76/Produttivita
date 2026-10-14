import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext';
import { DataProvider } from '../context/DataContext';
import { FiltersProvider } from '../context/FiltersContext';
import { MonthlyReport } from './MonthlyReport';

class FakeEventSource {
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  addEventListener() {}
  close() {}
}

function mockApi() {
  const now = new Date();
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    const reply = (data: unknown) => ({ ok: true, status: 200, text: async () => JSON.stringify(data) });
    if (url.endsWith('/api/me')) return reply({ role: 'admin' });
    if (url.endsWith('/api/snapshot')) {
      return reply({
        revision: 1,
        departments: [{ id: 'dept-generale', name: 'Generale', color: '#06b6d4', createdAt: '', technicianCount: 1 }],
        technicians: [
          {
            id: 'tech-1',
            name: 'Marco Rossi',
            role: 'Meccanico',
            avatarColor: '#f59e0b',
            targetHours: 40,
            active: true,
            departmentId: 'dept-generale',
            createdAt: '',
          },
        ],
        entries: [
          {
            id: 'e1',
            technicianId: 'tech-1',
            departmentId: 'dept-generale',
            periodType: 'week',
            weekYear: now.getFullYear(),
            weekNumber: 14,
            calendarYear: now.getFullYear(),
            calendarMonth: now.getMonth(),
            hoursPresence: 40,
            hoursWorked: 35,
            hoursBilled: 30,
            hoursToBeBilled: 2,
            notes: '',
            updatedAt: '',
          },
        ],
      });
    }
    if (url.endsWith('/api/revision')) return reply({ revision: 1 });
    return reply({});
  });
  vi.stubGlobal('fetch', fetchMock);
}

beforeEach(() => {
  vi.stubGlobal('EventSource', FakeEventSource as unknown as typeof EventSource);
  mockApi();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('report mensile stampabile', () => {
  it('mostra tecnico, colonna Resa e valore corretto', async () => {
    render(
      <AuthProvider>
        <DataProvider>
          <FiltersProvider>
            <MonthlyReport />
          </FiltersProvider>
        </DataProvider>
      </AuthProvider>,
    );

    expect(await screen.findByText('Marco Rossi')).toBeInTheDocument();
    expect(screen.getByText('Resa')).toBeInTheDocument();
    expect(screen.getByText('Reparto')).toBeInTheDocument();
    // resa = fatturate / presenza = 30 / 40 = 75.0%
    expect(screen.getAllByText('75.0%').length).toBeGreaterThan(0);
  });
});
