require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const db = require('./db');
const { requireAuth, enforceCompanyAccess } = require('./middleware/auth');
const { apiLimiter } = require('./middleware/rateLimit');

const app = express();

// --- Middleware ---
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : '*',
  credentials: true,
}));
app.use(express.json({ limit: '2mb' }));
app.use('/api/', apiLimiter);

// --- Routes ---
app.use('/api/auth', require('./routes/auth'));
app.use('/api/companies', require('./routes/companies'));
app.use('/api/vehicles', require('./routes/vehicles'));
app.use('/api/damages', require('./routes/damages'));
app.use('/api/calendar', require('./routes/calendar'));
app.use('/api/trips', require('./routes/trips'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/insurance', require('./routes/insurance'));

// --- Blocked Slots (inline, da klein) ---
app.get('/api/blocked-slots', requireAuth, enforceCompanyAccess, async (req, res) => {
  try {
    const { company_id } = req.query;
    let result;
    if (company_id) {
      result = await db.query(
        'SELECT * FROM blocked_slots WHERE company_id = $1 ORDER BY datum',
        [company_id]
      );
    } else {
      result = await db.query('SELECT * FROM blocked_slots ORDER BY datum');
    }
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

app.post('/api/blocked-slots', requireAuth, enforceCompanyAccess, async (req, res) => {
  const { company_id, datum, uhrzeit } = req.body;
  if (!company_id) return res.status(400).json({ error: 'company_id erforderlich' });
  try {
    const result = await db.query(
      'INSERT INTO blocked_slots (company_id, datum, uhrzeit) VALUES ($1,$2,$3) RETURNING *',
      [company_id, datum || null, uhrzeit || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

app.delete('/api/blocked-slots/:id', requireAuth, async (req, res) => {
  try {
    const existing = await db.query(
      'SELECT company_id FROM blocked_slots WHERE id = $1',
      [req.params.id]
    );
    if (!existing.rows.length) return res.status(404).json({ error: 'Nicht gefunden' });
    if (req.user.role === 'kunde' && existing.rows[0].company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }
    await db.query('DELETE FROM blocked_slots WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// --- Frontend statisch ausliefern ---
const frontendPath = path.join(__dirname, '..', 'frontend');
app.use(express.static(frontendPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

// --- Health Check ---
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date().toISOString() }));

// --- Start ---
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Goldpark Backend läuft auf Port ${PORT}`);
});

module.exports = app;

// Health Check
app.get('/health', (req, res) => res.json({ status: 'ok', time: new Date() }));
