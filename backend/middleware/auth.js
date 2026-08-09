const https = require('https');

async function verifySupabaseToken(token) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'xxwvppftmevchodvlsdt.supabase.co',
      path: '/auth/v1/user',
      method: 'GET',
      headers: {
        'Authorization': 'Bearer ' + token,
        'apikey': process.env.SUPABASE_ANON_KEY
      }
    };
    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          try { resolve(JSON.parse(data)); }
          catch(e) { reject(new Error('Invalid JSON')); }
        } else {
          reject(new Error('Unauthorized'));
        }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

async function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Kein Token vorhanden' });
  }
  const token = authHeader.slice(7);

  try {
    const user = await verifySupabaseToken(token);
    req.user = {
      id: user.id,
      role: user.user_metadata?.role || 'kunde',
      company_id: user.user_metadata?.company_id || null,
    };
    return next();
  } catch(e) {
    // Supabase fehlgeschlagen, eigenes JWT versuchen
  }

  try {
    const jwt = require('jsonwebtoken');
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload;
    return next();
  } catch(err) {
    return res.status(401).json({ error: 'Token ungültig oder abgelaufen' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Nur Admins erlaubt' });
  }
  next();
}

function enforceCompanyAccess(req, res, next) {
  if (req.user.role === 'admin') return next();
  const requestedCid = req.query.company_id || req.body?.company_id || req.params?.company_id;
  if (requestedCid && requestedCid !== req.user.company_id) {
    return res.status(403).json({ error: 'Zugriff verweigert' });
  }
  if (!requestedCid) {
    req.query.company_id = req.user.company_id;
  }
  next();
}

module.exports = { requireAuth, requireAdmin, enforceCompanyAccess };
