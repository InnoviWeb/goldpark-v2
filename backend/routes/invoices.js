const express = require('express');
const db = require('../db');
const { requireAuth, enforceCompanyAccess } = require('../middleware/auth');

const router = express.Router();

// GET /api/invoices?company_id=
router.get('/', requireAuth, enforceCompanyAccess, async (req, res) => {
  try {
    const { company_id } = req.query;
    let result;
    if (company_id) {
      result = await db.query(
        'SELECT * FROM invoices WHERE company_id = $1 ORDER BY created_at DESC',
        [company_id]
      );
    } else {
      result = await db.query('SELECT * FROM invoices ORDER BY created_at DESC');
    }
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST /api/invoices
router.post('/', requireAuth, enforceCompanyAccess, async (req, res) => {
  const { company_id, data } = req.body;
  if (!company_id) return res.status(400).json({ error: 'company_id erforderlich' });
  try {
    const result = await db.query(
      'INSERT INTO invoices (company_id, data) VALUES ($1,$2) RETURNING *',
      [company_id, JSON.stringify(data || {})]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// DELETE /api/invoices/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const existing = await db.query('SELECT company_id FROM invoices WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Nicht gefunden' });
    if (req.user.role === 'kunde' && existing.rows[0].company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }
    await db.query('DELETE FROM invoices WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

module.exports = router;
