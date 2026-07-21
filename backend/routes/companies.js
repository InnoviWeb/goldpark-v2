const express = require('express');
const bcrypt = require('bcrypt');
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
// Optionale Felder login_email + login_password legen gleichzeitig einen Kundenzugang an
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  const { name, contact, phone, email, login_email, login_password } = req.body;
  if (!name) return res.status(400).json({ error: 'Name erforderlich' });

  const wantsUser = login_email && login_password;
  if (wantsUser && login_password.length < 8) {
    return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen haben' });
  }

  if (!wantsUser) {
    // Einfaches Anlegen ohne Kundenzugang
    try {
      const result = await db.query(
        'INSERT INTO companies (name, contact, phone, email) VALUES ($1,$2,$3,$4) RETURNING *',
        [name, contact || null, phone || null, email || null]
      );
      return res.status(201).json(result.rows[0]);
    } catch (err) {
      console.error(err);
      return res.status(500).json({ error: 'Datenbankfehler' });
    }
  }

  // Transaktion: Firma + User gemeinsam anlegen
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');

    const companyResult = await client.query(
      'INSERT INTO companies (name, contact, phone, email) VALUES ($1,$2,$3,$4) RETURNING *',
      [name, contact || null, phone || null, email || null]
    );
    const company = companyResult.rows[0];

    const passwordHash = await bcrypt.hash(login_password, 12);
    const normalizedEmail = login_email.toLowerCase().trim();

    await client.query(
      `INSERT INTO users (email, password_hash, role, company_id)
       VALUES ($1,$2,'kunde',$3)`,
      [normalizedEmail, passwordHash, company.id]
    );

    await client.query('COMMIT');
    res.status(201).json(company);
  } catch (err) {
    await client.query('ROLLBACK');
    if (err.code === '23505') {
      return res.status(409).json({ error: 'E-Mail-Adresse wird bereits verwendet' });
    }
    console.error(err);
    res.status(500).json({ error: 'Datenbankfehler' });
  } finally {
    client.release();
  }
});

// POST /api/companies/:id/user — Admin only
// Legt Kundenzugang an oder setzt Passwort zurück (falls company_id bereits einen User hat)
router.post('/:id/user', requireAuth, requireAdmin, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email und password erforderlich' });
  if (password.length < 8) return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen haben' });

  try {
    const companyCheck = await db.query('SELECT id FROM companies WHERE id = $1', [req.params.id]);
    if (!companyCheck.rows.length) return res.status(404).json({ error: 'Firma nicht gefunden' });

    const normalizedEmail = email.toLowerCase().trim();
    const passwordHash = await bcrypt.hash(password, 12);

    const existing = await db.query(
      'SELECT id FROM users WHERE company_id = $1',
      [req.params.id]
    );

    if (existing.rows.length) {
      // Passwort (und E-Mail) des vorhandenen Users aktualisieren
      await db.query(
        'UPDATE users SET email=$1, password_hash=$2 WHERE company_id=$3',
        [normalizedEmail, passwordHash, req.params.id]
      );
      return res.json({ success: true, action: 'updated' });
    }

    // Neuen User anlegen
    try {
      await db.query(
        `INSERT INTO users (email, password_hash, role, company_id)
         VALUES ($1,$2,'kunde',$3)`,
        [normalizedEmail, passwordHash, req.params.id]
      );
      return res.status(201).json({ success: true, action: 'created' });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'E-Mail-Adresse wird bereits verwendet' });
      }
      throw err;
    }
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
// Löscht zuerst alle Nutzer der Firma, dann die Firma selbst (Transaktion)
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  const client = await db.pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM users WHERE company_id = $1', [req.params.id]);
    await client.query('DELETE FROM companies WHERE id = $1', [req.params.id]);
    await client.query('COMMIT');
    res.json({ success: true });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(err);
    res.status(500).json({ error: 'Datenbankfehler' });
  } finally {
    client.release();
  }
});

module.exports = router;
