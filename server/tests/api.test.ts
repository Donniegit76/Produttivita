import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp, type CreatedApp } from '../src/app';

const ADMIN = 'admin-pass';
const VIEWER = 'viewer-pass';

let tmpDir: string;
let created: CreatedApp;

function makeApp(): CreatedApp {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'fastprod-'));
  return createApp({
    config: {
      dataDir: tmpDir,
      adminPassword: ADMIN,
      viewerPassword: VIEWER,
      sessionSecret: 'test-secret',
      enableBackupJob: false,
      webDistDir: path.join(tmpDir, 'no-web'),
    },
  });
}

async function adminAgent() {
  const agent = request.agent(created.app);
  await agent.post('/api/login').send({ password: ADMIN }).expect(200);
  return agent;
}

async function viewerAgent() {
  const agent = request.agent(created.app);
  await agent.post('/api/login').send({ password: VIEWER }).expect(200);
  return agent;
}

async function createTech(agent: request.Agent, name = 'Marco Rossi') {
  const res = await agent.post('/api/technicians').send({ name, role: 'Meccanico' }).expect(201);
  return res.body.technician as { id: string };
}

beforeEach(() => {
  created?.close();
  created = makeApp();
});

afterAll(() => {
  created?.close();
  if (tmpDir) fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('salute e autenticazione', () => {
  it('health è pubblico', async () => {
    const res = await request(created.app).get('/api/health').expect(200);
    expect(res.body.status).toBe('online');
  });

  it('lo snapshot richiede il login', async () => {
    await request(created.app).get('/api/snapshot').expect(401);
  });

  it('password errata → 401', async () => {
    await request(created.app).post('/api/login').send({ password: 'nope' }).expect(401);
  });

  it('login admin e viewer restituiscono il ruolo', async () => {
    const admin = await request.agent(created.app).post('/api/login').send({ password: ADMIN });
    expect(admin.body.role).toBe('admin');
    const viewer = await request.agent(created.app).post('/api/login').send({ password: VIEWER });
    expect(viewer.body.role).toBe('viewer');
  });
});

describe('viewer in sola lettura', () => {
  it('può leggere ma non scrivere', async () => {
    const admin = await adminAgent();
    await createTech(admin);

    const viewer = await viewerAgent();
    const snapshot = await viewer.get('/api/snapshot').expect(200);
    expect(snapshot.body.technicians).toHaveLength(1);

    await viewer
      .put('/api/entries')
      .send({ technicianId: snapshot.body.technicians[0].id, periodType: 'week', weekYear: 2026, weekNumber: 14, hoursPresence: 40 })
      .expect(403);

    await viewer.post('/api/technicians').send({ name: 'Vietato' }).expect(403);
  });
});

describe('entries', () => {
  it('calcola anno e mese di competenza lato server', async () => {
    const admin = await adminAgent();
    const tech = await createTech(admin);
    const res = await admin
      .put('/api/entries')
      .send({
        technicianId: tech.id,
        periodType: 'week',
        weekYear: 2026,
        weekNumber: 1,
        hoursPresence: 40,
        hoursWorked: 35,
        hoursBilled: 30,
      })
      .expect(200);
    // settimana 1 del 2026 → maggioranza dei giorni a gennaio
    expect(res.body.entry.calendarYear).toBe(2026);
    expect(res.body.entry.calendarMonth).toBe(0);
  });

  it('upsert idempotente: due salvataggi = una sola riga', async () => {
    const admin = await adminAgent();
    const tech = await createTech(admin);
    const body = {
      technicianId: tech.id,
      periodType: 'week',
      weekYear: 2026,
      weekNumber: 14,
      hoursPresence: 40,
      hoursWorked: 30,
      hoursBilled: 25,
    };
    await admin.put('/api/entries').send(body).expect(200);
    await admin.put('/api/entries').send({ ...body, hoursBilled: 28 }).expect(200);

    const snapshot = await admin.get('/api/snapshot').expect(200);
    expect(snapshot.body.entries).toHaveLength(1);
    expect(snapshot.body.entries[0].hoursBilled).toBe(28);
  });

  it('blocca settimane + totale mensile sullo stesso tecnico/mese', async () => {
    const admin = await adminAgent();
    const tech = await createTech(admin);
    await admin
      .put('/api/entries')
      .send({ technicianId: tech.id, periodType: 'week', weekYear: 2026, weekNumber: 14, hoursWorked: 30 })
      .expect(200);

    const conflict = await admin
      .put('/api/entries')
      .send({ technicianId: tech.id, periodType: 'month', calendarYear: 2026, calendarMonth: 3, hoursWorked: 120 })
      .expect(409);
    expect(conflict.body.code).toBe('PERIOD_CONFLICT');
    expect(conflict.body.error).toMatch(/settimane/i);

    // e il contrario
    const admin2 = await adminAgent();
    const tech2 = await createTech(admin2, 'Luca Bianchi');
    await admin2
      .put('/api/entries')
      .send({ technicianId: tech2.id, periodType: 'month', calendarYear: 2026, calendarMonth: 3, hoursWorked: 120 })
      .expect(200);
    const reverse = await admin2
      .put('/api/entries')
      .send({ technicianId: tech2.id, periodType: 'week', weekYear: 2026, weekNumber: 15, hoursWorked: 30 })
      .expect(409);
    expect(reverse.body.error).toMatch(/mensile/i);
  });

  it('rifiuta valori negativi', async () => {
    const admin = await adminAgent();
    const tech = await createTech(admin);
    await admin
      .put('/api/entries')
      .send({ technicianId: tech.id, periodType: 'week', weekYear: 2026, weekNumber: 14, hoursWorked: -5 })
      .expect(400);
  });

  it('elimina una riga', async () => {
    const admin = await adminAgent();
    const tech = await createTech(admin);
    const res = await admin
      .put('/api/entries')
      .send({ technicianId: tech.id, periodType: 'week', weekYear: 2026, weekNumber: 14 })
      .expect(200);
    await admin.delete(`/api/entries/${res.body.entry.id}`).expect(200);
    const snapshot = await admin.get('/api/snapshot').expect(200);
    expect(snapshot.body.entries).toHaveLength(0);
  });
});

describe('tecnici', () => {
  it('disattiva un tecnico senza perdere lo storico', async () => {
    const admin = await adminAgent();
    const tech = await createTech(admin);
    await admin
      .put('/api/entries')
      .send({ technicianId: tech.id, periodType: 'week', weekYear: 2026, weekNumber: 14, hoursWorked: 30 })
      .expect(200);

    const res = await admin
      .patch(`/api/technicians/${tech.id}`)
      .send({ active: false })
      .expect(200);
    expect(res.body.technician.active).toBe(false);

    const snapshot = await admin.get('/api/snapshot').expect(200);
    expect(snapshot.body.entries).toHaveLength(1);
  });

  it('non cancella un tecnico con ore registrate', async () => {
    const admin = await adminAgent();
    const tech = await createTech(admin);
    await admin
      .put('/api/entries')
      .send({ technicianId: tech.id, periodType: 'week', weekYear: 2026, weekNumber: 14, hoursWorked: 30 })
      .expect(200);
    const res = await admin.delete(`/api/technicians/${tech.id}`).expect(409);
    expect(res.body.code).toBe('TECHNICIAN_HAS_ENTRIES');
  });

  it('cancella un tecnico inserito per errore (senza ore)', async () => {
    const admin = await adminAgent();
    const tech = await createTech(admin, 'Errore');
    await admin.delete(`/api/technicians/${tech.id}`).expect(200);
    const snapshot = await admin.get('/api/snapshot').expect(200);
    expect(snapshot.body.technicians).toHaveLength(0);
  });
});

describe('backup e ripristino', () => {
  it('esporta e ripristina il contenuto', async () => {
    const admin = await adminAgent();
    const tech = await createTech(admin);
    await admin
      .put('/api/entries')
      .send({ technicianId: tech.id, periodType: 'week', weekYear: 2026, weekNumber: 14, hoursWorked: 30 })
      .expect(200);

    const backup = await admin.get('/api/backup').expect(200);
    expect(backup.body.technicians).toHaveLength(1);
    expect(backup.body.entries).toHaveLength(1);

    // svuota e ripristina
    await admin.delete(`/api/technicians/${tech.id}`).expect(409); // ha ore, resta
    await admin.get('/api/backup').expect(200);

    const restore = await admin.post('/api/restore').send(backup.body).expect(200);
    expect(restore.body.ok).toBe(true);
    const snapshot = await admin.get('/api/snapshot').expect(200);
    expect(snapshot.body.entries).toHaveLength(1);
  });

  it('rifiuta un backup non valido', async () => {
    const admin = await adminAgent();
    await admin.post('/api/restore').send({ foo: 'bar' }).expect(400);
  });
});

describe('realtime', () => {
  it('la revision cresce a ogni scrittura', async () => {
    const admin = await adminAgent();
    const before = await admin.get('/api/revision').expect(200);
    const tech = await createTech(admin);
    await admin
      .put('/api/entries')
      .send({ technicianId: tech.id, periodType: 'week', weekYear: 2026, weekNumber: 20, hoursWorked: 10 })
      .expect(200);
    const after = await admin.get('/api/revision').expect(200);
    expect(after.body.revision).toBeGreaterThan(before.body.revision);
  });
});
