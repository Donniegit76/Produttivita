# Fast_Prod — Piani di lavoro

---

# PIANO ATTIVO — v3.1: bug stampa, modifica tecnici, reparti, mobile

## Stato: COMPLETATO (in attesa di collaudo su LAN)

Implementato e verificato in locale: migrazione `002_departments`, API reparti con regole, snapshot del
reparto sulle righe, selettore globale, modifica tecnici, report mensile stampabile con colonna Resa,
mobile a schede. Test: **33 backend + 11 frontend** verdi; `typecheck` e `build` OK; smoke test del bundle
di produzione verificato (reparto creato, tecnico assegnato, riga con reparto, eliminazione bloccata con 409).

## Obiettivi richiesti

1. **Bug stampa**: il tasto Stampa deve produrre il **report mensile**, non la pagina corrente.
2. **Modifica tecnici**: poter correggere nome, ruolo e colore di un tecnico esistente.
3. **Mobile**: interfaccia ottimizzata per telefono.
4. **Reparti**: reparti separati, con classifiche proprie, selezionabili da menu a tendina.

## Decisioni confermate

| # | Tema | Decisione |
|---|------|-----------|
| 1 | Appartenenza | **Un solo reparto per tecnico** (campo sul tecnico) |
| 2 | Gestione reparti | **L'admin li crea/rinomina/elimina** da interfaccia; eliminazione bloccata se contiene tecnici |
| 3 | Storico | **Fotografia al salvataggio**: ogni riga di ore ricorda il reparto di quel momento |
| 4 | Selettore | **Un unico menu reparto nell'header** ("Tutti i reparti" di default) che filtra tutte le viste |
| 5 | Stampa | **Report mensile dedicato** (mese + reparto correnti, top performer, tabella, totali), senza grafici. Colonna aggiuntiva **Resa** = ore fatturate / ore presenza |
| 6 | Mobile | **Card sotto il breakpoint tablet, tabelle su desktop** |
| 7 | Disattivati | Nei **report** compaiono anche i tecnici disattivati con ore nel periodo; in **inserimento** solo gli attivi |

## Schema dati (migrazione `002_departments`)

```sql
departments(id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE COLLATE NOCASE,
            color TEXT NOT NULL DEFAULT '#06b6d4', created_at TEXT NOT NULL)

ALTER TABLE technicians ADD COLUMN department_id TEXT REFERENCES departments(id);
ALTER TABLE entries     ADD COLUMN department_id TEXT;   -- fotografia del reparto

-- backfill dei dati esistenti
INSERT INTO departments (id, name, ...) VALUES ('dept-generale', 'Generale', ...);
UPDATE technicians SET department_id = 'dept-generale' WHERE department_id IS NULL;
UPDATE entries SET department_id = (SELECT department_id FROM technicians t
                                    WHERE t.id = entries.technician_id)
                WHERE department_id IS NULL;
CREATE INDEX ix_technicians_department ON technicians(department_id);
CREATE INDEX ix_entries_department     ON entries(department_id, calendar_year, calendar_month);
```

Regole applicate dal server (in transazione):

- **Nuova riga di ore** → `department_id` = reparto attuale del tecnico.
- **Modifica di una riga esistente** → **mantiene** il reparto storico (non lo riscrive).
- **Eliminazione reparto** → `409` se ha tecnici assegnati **o** righe di ore che lo referenziano; in alternativa si rinomina.
- **Nome reparto** → unico, senza distinzione maiuscole/minuscole.

## API

| Rotta | Ruolo | Note |
|---|---|---|
| `GET /api/departments` | tutti | elenco con conteggio tecnici |
| `POST/PATCH/DELETE /api/departments[/:id]` | admin | delete → 409 se non vuoto |
| `POST/PATCH /api/technicians` | admin | accettano `departmentId` |
| `PUT /api/entries` | admin | salva il reparto al primo inserimento, lo conserva in modifica |
| `GET /api/snapshot` | tutti | include anche `departments` |

## Frontend

