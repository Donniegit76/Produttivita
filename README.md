# Fast_Prod 3.0 🏆

Gestione della produttività e dell'efficienza dei tecnici di officina (meccanica/elettrauto),
riscritta con **database SQLite**, **automatic saving**, **aggiornamento in tempo reale**,
**ruoli admin/utente** e **Docker**. Pensata per la **rete locale**: non va esposta a Internet.

---

## Cosa è cambiato rispetto alla versione precedente

| Problema della versione vecchia | Soluzione in Fast_Prod 3.0 |
|---|---|
| Il salvataggio automatico non partiva (bug React degli updater differiti) | Autosave con debounce centralizzato + upsert idempotente, con test automatici che lo verificano |
| Nessun aggiornamento sugli altri dispositivi | Canale **SSE** (push immediato) + polling di sicurezza ogni 30 s |
| Dati in `localStorage` + file JSON, fonte doppia e divergente | **Unica fonte di verità**: SQLite sul server; niente scritture locali |
| Settimana/mese incoerenti, upsert che ignorava il mese | Settimane **ISO**, mese di competenza calcolato dal server (maggioranza dei giorni) |
| Nessuna integrità: tecnici cancellati con ore orfane | Disattivazione + cancellazione solo se il tecnico non ha ore |
| CDN obbligatorie (app inutile offline) | Frontend compilato e incluso nell'immagine: **nessuna dipendenza da Internet** |
| Monolite di 1500 righe senza moduli/test | Backend TypeScript modulare + frontend React/Vite, con test |

---

## Architettura

```
┌──────────────────────── Container fast_prod ─────────────────────────┐
│  Node 22 + Express                                                    │
│   ├─ /api/*   REST + login + backup + SSE (/api/events)               │
│   ├─ /        frontend compilato (Vite build)                         │
│   └─ /app/data  VOLUME persistente                                    │
│        ├─ fast_prod.sqlite                                            │
│        └─ backups/fast_prod_YYYY-MM-DD.sqlite.gz                      │
└───────────────────────────────────────────────────────────────────────┘
        ▲ LAN officina                ▲ LAN officina
   admin (PC)                     viewer (telefono, sola lettura)
```

- **Backend**: `server/` (Express + better-sqlite3 + SSE), bundle unico con esbuild.
- **Frontend**: `web/` (Vite + React + TypeScript + Tailwind), design identico alla versione precedente.
- **Codice condiviso**: `shared/periods.ts` (settimane ISO e mese di competenza).

---

## Avvio su Ubuntu Server (Docker)

