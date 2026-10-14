import type { BackupPayload, Entry, EntryInput, Role, Snapshot, Technician } from './types';

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const response = await fetch(path, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const text = await response.text();
  const data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
  if (!response.ok) {
    throw new ApiError(
      response.status,
      typeof data.code === 'string' ? data.code : 'ERROR',
      typeof data.error === 'string' ? data.error : `Errore ${response.status}`,
    );
  }
  return data as T;
}

export const api = {
  me: () => request<{ role: Role }>('/api/me'),
  login: (password: string) =>
    request<{ role: Role }>('/api/login', { method: 'POST', body: JSON.stringify({ password }) }),
  logout: () => request<{ ok: true }>('/api/logout', { method: 'POST' }),
  snapshot: () => request<Snapshot>('/api/snapshot'),
  revision: () => request<{ revision: number }>('/api/revision'),
  saveEntry: (input: EntryInput) =>
    request<{ entry: Entry; revision: number }>('/api/entries', {
      method: 'PUT',
      body: JSON.stringify(input),
    }),
  deleteEntry: (id: string) =>
    request<{ revision: number }>(`/api/entries/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  createTechnician: (input: Partial<Technician>) =>
    request<{ technician: Technician; revision: number }>('/api/technicians', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateTechnician: (id: string, input: Partial<Technician>) =>
    request<{ technician: Technician; revision: number }>(
      `/api/technicians/${encodeURIComponent(id)}`,
      { method: 'PATCH', body: JSON.stringify(input) },
    ),
  deleteTechnician: (id: string) =>
    request<{ revision: number }>(`/api/technicians/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    }),
  restore: (payload: BackupPayload) =>
    request<{ ok: true; revision: number }>('/api/restore', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
};
