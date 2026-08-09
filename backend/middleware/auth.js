const jwt = require('jsonwebtoken');

function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'];
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Kein Token vorhanden' });
  }
  const token = authHeader.slice(7);

  // Versuche zuerst Supabase JWT Secret
  const supabaseSecret = process.env.SUPABASE_JWT_SECRET;
  if (supabaseSecret) {
    try {
      const payload = jwt.verify(token, supabaseSecret);
      // Supabase Token: role und company_id aus user_metadata
      req.user = {
        id: payload.sub,
        role: payload.user_metadata?.role || payload.raw_user_meta_data?.role || 'kunde',
        company_id: payload.user_metadata?.company_id || payload.raw_user_meta_data?.company_id || null,
      };
      return next();
    } catch (e) {
      // Supabase Token fehlgeschlagen, eigenes versuchen
    }
  }

  // Fallback: eigenes JWT Secret
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = payload; // { id, role, company_id }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token ungültig oder abgelaufen' });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Nur Admins erlaubt' });
  }
  next();
}

// Stellt sicher dass Kunden nur ihre eigene company_id abfragen können
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
