# Fast_Prod 🏆 - Gestione Produttività ed Efficienza Officina (con Database Persistente)

**Fast_Prod** è la webapp professionale ideata per le officine meccaniche ed elettrauto per monitorare, calcolare ed analizzare in tempo reale il rendimento, la produttività e l'efficienza dei propri tecnici, con **Database Persistente Centralizzato** su Docker.

---

## 🛢️ Nuova Architettura Database & Server

1. **Database Persistente Centralizzato**:
   * I dati non sono più memorizzati solo nel browser ma vengono **salvati in modo permanente sul server** nel file `./data/fast_prod_db.json` tramite un **Volume Docker**.
   * Qualsiasi modifica effettuata da un PC, tablet o smartphone è **sincronizzata istantaneamente su tutti i dispositivi dell'officina**.
   * I dati **non vanno mai persi**, anche riavviando o ricompilando i container Docker.

2. **Backend Express REST API**:
   * Server Node.js/Express ad alte prestazioni (`server/server.js`) che espone le rotte API per tecnici, commesse, backup e ripristino.

---

## 🚀 Avvio tramite Docker (Deckerizzato per Server)

Per avviare **Fast_Prod** con il database persistente sul tuo server o locale:

```bash
# Avvio del container con volume data persistente (Porta 8085)
docker compose up -d --build
```

L'applicazione sarà subito accessibile all'indirizzo:
👉 **`http://localhost:8085`** (o `http://IP-DEL-SERVER:8085`)

In **Nginx Proxy Manager**, fai il proxy pass verso `http://127.0.0.1:8085` per assegnarle un dominio ed HTTPS!

---

## 📊 Calcolo KPI Officina

* **Produttività (%)**: $\frac{\text{Ore Lavorate}}{\text{Ore Presenza}} \times 100$
* **Efficienza (%)**: $\frac{\text{Ore Fatturate}}{\text{Ore Lavorate}} \times 100$
* **Rendimento Globale (%)**: $\frac{\text{Ore Fatturate}}{\text{Ore Presenza}} \times 100$
* **Coppa Top Performer 🏆**: Assegnata al tecnico più produttivo ed efficiente del periodo selezionato.
