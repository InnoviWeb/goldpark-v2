const express = require('express');
const db = require('../db');
const { requireAuth, enforceCompanyAccess } = require('../middleware/auth');

const router = express.Router();

// GET /api/calendar?company_id=
router.get('/', requireAuth, enforceCompanyAccess, async (req, res) => {
  try {
    const { company_id } = req.query;
    let result;
    if (company_id) {
      result = await db.query(
        'SELECT * FROM calendar_events WHERE company_id = $1 ORDER BY date DESC',
        [company_id]
      );
    } else {
      result = await db.query('SELECT * FROM calendar_events ORDER BY date DESC');
    }
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST /api/calendar
router.post('/', requireAuth, enforceCompanyAccess, async (req, res) => {
  const { company_id, vehicle_id, plate, date, uhrzeit, ziel, grund, kunden_status, kunden_nachricht, alternativ_termin } = req.body;
  if (!company_id) return res.status(400).json({ error: 'company_id erforderlich' });
  try {
    const result = await db.query(
      `INSERT INTO calendar_events
        (company_id, vehicle_id, plate, date, uhrzeit, ziel, grund, kunden_status, kunden_nachricht, alternativ_termin)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      [company_id, vehicle_id || null, plate || null, date || null, uhrzeit || null, ziel || null, grund || null,
       kunden_status || null, kunden_nachricht || null, alternativ_termin || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// PUT /api/calendar/:id
router.put('/:id', requireAuth, async (req, res) => {
  const { plate, date, uhrzeit, ziel, grund, kunden_status, kunden_nachricht, alternativ_termin } = req.body;
  try {
    const existing = await db.query('SELECT company_id FROM calendar_events WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Nicht gefunden' });
    if (req.user.role === 'kunde' && existing.rows[0].company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }
    const result = await db.query(
      `UPDATE calendar_events SET
        plate=$1, date=$2, uhrzeit=$3, ziel=$4, grund=$5,
        kunden_status=$6, kunden_nachricht=$7, alternativ_termin=$8
       WHERE id=$9 RETURNING *`,
      [plate || null, date || null, uhrzeit || null, ziel || null, grund || null,
       kunden_status || null, kunden_nachricht || null, alternativ_termin || null,
       req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// DELETE /api/calendar/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const existing = await db.query('SELECT company_id FROM calendar_events WHERE id = $1', [req.params.id]);
    if (!existing.rows.length) return res.status(404).json({ error: 'Nicht gefunden' });
    if (req.user.role === 'kunde' && existing.rows[0].company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }
    await db.query('DELETE FROM calendar_events WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

module.exports = router;
