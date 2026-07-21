require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
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
app.use('/api/angebote', require('./routes/angebote'));
app.use('/api/leasing', require('./routes/leasing'));
app.use('/api/blocked-slots', require('./routes/blockedSlots'));

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