- **Contesto filtri condiviso**: reparto selezionato + mese/anno di riferimento (oggi sono stato locale della vista Mensile). Serve al report stampabile richiamabile da qualsiasi vista.
- **Header**: selettore reparto; il pulsante Stampa stampa **sempre** il report mensile del mese/reparto correnti.
- **Tecnici**: nuova scheda "Reparti" (crea, rinomina inline, colore, elimina) e pulsante **Modifica** su ogni tecnico → form inline con nome, ruolo, colore, reparto (l'API `PATCH` esiste già).
- **Report mensile stampabile**: componente dedicato (`.print-only`) con intestazione mese/anno/reparto, Top Performer, tabella per tecnico (presenza, lavorate, fatturate, da fatturare, produttività, efficienza, **resa** = fatturate/presenza) e riga totali; tutto il resto dell'app diventa `.no-print` durante la stampa. Attivato da: pulsante header, pulsante nella vista Mensile, pulsante in Stampa & Esporta.
- **Colonna Resa** (fatturate/presenza) aggiunta anche alle tabelle a schermo Mensile e Annuale e all'export Excel/CSV, per coerenza con il report stampato.
- **Filtro reparto** applicato a: dashboard (classifica e top performer), inserimento, mensile, annuale, export, report di stampa.
- **Disattivati nei report**: le viste di analisi usano "chi ha ore nel periodo ∪ attivi", con badge "disattivato"; l'inserimento resta sui soli attivi.
- **Mobile**: card per inserimento (2×2 campi numerici + note a tutta larghezza), card per le classifiche con KPI come badge; `font-size: 16px` sui campi per evitare lo zoom automatico iOS; bersagli touch più grandi. Da desktop le tabelle restano identiche a oggi.
- **Export**: nuova colonna "Reparto" e rispetto del filtro attivo.

## Passi, verifiche e rischi

| # | Passo | Come si verifica | Rischio e mitigazione |
|---|-------|------------------|------------------------|
| 0 | Migrazione `002` + backfill "Generale" | test su un DB creato con la `001` e popolato: dopo la migrazione tecnici/righe hanno reparto e i KPI non cambiano | migrazione su DB già in uso → testare su una **copia** del `fast_prod.sqlite` prima del deploy |
| 1 | API reparti + snapshot reparto su tecnici/entries | test: CRUD, 409 su delete con tecnici/righe, reparto mantenuto in modifica riga, nomi duplicati rifiutati | regole di delete rigide → rinomina come alternativa documentata |
| 2 | Contesto filtri condiviso + selettore nell'header | test: cambiando reparto cambiano classifica, mensile, annuale ed export; "Tutti i reparti" torna a mostrare tutto | stato condiviso da introdurre senza rompere weekly/monthly attuali |
| 3 | Gestione reparti e modifica tecnico in UI | manuale: rinomina reparto, correggi nome/ruolo/colore, cambia reparto a un tecnico → riflesso su tutti i dispositivi via SSE | validazione nome vuoto/duplicato |
| 4 | Filtro applicato a tutte le viste + disattivati nei report | test: tecnico disattivato con ore di marzo compare nel report di marzo con badge; a aprile no | dimenticare una vista → checklist delle 6 viste |
| 5 | Stampa report mensile (con colonna Resa) + fix dei 3 pulsanti | manuale: stampa da Dashboard, Settimanale ed Export → esce il report mensile del reparto/mese correnti, con la colonna Resa; anteprima PDF pulita | differenze tra browser; contenuto principale da nascondere in stampa (`.no-print`) |
| 6 | Mobile: card e ritocchi | manuale su telefono reale: inserire le ore, leggere classifiche, nessuno zoom iOS al focus | regressioni desktop → tabelle invariate sopra il breakpoint |
| 7 | Export con colonna reparto + aggiornamento README | manuale: xlsx e CSV contengono il reparto e rispettano il filtro | — |
| 8 | Collaudo su LAN e push | checklist: due dispositivi, modifica tecnico, filtro reparto, stampa, mobile | — |

## Assunzioni e punti aperti da confermare

- Esistono già dati reali? La migrazione è scritta per non perderli, ma **va provata su una copia** prima di aggiornare il container.
- Il reparto è **obbligatorio** per ogni tecnico; i dati esistenti finiscono in **"Generale"**, rinominabile.
- Eliminazione di un reparto **anche** quando è referenziato da righe storiche: in quel caso resta solo la rinomina (conseguenza della scelta "fotografia").
- Modificare una riga vecchia **non** sposta il suo reparto storico.
- Il filtro reparto **non** viene ricordato tra sessioni (riparte da "Tutti i reparti"); dimmi se lo vuoi persistente.
- `targetHours` resta presente nel database ma non in interfaccia (non richiesto).
- Il viewer può stampare ed esportare; solo l'admin modifica.

## Fuori scope v3.1

Multi-reparto per tecnico, spostamento massivo dello storico tra reparti, grafici nel report stampato, PWA installabile.

---
---

# PIANO v3.0 — COMPLETATO (riferimento)

Riscrittura con database SQLite in container, realtime SSE, ruoli admin/viewer, autosave e Docker.
Tutti i passi 0–8 completati sul branch `rewrite`; collaudo Docker/LAN in corso.
Dettaglio completo: `plan/2026-10-14_fast-prod-rewrite.md` (e storia git).
