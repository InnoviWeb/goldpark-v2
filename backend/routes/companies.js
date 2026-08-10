const express = require('express');
const https = require('https');
const db = require('../db');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();

// Supabase Admin API — User anlegen oder Passwort zurücksetzen
async function supabaseAdminRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const options = {
      hostname: 'xxwvppftmevchodvlsdt.supabase.co',
      path: `/auth/v1/admin/${path}`,
      method,
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_KEY}`,
        ...(data ? { 'Content-Length': Buffer.byteLength(data) } : {})
      }
    };
    const req = https.request(options, (res) => {
      let d = '';
      res.on('data', chunk => d += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, body: JSON.parse(d) }); }
        catch(e) { resolve({ status: res.statusCode, body: d }); }
      });
    });
    req.on('error', reject);
    if (data) req.write(data);
    req.end();
  });
}

async function createSupabaseUser(email, password, companyId) {
  const res = await supabaseAdminRequest('POST', 'users', {
    email: email.toLowerCase().trim(),
    password,
    email_confirm: true,
    user_metadata: { role: 'kunde', company_id: companyId }
  });
  if (res.status === 422 || (res.body?.msg || '').includes('already')) {
    throw Object.assign(new Error('email_taken'), { code: 'EMAIL_TAKEN' });
  }
  if (res.status >= 400) {
    throw new Error(res.body?.msg || 'Supabase Fehler');
  }
  return res.body;
}

async function updateSupabaseUser(supabaseUserId, email, password) {
  const body = { email_confirm: true, user_metadata: {} };
  if (email) body.email = email.toLowerCase().trim();
  if (password) body.password = password;
  const res = await supabaseAdminRequest('PUT', `users/${supabaseUserId}`, body);
  if (res.status >= 400) throw new Error(res.body?.msg || 'Supabase Fehler');
  return res.body;
}

async function findSupabaseUserByEmail(email) {
  const res = await supabaseAdminRequest('GET', `users?email=${encodeURIComponent(email)}`);
  if (res.status >= 400) return null;
  const users = res.body?.users || [];
  return users.find(u => u.email === email.toLowerCase().trim()) || null;
}

// GET /api/companies
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
  const { name, contact, phone, email, login_email, login_password } = req.body;
  if (!name) return res.status(400).json({ error: 'Name erforderlich' });

  const wantsUser = login_email && login_password;
  if (wantsUser && login_password.length < 8) {
    return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen haben' });
  }

  try {
    const companyResult = await db.query(
      'INSERT INTO companies (name, contact, phone, email) VALUES ($1,$2,$3,$4) RETURNING *',
      [name, contact || null, phone || null, email || null]
    );
    const company = companyResult.rows[0];

    if (wantsUser) {
      try {
        await createSupabaseUser(login_email, login_password, company.id);
      } catch(err) {
        // Firma trotzdem zurückgeben, Zugang konnte nicht angelegt werden
        if (err.code === 'EMAIL_TAKEN') {
          return res.status(409).json({ error: 'E-Mail-Adresse wird bereits verwendet', company });
        }
        console.error('Supabase User Fehler:', err.message);
        return res.status(201).json({ ...company, warning: 'Firma angelegt, Zugang fehlgeschlagen: ' + err.message });
      }
    }

    res.status(201).json(company);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Datenbankfehler' });
  }
});

// POST /api/companies/:id/user — Zugang anlegen oder Passwort zurücksetzen
router.post('/:id/user', requireAuth, requireAdmin, async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email und password erforderlich' });
  if (password.length < 8) return res.status(400).json({ error: 'Passwort muss mindestens 8 Zeichen haben' });

  try {
    const companyCheck = await db.query('SELECT id FROM companies WHERE id = $1', [req.params.id]);
    if (!companyCheck.rows.length) return res.status(404).json({ error: 'Firma nicht gefunden' });

    // Prüfen ob User schon existiert
    const existing = await findSupabaseUserByEmail(email);
    if (existing) {
      // Passwort + Metadata aktualisieren
      await updateSupabaseUser(existing.id, email, password);
      // Sicherstellen dass company_id stimmt
      await supabaseAdminRequest('PUT', `users/${existing.id}`, {
        user_metadata: { role: 'kunde', company_id: req.params.id }
      });
      return res.json({ success: true, action: 'updated' });
    }

    await createSupabaseUser(email, password, req.params.id);
    res.status(201).json({ success: true, action: 'created' });
  } catch(err) {
    if (err.code === 'EMAIL_TAKEN') {
      return res.status(409).json({ error: 'E-Mail-Adresse wird bereits verwendet' });
    }
    console.error(err);
    res.status(500).json({ error: err.message || 'Fehler beim Anlegen des Zugangs' });
  }
});

// PUT /api/companies/:id
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

// DELETE /api/companies/:id
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