1. **Crea il file `.env`** partendo da `env.example` e scegli le password:

   ```bash
   cp env.example .env
   nano .env
   ```

   Variabili: `ADMIN_PASSWORD`, `VIEWER_PASSWORD`, `SESSION_SECRET`, `TZ`, `BACKUP_RETENTION_DAYS`,
   `BIND_ADDRESS` (consigliato: l'IP LAN del server, es. `192.168.1.50`).

   Il `SESSION_SECRET` deve essere lungo e casuale. Per generarlo:

   ```bash
   openssl rand -hex 32
   ```

2. **Avvia**:

   ```bash
   docker compose up -d --build
   ```

3. **Accedi** da PC o telefono:

   ```
   http://IP-DEL-SERVER:8085
   ```

   - password **admin** → inserisce e modifica i dati;
   - password **utente** → consultazione in sola lettura.

Log: `docker compose logs -f`. Arresto: `docker compose down`.

> **Permessi della cartella dati** — il container gira come utente non privilegiato `node`
> (uid 1000) e deve poter scrivere in `./data`. Se vedi `SQLITE_CANTOPEN` nei log, la cartella è di
> proprietà di `root`: correggi con `sudo chown -R $(id -u):$(id -g) data` e riavvia con
> `docker compose up -d --force-recreate`.

I dati vivono nella cartella `./data` (volume): sopravvivono a riavvii, aggiornamenti e ricostruzioni
dell'immagine.

---

## Backup e ripristino

- **Automatico**: ogni giorno alle 03:00 (ora locale) viene creata una copia consistente e compressa
  in `./data/backups/`, con retention di 30 giorni (configurabile).
- **Manuale**: nella sezione *Stampa & Esporta* l'admin può scaricare un **backup JSON** o il **file
  SQLite** completo, e **ripristinare** da un backup JSON. Prima di ogni ripristino viene creato
  automaticamente un backup di sicurezza.

---

## Ruoli e sicurezza

- Due password distinte definite nel `.env`; la sessione è un cookie firmato (HttpOnly, 30 giorni).
- I **viewer** vedono tutto ma non possono scrivere: il blocco è applicato **lato server** (403), non
  solo nell'interfaccia.
- Pensata per la rete locale. Se in futuro la esponi tramite Nginx Proxy Manager con HTTPS, abilita
  `proxy_buffering off` per gli eventi SSE (`/api/events`) e aggiungi il flag `Secure` al cookie.

---

## Firewall

- **Non serve** aprire porte sul router/firewall di rete: il port forwarding servirebbe solo per
  l'accesso da Internet, che è da evitare.
- **Docker e ufw**: le porte pubblicate da Docker passano da regole `iptables` che **aggirano ufw**,
  quindi la 8085 risulta raggiungibile senza aprire nulla. Per limitarla alla LAN, imposta
  `BIND_ADDRESS` al posto giusto: con `BIND_ADDRESS=192.168.1.50` la porta è esposta solo su
  quell'interfaccia.
- Per controllare: `sudo ufw status` e `hostname -I` (per conoscere l'IP LAN).

---

## Modello dati

- `technicians(id, name, role, avatar_color, target_hours, active, created_at)`
- `entries(id, technician_id, period_type|week|month, week_year, week_number, calendar_year,
  calendar_month, hours_presence, hours_worked, hours_billed, hours_to_be_billed, notes, updated_at)`

Regole:
- Una settimana appartiene al mese in cui cadono più suoi giorni (convenzione ISO).
- Per uno stesso **tecnico/mese** non possono coesistere righe settimanali e un totale mensile
  (**blocco alla fonte**).
- KPI invariati: produttività = lavorate/presenza, efficienza = fatturate/lavorate,
  rendimento = fatturate/presenza.

---

## Sviluppo

```bash
npm install                 # dalla cartella del progetto
npm --workspace server run dev   # API su :8080 (tsx watch)
npm --workspace web run dev      # frontend su :5173 (proxy /api → :8080)
```

Test e controlli:

```bash
npm --workspace server run test        # 22 test: API, ruoli, conflitti, backup, settimane
npm --workspace web run test           # KPI + autosave (con verifica del salvataggio)
npm run typecheck                      # TypeScript su server e web
npm run build                          # build di produzione
```

---

## Struttura del progetto

```
.
├── docker-compose.yml        # servizio unico, porta 8085→8080, volume ./data
├── Dockerfile                # build multi-stage (web + server) → runtime node slim
├── env.example               # modello per il file .env
├── shared/periods.ts         # settimane ISO e mese di competenza (condiviso)
├── server/                   # Express + SQLite + SSE + test
└── web/                      # React + Vite + TypeScript + Tailwind
```

---

## Note tecniche

- **XLSX**: la libreria `xlsx` (SheetJS) compare in `npm audit` per vulnerabilità che si attivano
  *analizzando* file Excel di terzi. In questa app il formato Excel viene **solo generato** in fase di
  esportazione, mai importato, quindi l'esposizione non è applicabile. Se in futuro servisse importare
  file Excel, va scelta una libreria mantenuta.
- **Password**: il login confronta le password in modo constant-time rispetto a quelle del `.env`;
  non esiste una tabella utenti. Cambiare una password richiede di modificare il `.env` e riavviare
  il container.

---

## Licenza

MIT — vedi [LICENSE](LICENSE).
