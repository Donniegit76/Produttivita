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

## Pubblicare e riusare l'immagine (Docker Hub)

Immagine pubblica: `donniedream/fast_prod`.

**Pubblicare** (dalla macchina con Docker, dopo aver pushato il codice):

```bash
# sostituisci 3.1 con la versione che vuoi taggare
docker login -u donniedream
docker build -t donniedream/fast_prod:3.1 -t donniedream/fast_prod:latest .
docker push donniedream/fast_prod:3.1
docker push donniedream/fast_prod:latest
```

**Usarla sul server** (senza costruire l'immagine in locale): nel `.env` imposta

```bash
IMAGE=donniedream/fast_prod:3.1
```

poi:

```bash
docker compose pull
docker compose up -d
```

Con `IMAGE` non impostato, `docker compose up -d --build` continua a costruire l'immagine in locale.
L'immagine non contiene segreti: password e dati vivono nel `.env` e nel volume `./data`.

### Pubblicazione automatica (GitHub Actions)

Il workflow `.github/workflows/docker-publish.yml` testa il codice e poi costruisce e pubblica
l'immagine quando pushi un **tag di versione**, senza comandi manuali.

Configura una volta sola, in GitHub → *Settings → Secrets and variables → Actions*:

| Secret | Valore |
|---|---|
| `DOCKERHUB_USERNAME` | `donniedream` |
| `DOCKERHUB_TOKEN` | un **Access Token** di Docker Hub (Account Settings → Personal access tokens → *Read & Write*) — non la password |

Per rilasciare una nuova versione:

```bash
git tag v3.2.0
git push origin v3.2.0
```

Il workflow genera i tag `3.2.0`, `3.2`, `latest` e `sha-<commit>`. Si può avviare anche a mano da
GitHub → *Actions → Build e pubblica su Docker Hub → Run workflow*. I test girano prima del push:
se falliscono, l'immagine non viene pubblicata.

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

- `departments(id, name univoco, color, created_at)`
- `technicians(id, name, role, avatar_color, target_hours, active, department_id, created_at)`
- `entries(id, technician_id, department_id, period_type|week|month, week_year, week_number,
  calendar_year, calendar_month, hours_presence, hours_worked, hours_billed, hours_to_be_billed,
  notes, updated_at)`

Regole:
- Una settimana appartiene al mese in cui cadono più suoi giorni (convenzione ISO).
- Per uno stesso **tecnico/mese** non possono coesistere righe settimanali e un totale mensile
  (**blocco alla fonte**).
- Ogni tecnico appartiene a **un solo reparto**; il reparto è obbligatorio.
- La **riga di ore fotografa il reparto** al momento del salvataggio: spostare un tecnico non cambia i
  report passati. Modificare una riga vecchia **non** riscrive il suo reparto.
- Eliminare un reparto è possibile solo se non contiene tecnici **e** non è usato da righe storiche
  (in alternativa si rinomina).
- KPI: produttività = lavorate/presenza, efficienza = fatturate/lavorate, **resa = fatturate/presenza**.

---

## Reparti, report e mobile

- **Reparti**: si creano/rinominano/eliminano da *Tecnici e reparti*. Un **menu a tendina nell'header**
  filtra tutte le viste (dashboard, inserimento, mensile, annuale, export e stampa).
- **Modifica tecnici**: dalla scheda del tecnico puoi correggere nome, ruolo, colore e reparto.
- **Report mensile stampabile**: il pulsante Stampa (header, vista Mensile ed Export) produce sempre il
  **report del mese e del reparto selezionati** — intestazione, Top Performer, tabella per tecnico con
  presenza, lavorate, fatturate, da fatturare, produttività, efficienza e **resa**, più i totali. Senza
  grafici, pronto per PDF/firma.
- **Mobile**: sotto la larghezza tablet le tabelle diventano schede (card) con campi grandi; i campi
  usano font 16px per evitare lo zoom automatico di iOS.

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
