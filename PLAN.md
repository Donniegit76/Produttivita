# Fast_Prod 3.0 — Riscrittura con database SQL, realtime e ruoli

## Perché riscrivere (diagnosi in breve)

L'app attuale ha tre difetti strutturali, non typo isolati:

1. **Autosave rotto**: `saveEntryToServer` / `saveTechnicianToServer` usano una variabile assegnata *dentro* l'updater di React (`setEntries(prev => ...)`), che React esegue in modo differito → la POST parte quasi sempre con valore `null` e la modifica resta solo in locale.
2. **Nessun realtime**: i dati si caricano solo al montaggio della pagina; nessun canale di push verso gli altri dispositivi.
3. **Doppia fonte di verità e "DB" JSON**: `localStorage` + file JSON senza transazioni, con upsert che ignora il mese, integrità referenziale assente e CDN obbligatorie (app inutilizzabile su LAN isolata).

Correggere in place significherebbe riscrivere sync, persistenza e modello dati dentro un monolite di 1503 righe senza moduli né test. Si riscrive l'architettura conservando UI, estetica e funzionalità.

## Decisioni confermate

| # | Tema | Decisione |
|---|------|-----------|
| 1 | Dove gira | PC Ubuntu Server 24.04, Docker; **tutto in un unico container** (frontend compilato + API + DB) |
| 2 | Migrazione dati | **Nessuna** (erano dati di prova) → si parte con database vuoto |
| 3 | Ruoli | **Admin** (inserisce/modifica) e **viewer** (password condivisa, sola lettura); controllo anche lato server |
| 4 | Granularità | Righe **settimanali per tecnico** + possibilità di riga **mensile per tecnico** |
| 5 | Conflitto settimana/mensile | **Blocco alla fonte**: per tecnico/mese o settimane o totale mensile, mai entrambi |
| 6 | Settimana a cavallo di due mesi | **Maggioranza dei giorni** (convenzione ISO), range di date sempre mostrato in UI |
| 7 | Realtime | **SSE** (push immediato) + polling leggero di sicurezza ogni 30 s |
| 8 | Frontend | **Vite + React + TypeScript + Tailwind** compilato; zero CDN, estetica attuale |
| 9 | Backup | **Giornaliero automatico** (30 giorni di retention) + **pulsante nell'interfaccia** per scaricare il backup e ripristinare da file (admin) |
| 10 | Tecnici | **Disattivazione** come flusso normale; cancellazione definitiva solo se non ha ore |
| 11 | Server irraggiungibile | **Banner di avviso e campi in sola lettura**: si fallisce in modo visibile, mai dati solo locali |

## Architettura target

```
┌───────────────────────────── Container fast_prod ─────────────────────────────┐
│  Node 22 + Express                                                             │
│   ├─ /api/*        REST + login + backup + SSE (/api/events)                   │
│   ├─ /             frontend statico compilato (Vite build)                     │
│   └─ /app/data     VOLUME DOCKER                                               │
│        ├─ fast_prod.sqlite   (WAL, foreign_keys ON)                            │
│        └─ backups/*.sqlite.gz (job giornaliero 03:00 Europe/Rome, retention 30)│
└────────────────────────────────────────────────────────────────────────────────┘
        ▲ LAN officina                  ▲ LAN officina
   admin (PC)                        viewer (telefono) — sola lettura
```

Struttura del repo:

```
Produttivita/
├── docker-compose.yml          # servizio unico, porta 8085→8080, volume ./data, healthcheck
├── Dockerfile                  # multi-stage: build web (node) → runtime node:22-bookworm-slim
├── .env.example                # ADMIN_PASSWORD, VIEWER_PASSWORD, SESSION_SECRET, TZ (il .env reale NON va in git)
├── server/src/{index,db,auth,realtime,routes/*}.ts, migrations/*.sql, tests/
├── shared/periods.ts           # calcolo ISO week → mese di maggioranza (usato da server e web)
└── web/src/{features/*,components/*,lib/api.ts,hooks/{useAutosave,useRealtime}.ts}
```

## Modello dati (SQLite, schema v1)

