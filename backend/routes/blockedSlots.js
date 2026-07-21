const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin, enforceCompanyAccess } = require('../middleware/auth');

const router = express.Router();

// GET /api/blocked-slots?company_id=
router.get('/', requireAuth, enforceCompanyAccess, async (req, res) => {
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

// POST /api/blocked-slots — Admin only
router.post('/', requireAuth, requireAdmin, async (req, res) => {
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

// DELETE /api/blocked-slots/:id — Admin only
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const existing = await db.query(
      'SELECT company_id FROM blocked_slots WHERE id = $1',
      [req.params.id]
    );
    if (!existing.rows.length) return res.status(404).json({ error: 'Nicht gefunden' });
    await db.query('DELETE FROM blocked_slots WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

module.exports = router;
