const express = require('express');
const db = require('../db');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

async function checkVehicleAccess(vehicleId, user) {
  const result = await db.query(
    'SELECT v.company_id FROM vehicles v WHERE v.id = $1',
    [vehicleId]
  );
  if (!result.rows.length) return { allowed: false, notFound: true };
  if (user.role === 'kunde' && result.rows[0].company_id !== user.company_id) {
    return { allowed: false };
  }
  return { allowed: true };
}

// GET /api/damages?vehicle_id=
router.get('/', requireAuth, async (req, res) => {
  try {
    const { vehicle_id } = req.query;
    let result;
    if (vehicle_id) {
      const access = await checkVehicleAccess(vehicle_id, req.user);
      if (!access.allowed) return res.status(access.notFound ? 404 : 403).json({ error: 'Zugriff verweigert' });
      result = await db.query(
        'SELECT * FROM damages WHERE vehicle_id = $1 ORDER BY date DESC',
        [vehicle_id]
      );
    } else if (req.user.role === 'admin') {
      result = await db.query('SELECT * FROM damages ORDER BY date DESC');
    } else {
      // Alle Schäden der eigenen Firma
      result = await db.query(
        `SELECT d.* FROM damages d
         JOIN vehicles v ON v.id = d.vehicle_id
         WHERE v.company_id = $1
         ORDER BY d.date DESC`,
        [req.user.company_id]
      );
    }
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST /api/damages
router.post('/', requireAuth, async (req, res) => {
  const { vehicle_id, title, description, date, cost, status, type, markers } = req.body;
  if (!vehicle_id) return res.status(400).json({ error: 'vehicle_id erforderlich' });

  try {
    const access = await checkVehicleAccess(vehicle_id, req.user);
    if (!access.allowed) return res.status(access.notFound ? 404 : 403).json({ error: 'Zugriff verweigert' });

    const result = await db.query(
      `INSERT INTO damages (vehicle_id, title, description, date, cost, status, type, markers)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        vehicle_id,
        title || null,
        description || null,
        date || null,
        cost || '0',
        status || 'open',
        type || 'sonstiges',
        JSON.stringify(markers || []),
      ]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// PUT /api/damages/:id
router.put('/:id', requireAuth, async (req, res) => {
  const { title, description, date, cost, status, type, markers } = req.body;
  try {
    const existing = await db.query(
      'SELECT d.vehicle_id, v.company_id FROM damages d JOIN vehicles v ON v.id = d.vehicle_id WHERE d.id = $1',
      [req.params.id]
    );
    if (!existing.rows.length) return res.status(404).json({ error: 'Nicht gefunden' });
    if (req.user.role === 'kunde' && existing.rows[0].company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }

    const result = await db.query(
      `UPDATE damages SET title=$1, description=$2, date=$3, cost=$4, status=$5, type=$6, markers=$7
       WHERE id=$8 RETURNING *`,
      [
        title || null,
        description || null,
        date || null,
        cost || '0',
        status || 'open',
        type || 'sonstiges',
        JSON.stringify(markers || []),
        req.params.id,
      ]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// DELETE /api/damages/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const existing = await db.query(
      'SELECT d.vehicle_id, v.company_id FROM damages d JOIN vehicles v ON v.id = d.vehicle_id WHERE d.id = $1',
      [req.params.id]
    );
    if (!existing.rows.length) return res.status(404).json({ error: 'Nicht gefunden' });
    if (req.user.role === 'kunde' && existing.rows[0].company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }
    await db.query('DELETE FROM damages WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

module.exports = router;
