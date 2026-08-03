const express = require('express');
const db = require('../db');
const { requireAuth, requireAdmin, enforceCompanyAccess } = require('../middleware/auth');

const router = express.Router();

// Statusmapping DB (Deutsch) <-> Frontend (Englisch)
const STATUS_TO_FE = { kontrolliert: 'checked', ausstehend: 'pending', ungueltig: 'invalid' };
const STATUS_TO_DB = { checked: 'kontrolliert', pending: 'ausstehend', invalid: 'ungueltig' };

function dateStr(d) {
  return d ? d.toISOString().split('T')[0] : null;
}

function mapDriver(row) {
  return {
    id: row.id,
    cid: row.company_id,
    name: row.name,
    licenseClass: row.fuehrerschein_klassen,
    licenseNr: row.fuehrerschein_nummer,
    lastCheck: dateStr(row.letzte_kontrolle),
    nextCheck: dateStr(row.naechste_kontrolle),
    status: STATUS_TO_FE[row.status] || row.status,
    notiz: row.notiz,
    created_at: row.created_at,
  };
}

// GET /api/drivers?company_id=
router.get('/', requireAuth, enforceCompanyAccess, async (req, res) => {
  try {
    const { company_id } = req.query;
    let result;
    if (company_id) {
      result = await db.query(
        'SELECT * FROM drivers WHERE company_id = $1 ORDER BY name',
        [company_id]
      );
    } else if (req.user.role === 'admin') {
      result = await db.query('SELECT * FROM drivers ORDER BY name');
    } else {
      return res.json([]);
    }
    res.json(result.rows.map(mapDriver));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST /api/drivers — Admin only
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { company_id, name, licenseClass, licenseNr, lastCheck, nextCheck, status, notiz } = req.body;
  if (!company_id) return res.status(400).json({ error: 'company_id erforderlich' });
  if (!name) return res.status(400).json({ error: 'Name erforderlich' });
  const dbStatus = STATUS_TO_DB[status] || 'ausstehend';
  try {
    const result = await db.query(
      `INSERT INTO drivers
        (company_id, name, fuehrerschein_klassen, fuehrerschein_nummer,
         letzte_kontrolle, naechste_kontrolle, status, notiz)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [company_id, name, licenseClass || null, licenseNr || null,
       lastCheck || null, nextCheck || null, dbStatus, notiz || null]
    );
    res.status(201).json(mapDriver(result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// PUT /api/drivers/:id — Admin only
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  const { name, licenseClass, licenseNr, lastCheck, nextCheck, status, notiz } = req.body;
  if (!name) return res.status(400).json({ error: 'Name erforderlich' });
  const dbStatus = STATUS_TO_DB[status] || 'ausstehend';
  try {
    const check = await db.query('SELECT id FROM drivers WHERE id = $1', [req.params.id]);
    if (!check.rows.length) return res.status(404).json({ error: 'Nicht gefunden' });
    const result = await db.query(
      `UPDATE drivers SET
        name=$1, fuehrerschein_klassen=$2, fuehrerschein_nummer=$3,
        letzte_kontrolle=$4, naechste_kontrolle=$5, status=$6, notiz=$7
       WHERE id=$8 RETURNING *`,
      [name, licenseClass || null, licenseNr || null,
       lastCheck || null, nextCheck || null, dbStatus, notiz || null,
       req.params.id]
    );
    res.json(mapDriver(result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// DELETE /api/drivers/:id — Admin only
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const check = await db.query('SELECT id FROM drivers WHERE id = $1', [req.params.id]);
    if (!check.rows.length) return res.status(404).json({ error: 'Nicht gefunden' });
    await db.query('DELETE FROM drivers WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

module.exports = router;
