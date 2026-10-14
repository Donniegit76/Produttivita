import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider } from '../context/AuthContext';
import { DataProvider } from '../context/DataContext';
import { Weekly } from '../features/Weekly';
import type { Role } from '../lib/types';

class FakeEventSource {
  onopen: (() => void) | null = null;
  onerror: (() => void) | null = null;
  addEventListener() {}
  close() {}
}

const technician = {
  id: 'tech-1',
  name: 'Marco Rossi',
  role: 'Meccanico',
  avatarColor: '#f59e0b',
  targetHours: 40,
  active: true,
  createdAt: '',
};

function mockApi(role: Role) {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';
    const body = init?.body ? JSON.parse(String(init.body)) : undefined;
    calls.push({ url, method, body });
    const reply = (data: unknown, status = 200) => ({
      ok: status < 400,
      status,
      text: async () => JSON.stringify(data),
    });
    if (url.endsWith('/api/me')) return reply({ role });
    if (url.endsWith('/api/snapshot')) return reply({ revision: 1, technicians: [technician], entries: [] });
    if (url.endsWith('/api/entries') && method === 'PUT') {
      return reply({
        entry: { ...body, id: 'entry-1', updatedAt: new Date().toISOString() },
        revision: 2,
      });
    }
    if (url.endsWith('/api/revision')) return reply({ revision: 1 });
    return reply({}, 404);
  });
  vi.stubGlobal('fetch', fetchMock);
  return calls;
}

function renderWithProviders() {
  return render(
    <AuthProvider>
      <DataProvider>
        <Weekly />
      </DataProvider>
    </AuthProvider>,
  );
}

beforeEach(() => {
  vi.stubGlobal('EventSource', FakeEventSource as unknown as typeof EventSource);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('autosave', () => {
  it('l’admin salva da solo una cella modificata (debounce) sul server', async () => {
    const calls = mockApi('admin');
    renderWithProviders();

    const input = await screen.findByLabelText('Ore Lavorate (Ol) Marco Rossi');
    fireEvent.change(input, { target: { value: '12' } });

    await waitFor(
      () => {
        const put = calls.find((call) => call.url.endsWith('/api/entries') && call.method === 'PUT');
        expect(put).toBeTruthy();
        expect((put?.body as { hoursWorked?: number }).hoursWorked).toBe(12);
      },
      { timeout: 3000 },
    );
  });

  it('il viewer non può modificare: i campi sono disabilitati', async () => {
    mockApi('viewer');
    renderWithProviders();

    const input = await screen.findByLabelText('Ore Lavorate (Ol) Marco Rossi');
    expect(input).toBeDisabled();
  });
});
