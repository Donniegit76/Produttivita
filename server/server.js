/* Fast_Prod - Express REST API Backend Server with Database Persistence */
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 8080;

// Enable CORS and JSON Body Parser
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Ensure data directory exists
const DATA_DIR = path.join(__dirname, '../data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_FILE = path.join(DATA_DIR, 'fast_prod_db.json');

// Default Seed Data
const DEFAULT_TECHNICIANS = [
  { id: 'tech-1', name: 'Marco Rossi', role: 'Capo Officina', avatarColor: '#f59e0b', active: true, targetHours: 40 },
  { id: 'tech-2', name: 'Luca Bianchi', role: 'Meccanico Senior', avatarColor: '#10b981', active: true, targetHours: 40 },
  { id: 'tech-3', name: 'Andrea Verdi', role: 'Elettrauto', avatarColor: '#06b6d4', active: true, targetHours: 40 },
  { id: 'tech-4', name: 'Stefano Neri', role: 'Tecnico Diagnostica', avatarColor: '#8b5cf6', active: true, targetHours: 40 },
  { id: 'tech-5', name: 'Giuseppe Viola', role: 'Meccanico Junior', avatarColor: '#ec4899', active: true, targetHours: 40 }
];

const generateSeedEntries = () => {
  const entries = [];
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth();
  
  DEFAULT_TECHNICIANS.forEach((tech, techIdx) => {
    for (let m = currentMonth - 2; m <= currentMonth; m++) {
      const targetM = (m + 12) % 12;
      const targetY = m < 0 ? currentYear - 1 : currentYear;
      
      for (let w = 1; w <= 4; w++) {
        const weekNum = (targetM * 4) + w;
        let pres = 38 + (techIdx % 3);
        let worked = Math.round(pres * (0.80 + (techIdx * 0.04)));
        let billed = Math.round(worked * (0.90 + (techIdx * 0.05)));
        let toBeBilled = Math.round(worked * 0.08);

        if (techIdx === 0) {
          worked = 37;
          billed = 42;
          toBeBilled = 4;
        }

        entries.push({
          id: `entry-${tech.id}-${targetY}-W${weekNum}`,
          technicianId: tech.id,
          weekNumber: weekNum,
          month: targetM,
          year: targetY,
          hoursPresence: pres,
          hoursWorked: worked,
          hoursBilled: billed,
          hoursToBeBilled: toBeBilled,
          notes: 'Manutenzione ordinarie e tagliandi'
        });
      }
    }
  });
  return entries;
};

// Database helper: Read & Write atomically
const loadDatabase = () => {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        technicians: parsed.technicians || DEFAULT_TECHNICIANS,
        entries: parsed.entries || generateSeedEntries()
      };
    }
  } catch (err) {
    console.error('Error loading database file, initializing defaults:', err);
  }

  const initialData = {
    technicians: DEFAULT_TECHNICIANS,
    entries: generateSeedEntries()
  };
  saveDatabase(initialData);
  return initialData;
};

const saveDatabase = (data) => {
  try {
    const tempFile = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.error('Failed to save database file:', err);
  }
};

// In-Memory Cache synced to File DB
let db = loadDatabase();

// ---------------- REST API ROUTES ----------------

// API Status & Health Check
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    appName: 'Fast_Prod',
    database: 'connected',
    techniciansCount: db.technicians.length,
    entriesCount: db.entries.length,
    serverTime: new Date().toISOString()
  });
});

// GET Technicians
app.get('/api/technicians', (req, res) => {
  res.json(db.technicians);
});

// POST Technician (Add/Update)
app.post('/api/technicians', (req, res) => {
  const newTech = req.body;
  if (!newTech || !newTech.name) {
    return res.status(400).json({ error: 'Nome del tecnico obbligatorio' });
  }

  const existingIdx = db.technicians.findIndex(t => t.id === newTech.id);
  if (existingIdx >= 0) {
    db.technicians[existingIdx] = { ...db.technicians[existingIdx], ...newTech };
  } else {
    if (!newTech.id) newTech.id = `tech-${Date.now()}`;
    db.technicians.push(newTech);
  }

  saveDatabase(db);
  res.json({ success: true, technician: newTech, technicians: db.technicians });
});

// PUT Technician by ID
app.put('/api/technicians/:id', (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  
  const idx = db.technicians.findIndex(t => t.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: 'Tecnico non trovato' });
  }

  db.technicians[idx] = { ...db.technicians[idx], ...updates };
  saveDatabase(db);
  res.json({ success: true, technician: db.technicians[idx] });
});

// DELETE Technician by ID
app.delete('/api/technicians/:id', (req, res) => {
  const { id } = req.params;
  db.technicians = db.technicians.filter(t => t.id !== id);
  saveDatabase(db);
  res.json({ success: true, message: 'Tecnico rimosso' });
});

// GET Entries
app.get('/api/entries', (req, res) => {
  res.json(db.entries);
});

// POST Entry (Upsert Single Record)
app.post('/api/entries', (req, res) => {
  const entry = req.body;
  if (!entry || !entry.technicianId) {
    return res.status(400).json({ error: 'Dati commessa o tecnico non validi' });
  }

  const existingIdx = db.entries.findIndex(e =>
    e.technicianId === entry.technicianId &&
    e.weekNumber === entry.weekNumber &&
    e.year === entry.year
  );

  if (existingIdx >= 0) {
    db.entries[existingIdx] = { ...db.entries[existingIdx], ...entry };
  } else {
    if (!entry.id) entry.id = `entry-${entry.technicianId}-${entry.year}-W${entry.weekNumber}`;
    db.entries.push(entry);
  }

  saveDatabase(db);
  res.json({ success: true, entry });
});

// POST Entries Bulk (Save array of entries)
app.post('/api/entries/bulk', (req, res) => {
  const newEntries = req.body;
  if (!Array.isArray(newEntries)) {
    return res.status(400).json({ error: 'Formato dati non valido, attesa matrice di record' });
  }

  newEntries.forEach(entry => {
    const existingIdx = db.entries.findIndex(e =>
      e.technicianId === entry.technicianId &&
      e.weekNumber === entry.weekNumber &&
      e.year === entry.year
    );

    if (existingIdx >= 0) {
      db.entries[existingIdx] = { ...db.entries[existingIdx], ...entry };
    } else {
      db.entries.push(entry);
    }
  });

  saveDatabase(db);
  res.json({ success: true, count: db.entries.length });
});

// GET Export Backup
app.get('/api/backup', (req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename=Fast_Prod_DB_Backup_${new Date().toISOString().split('T')[0]}.json`);
  res.send(JSON.stringify(db, null, 2));
});

// POST Import Backup
app.post('/api/restore', (req, res) => {
  const backup = req.body;
  if (!backup || !Array.isArray(backup.technicians) || !Array.isArray(backup.entries)) {
    return res.status(400).json({ error: 'Struttura backup non valida' });
  }

  db = {
    technicians: backup.technicians,
    entries: backup.entries
  };
  saveDatabase(db);
  res.json({ success: true, message: 'Database ripristinato con successo' });
});

// Serve Static Web Frontend Files (index.html, css, js)
app.use(express.static(path.join(__dirname, '../')));

// Catch-all route to serve index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  Fast_Prod Server attivo sulla porta ${PORT}`);
  console.log(`  Database Persistente: ${DB_FILE}`);
  console.log(`=======================================================`);
});
