const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// GET /api/companies — Admin: alle; Kunde: eigene
router.get('/', requireAuth, async (req, res) => {
  try {
    let result;
    if (req.user.role === 'admin') {
      result = await db.query('SELECT * FROM companies ORDER BY name');
    } else {
      if (!req.user.company_id) return res.json([]);
      result = await db.query('SELECT * FROM companies WHERE id = $1', [req.user.company_id]);
    }
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET /api/companies/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    if (req.user.role === 'kunde' && req.user.company_id !== req.params.id) {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }
    const result = await db.query('SELECT * FROM companies WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Nicht gefunden' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST /api/companies — Admin only
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { name, contact, phone, email } = req.body;
  if (!name) return res.status(400).json({ error: 'Name erforderlich' });
  try {
    const result = await db.query(
      'INSERT INTO companies (name, contact, phone, email) VALUES ($1,$2,$3,$4) RETURNING *',
      [name, contact || null, phone || null, email || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// PUT /api/companies/:id — Admin only
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { name, contact, phone, email } = req.body;
  if (!name) return res.status(400).json({ error: 'Name erforderlich' });
  try {
    const result = await db.query(
      'UPDATE companies SET name=$1, contact=$2, phone=$3, email=$4 WHERE id=$5 RETURNING *',
      [name, contact || null, phone || null, email || null, req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Nicht gefunden' });
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// DELETE /api/companies/:id — Admin only
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.query('DELETE FROM companies WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

module.exports = router;