```sql
technicians(
  id TEXT PRIMARY KEY, name TEXT NOT NULL, role TEXT NOT NULL,
  avatar_color TEXT, target_hours REAL DEFAULT 40,
  active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL
);

entries(
  id TEXT PRIMARY KEY,
  technician_id TEXT NOT NULL REFERENCES technicians(id) ON DELETE RESTRICT,
  period_type TEXT NOT NULL CHECK (period_type IN ('week','month')),
  week_year INTEGER, week_number INTEGER,          -- solo period_type='week'
  calendar_year INTEGER NOT NULL,                  -- anno/mese effettivi di aggregazione
  calendar_month INTEGER NOT NULL CHECK (calendar_month BETWEEN 0 AND 11),
  hours_presence REAL NOT NULL DEFAULT 0, hours_worked REAL NOT NULL DEFAULT 0,
  hours_billed REAL NOT NULL DEFAULT 0, hours_to_be_billed REAL NOT NULL DEFAULT 0,
  notes TEXT, updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX ux_entry_week  ON entries(technician_id, week_year, week_number) WHERE period_type='week';
CREATE UNIQUE INDEX ux_entry_month ON entries(technician_id, calendar_year, calendar_month) WHERE period_type='month';
```

Regole di business applicate in transazione:

- **Mese di una settimana**: calcolato dal server (mai accettato dal client) contando i giorni della settimana ISO per mese; in risposta il server restituisce anche `weekStart`/`weekEnd` per la UI.
- **Blocco conflitto**: prima di scrivere una settimana, verifica che non esista una riga mensile per quel tecnico/anno/mese, e viceversa → `409 PERIOD_CONFLICT` con messaggio chiaro in italiano.
- **KPI invariati**: produttività = lavorate/presenza, efficienza = fatturate/lavorate, rendimento = fatturate/presenza, potenziale = (fatturate + da fatturare)/lavorate; Top Performer = 0,5·produttività + 0,5·efficienza.
- **Tecnici**: disattivazione (`active=0`); `DELETE` consentito solo se non esistono ore → altrimenti `409`.

## API (tutte richiedono sessione, tranne login e health)

| Rotta | Ruolo | Note |
|---|---|---|
| `POST /api/login`, `POST /api/logout`, `GET /api/me` | — / tutti | password admin o viewer → ruolo; cookie HttpOnly firmato, 30 gg |
| `GET /api/health` | — | healthcheck Docker |
| `GET /api/snapshot` | tutti | `{ revision, technicians, entries }` |
| `GET /api/revision` | tutti | fallback polling: se cambia, il client rifà lo snapshot |
| `GET /api/events` | tutti | SSE: eventi `{type:'changed', revision}` + heartbeat 25 s |
| `PUT /api/entries` | admin | upsert idempotente per chiave periodo; applica regole mese/conflitto |
| `POST/PATCH /api/technicians[/:id]` | admin | crea / aggiorna / disattiva |
| `DELETE /api/technicians/:id` | admin | solo se senza ore |
| `GET /api/backup` · `POST /api/restore` | admin | JSON dump / ripristino con **backup pre-ripristino automatico** |

## Autosave e realtime lato client

- Ogni cella modificata aggiorna lo stato locale (ottimistico) e accoda un **salvataggio debounced (600 ms)**; indicatore in header: *Salvataggio… / Salvato 14:32 / Errore*.
- Upsert idempotente ⇒ nessun doppio inserimento anche con richieste ripetute; su errore la cella viene marcata e si ritenta una volta.
- Ogni scrittura incrementa la `revision`; SSE notifica tutti i client, che rifanno `GET /api/snapshot` solo se la loro revision è vecchia. Polling ogni 30 s come rete di sicurezza per i telefoni in standby.
- Viewer: UI senza controlli di modifica **e** API che risponde `403` a ogni scrittura.

## Deploy

- `docker compose up -d --build` → `http://IP-SERVER:8085` (porta esterna invariata).
- Un solo container, utente non-root, `restart: unless-stopped`, `TZ=Europe/Rome`, healthcheck su `/api/health`.
- Persistenza: `./data:/app/data`. Backup giornaliero 03:00 in `./data/backups/`, retention 30 giorni.
- Niente HTTPS/dominio in v1 (solo LAN, mai esposta): compatibile con Nginx Proxy Manager in futuro (per SSE: `proxy_buffering off`).

## Passi di lavoro, verifiche e rischi

