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

// GET /api/leasing?vehicle_id=
router.get('/', requireAuth, async (req, res) => {
  try {
    const { vehicle_id } = req.query;
    let result;
    if (vehicle_id) {
      const access = await checkVehicleAccess(vehicle_id, req.user);
      if (!access.allowed) return res.status(access.notFound ? 404 : 403).json({ error: 'Zugriff verweigert' });
      result = await db.query(
        'SELECT * FROM leasing WHERE vehicle_id = $1 ORDER BY created_at DESC',
        [vehicle_id]
      );
    } else if (req.user.role === 'admin') {
      result = await db.query('SELECT * FROM leasing ORDER BY created_at DESC');
    } else {
      result = await db.query(
        `SELECT l.* FROM leasing l
         JOIN vehicles v ON v.id = l.vehicle_id
         WHERE v.company_id = $1
         ORDER BY l.created_at DESC`,
        [req.user.company_id]
      );
    }
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST /api/leasing
router.post('/', requireAuth, async (req, res) => {
  const { vehicle_id, data } = req.body;
  if (!vehicle_id) return res.status(400).json({ error: 'vehicle_id erforderlich' });
  try {
    const access = await checkVehicleAccess(vehicle_id, req.user);
    if (!access.allowed) return res.status(access.notFound ? 404 : 403).json({ error: 'Zugriff verweigert' });
    const result = await db.query(
      'INSERT INTO leasing (vehicle_id, data) VALUES ($1,$2) RETURNING *',
      [vehicle_id, JSON.stringify(data || {})]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// PUT /api/leasing/:id
router.put('/:id', requireAuth, async (req, res) => {
  const { data } = req.body;
  try {
    const existing = await db.query(
      'SELECT l.vehicle_id, v.company_id FROM leasing l JOIN vehicles v ON v.id = l.vehicle_id WHERE l.id = $1',
      [req.params.id]
    );
    if (!existing.rows.length) return res.status(404).json({ error: 'Nicht gefunden' });
    if (req.user.role === 'kunde' && existing.rows[0].company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }
    const result = await db.query(
      'UPDATE leasing SET data=$1 WHERE id=$2 RETURNING *',
      [JSON.stringify(data || {}), req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// DELETE /api/leasing/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const existing = await db.query(
      'SELECT l.vehicle_id, v.company_id FROM leasing l JOIN vehicles v ON v.id = l.vehicle_id WHERE l.id = $1',
      [req.params.id]
    );
    if (!existing.rows.length) return res.status(404).json({ error: 'Nicht gefunden' });
    if (req.user.role === 'kunde' && existing.rows[0].company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }
    await db.query('DELETE FROM leasing WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

module.exports = router;
