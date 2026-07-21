const express = require('express');
const db = require('../db');
const { requireAuth, enforceCompanyAccess } = require('../middleware/auth');

const router = express.Router();

// GET /api/trips?company_id=
router.get('/', requireAuth, enforceCompanyAccess, async (req, res) => {
  try {
    const { company_id } = req.query;
    let result;
    if (company_id) {
      result = await db.query(
        'SELECT * FROM trips WHERE company_id = $1 ORDER BY date DESC',
        [company_id]
      );
    } else {
      result = await db.query('SELECT * FROM trips ORDER BY date DESC');
    }
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST /api/trips
router.post('/', requireAuth, enforceCompanyAccess, async (req, res) => {
  const { company_id, vehicle_id, driver_id, date, start_ort, ziel, zweck, fahrzeit, km, km_stand } = req.body;
  if (!company_id) return res.status(400).json({ error: 'company_id erforderlich' });
  try {
    const result = await db.query(
      `INSERT INTO trips
        (company_id, vehicle_id, driver_id, date, start_ort, ziel, zweck, fahrzeit, km, km_stand)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [company_id, vehicle_id || null, driver_id || null, date || null,
       start_ort || null, ziel || null, zweck || null, fahrzeit || null,
       km || null, km_stand || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// DELETE /api/trips/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const existing = await db.query('SELECT company_id FROM trips WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Nicht gefunden' });
    if (req.user.role === 'kunde' && existing.rows[0].company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }
    await db.query('DELETE FROM trips WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

module.exports = router;