| # | Passo | Come si verifica | Rischio e mitigazione |
|---|-------|------------------|------------------------|
| 0 | Preparazione repo: branch `rewrite`, struttura cartelle, `.gitignore` (`data/`, `.env`), README | `git status` pulito; nessun file dati o password tracciato | Basso; doppio controllo delle esclusioni |
| 1 | Backend base: Express + TS + SQLite (migrazioni, WAL, FK, transazioni) | Test automatici su migrazioni e vincoli; avvio locale → `/api/health` 200 e DB creato in cartella temporanea | `better-sqlite3` è un modulo nativo: base `bookworm-slim` con prebuild; fallback compilazione |
| 2 | Autenticazione e ruoli | Test: 401 senza cookie, 403 su scrittura viewer, 200 admin; prova manuale login/logout | Cookie senza `Secure` (HTTP in LAN): accettato e documentato; rate-limit sul login |
| 3 | API dati: entry/tecnici, mese di maggioranza, blocco conflitto, disattivazione, revision | Test di integrazione con casi limite: settimana 1 e 53 a cavallo d'anno, conflitto settimana+mensile, delete tecnico con ore, upsert ripetuto | Logica date sbagliata → fixture esplicite per ogni caso; tutto calcolato server-side |
| 4 | Realtime: SSE + revision + polling | Test: due client ricevono l'evento dopo una scrittura; prova manuale con due browser aperti | Telefoni/proxy che chiudono la connessione → heartbeat + fallback polling 30 s |
| 5 | Frontend: scaffold Vite+TS+Tailwind fedele all'estetica attuale, login, navigazione | `npm run build` senza errori; scheda Rete senza richieste a CDN; confronto visivo con la vecchia app | Fedeltà grafica → riuso dei design token attuali di `styles.css` |
| 6 | Viste in sola lettura: dashboard, settimanale, mensile, annuale, tecnici, export/stampa | KPI confrontati a mano con numeri di prova; test unitari sul calcolo dei periodi | Regressioni nei KPI → test con valori noti e formule identiche |
| 7 | Inserimento: griglia settimanale con autosave, modalità mensile, gestione tecnici | Manuale: modifica → indicatore "Salvato" → ricarica → dato presente; mix rifiutato con messaggio; viewer vede il dato apparire in <1 s | Autosave su rete lenta → debounce per cella + upsert idempotente; retry su errore |
| 8 | Export/backup: Excel/CSV/stampa (librerie incluse nel bundle), backup/ripristino admin | Roundtrip backup → ripristino su DB di prova; file `.xlsx` apre correttamente; stampa pulita | Ripristino errato → conferma esplicita + backup pre-ripristino automatico |
| 9 | Docker: Dockerfile multi-stage, compose, volume, healthcheck, job backup | *(lo lanci tu)* `docker compose up -d --build`; `down`+`up` → dati ancora presenti; file in `./data/backups`; log senza errori | Permessi volume → utente non-root con `chown` nel Dockerfile; build nativa |
| 10 | Collaudo su LAN reale + documentazione | Checklist su PC e telefono: ruoli, autosave, realtime, conflitto mensile, backup, stampa | iOS/Android che sospendono SSE → fallback polling; nessun bug bloccante residuo |

## Assunzioni da confermare (le rivedi nel piano)

- Accesso via `http://IP-SERVER:8085`, nessun dominio né HTTPS in v1.
- Un solo admin con password condivisa (titolare/ufficio); viewer con password unica condivisa. Password in `.env` sul server, mai in git.
- Si parte **senza dati**; i tecnici reali li inserisci dall'interfaccia.
- Mantengo tutte le funzioni attuali: 6 viste, coppa Top Performer, export Excel/CSV, stampa.
- Node 22 sul server (già presente anche in locale per sviluppo e test).

## Stato di avanzamento (aggiornato)

- **Passi 0-8 completati** sul branch `rewrite` (commit `286276e`): backend SQLite + API + SSE + ruoli,
  frontend React/Vite/TS/Tailwind, autosave, backup/ripristino, export e stampa.
- Verifiche eseguite in locale:
  - `npm run typecheck` → nessun errore (server + web)
  - `npm run test` → **24 test backend + 6 test frontend** verdi (inclusi autosave e ruoli)
  - `npm run build` → build di produzione web + server senza errori
  - smoke test del bundle di produzione: `/api/health`, login, creazione tecnico, snapshot e
    frontend statico tutti OK
- **Passi 9-10 restano a te** (Docker e collaudo in LAN):

  ```bash
  cp env.example .env      # imposta ADMIN_PASSWORD, VIEWER_PASSWORD, SESSION_SECRET
  docker compose up -d --build
  ```

  Verifica attesa: `http://IP-SERVER:8085` risponde; `docker compose down && docker compose up -d`
  conserva i dati; compare un file in `data/backups/`; con due dispositivi aperti una modifica fatta
  con l'admin appare sull'altro entro un secondo; il viewer non riesce a scrivere.

## Fuori scope v1 (possibili estensioni future)

Dettaglio per commessa/cliente, modalità offline con coda locale, più account admin con audit, HTTPS/dominio, notifiche, PWA installabile.
