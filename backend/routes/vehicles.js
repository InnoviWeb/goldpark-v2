const express = require('express');
const db = require('../db');
const { requireAuth, enforceCompanyAccess } = require('../middleware/auth');

const router = express.Router();

// Hilfsfunktion: DB-Row in Frontend-Format umwandeln
function mapVehicle(row) {
  return {
    id: row.id,
    cid: row.company_id,
    make: row.make,
    model: row.model,
    plate: row.plate,
    year: row.year,
    km: row.km,
    vin: row.vin,
    besitzart: row.besitzart,
    fuel: row.fuel,
    verfuegbar: row.verfuegbar,
    nv_grund: row.nv_grund,
    service: {
      date: row.service_date ? row.service_date.toISOString().split('T')[0] : null,
      interval: row.service_interval,
      lastKm: row.service_last_km,
    },
    tuev: {
      date: row.tuev_date ? row.tuev_date.toISOString().split('T')[0] : null,
    },
    tires: {
      date: row.tires_date ? row.tires_date.toISOString().split('T')[0] : null,
      type: row.tires_type,
    },
    tireSizes: {
      fl: row.tire_size_fl,
      fr: row.tire_size_fr,
      rl: row.tire_size_rl,
      rr: row.tire_size_rr,
    },
    detailing: {
      date: row.detailing_date ? row.detailing_date.toISOString().split('T')[0] : null,
    },
    leasing_km_rest: row.leasing_km_rest,
    gruppe: row.gruppe || 'Ohne Zuordnung',
    fahrerId: row.driver_id || null,
    created_at: row.created_at,
  };
}

// GET /api/vehicles?company_id=
router.get('/', requireAuth, enforceCompanyAccess, async (req, res) => {
  try {
    const { company_id } = req.query;
    let result;
    if (company_id) {
      result = await db.query(
        'SELECT * FROM vehicles WHERE company_id = $1 ORDER BY created_at',
        [company_id]
      );
    } else if (req.user.role === 'admin') {
      result = await db.query('SELECT * FROM vehicles ORDER BY created_at');
    } else {
      return res.json([]);
    }
    res.json(result.rows.map(mapVehicle));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// GET /api/vehicles/:id
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM vehicles WHERE id = $1', [req.params.id]);
    if (!result.rows.length) return res.status(404).json({ error: 'Nicht gefunden' });
    const v = result.rows[0];
    if (req.user.role === 'kunde' && v.company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }
    res.json(mapVehicle(v));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST /api/vehicles
router.post('/', requireAuth, async (req, res) => {
  const {
    make, model, plate, year, km, vin, besitzart, fuel,
    verfuegbar, nv_grund,
    service_date, service_interval, service_last_km,
    tuev_date, tires_date, tires_type,
    tire_size_fl, tire_size_fr, tire_size_rl, tire_size_rr,
    detailing_date, leasing_km_rest, driver_id,
  } = req.body;
  const company_id = req.body.company_id || req.query.company_id;

  if (req.user.role === 'kunde' && company_id !== req.user.company_id) {
    return res.status(403).json({ error: 'Zugriff verweigert' });
  }

  try {
    const result = await db.query(
      `INSERT INTO vehicles
        (company_id, make, model, plate, year, km, vin, besitzart, fuel,
         verfuegbar, nv_grund,
         service_date, service_interval, service_last_km,
         tuev_date, tires_date, tires_type,
         tire_size_fl, tire_size_fr, tire_size_rl, tire_size_rr,
         detailing_date, leasing_km_rest, driver_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24)
       RETURNING *`,
      [
        company_id, make, model, plate, year || null, km || 0,
        vin || null, besitzart || null, fuel || null,
        verfuegbar !== false, nv_grund || null,
        service_date || null, service_interval || 15000, service_last_km || 0,
        tuev_date || null, tires_date || null, tires_type || null,
        tire_size_fl || null, tire_size_fr || null, tire_size_rl || null, tire_size_rr || null,
        detailing_date || null, leasing_km_rest || null, driver_id || null,
      ]
    );
    res.status(201).json(mapVehicle(result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// PUT /api/vehicles/:id
router.put('/:id', requireAuth, async (req, res) => {
  const {
    make, model, plate, year, km, vin, besitzart, fuel,
    verfuegbar, nv_grund,
    service_date, service_interval, service_last_km,
    tuev_date, tires_date, tires_type,
    tire_size_fl, tire_size_fr, tire_size_rl, tire_size_rr,
    detailing_date, leasing_km_rest, gruppe, driver_id,
  } = req.body;

  try {
    // Prüfe ob Fahrzeug existiert und Kunden nur ihre eigenen bearbeiten
    const check = await db.query('SELECT company_id FROM vehicles WHERE id = $1', [req.params.id]);
    if (!check.rows.length) return res.status(404).json({ error: 'Nicht gefunden' });
    if (req.user.role === 'kunde' && check.rows[0].company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }

    const result = await db.query(
      `UPDATE vehicles SET
        make=$1, model=$2, plate=$3, year=$4, km=$5, vin=$6, besitzart=$7, fuel=$8,
        verfuegbar=$9, nv_grund=$10,
        service_date=$11, service_interval=$12, service_last_km=$13,
        tuev_date=$14, tires_date=$15, tires_type=$16,
        tire_size_fl=$17, tire_size_fr=$18, tire_size_rl=$19, tire_size_rr=$20,
        detailing_date=$21, leasing_km_rest=$22, gruppe=$23, driver_id=$24
       WHERE id=$25 RETURNING *`,
      [
        make, model, plate, year || null, km || 0,
        vin || null, besitzart || null, fuel || null,
        verfuegbar !== false, nv_grund || null,
        service_date || null, service_interval || 15000, service_last_km || 0,
        tuev_date || null, tires_date || null, tires_type || null,
        tire_size_fl || null, tire_size_fr || null, tire_size_rl || null, tire_size_rr || null,
        detailing_date || null, leasing_km_rest || null, gruppe || 'Ohne Zuordnung', driver_id || null,
        req.params.id,
      ]
    );
    res.json(mapVehicle(result.rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// DELETE /api/vehicles/:id
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const check = await db.query('SELECT company_id FROM vehicles WHERE id = $1', [req.params.id]);
    if (!check.rows.length) return res.status(404).json({ error: 'Nicht gefunden' });
    if (req.user.role === 'kunde' && check.rows[0].company_id !== req.user.company_id) {
      return res.status(403).json({ error: 'Zugriff verweigert' });
    }
    await db.query('DELETE FROM vehicles WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

module.exports = router;
