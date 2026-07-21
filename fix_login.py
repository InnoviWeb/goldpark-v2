import re

with open('frontend/index.html', 'r') as f:
    content = f.read()

# Remove duplicate API_BASE tags
content = re.sub(r'(<script>const API_BASE = "https://goldpark-v2-production\.up\.railway\.app";</script>\s*)+', 
                 '<script>const API_BASE = "https://goldpark-v2-production.up.railway.app";</script>\n', content)

# Fix loginAdmin - find and replace the old function
old_login = '''function loginAdmin() {
  const email = document.getElementById('a-email').value.trim();
  const pass  = document.getElementById('a-pass').value;
  console.log('[Admin Login] Eingabe   Email:', JSON.stringify(email), '  Pass:', JSON.stringify(pass));
  console.log('[Admin Login] Erwartet  Email:', JSON.stringify(ADMIN_EMAIL), '  Pass:', JSON.stringify(ADMIN_PASS));
  const ok = email === ADMIN_EMAIL && pass === ADMIN_PASS;
  console.log('[Admin Login] Ergebnis:', ok ? 'OK' : 'FEHLGESCHLAGEN');
  if (!ok) {
    document.getElementById('a-error').textContent = 'E-Mail oder Passwort falsch.';
    return;
  }
  document.getElementById('a-error').textContent = '';
  localStorage.setItem('gp_role', 'admin');
  localStorage.removeItem('gp_cid');
  startSession('admin', null);
}'''

new_login = '''async function loginAdmin() {
  const email = document.getElementById('a-email').value.trim();
  const pass = document.getElementById('a-pass').value;
  try {
    const res = await fetch(API_BASE + '/api/auth/login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:pass})});
    const data = await res.json();
    if (!res.ok) { document.getElementById('a-error').textContent = 'E-Mail oder Passwort falsch.'; return; }
    document.getElementById('a-error').textContent = '';
    localStorage.setItem('gp_token', data.token);
    localStorage.setItem('gp_role', data.user.role);
    startSession('admin', null);
  } catch(e) { document.getElementById('a-error').textContent = 'Verbindungsfehler.'; }
}'''

if old_login in content:
    content = content.replace(old_login, new_login)
    print('loginAdmin replaced')
else:
    print('WARNING: loginAdmin pattern not found')

# Fix loginKunde
old_kunde = '''function loginKunde() {
  const email = document.getElementById('k-email').value.trim();
  const company = state.companies.find(c => c.email && c.email.toLowerCase() === email.toLowerCase());
  const cid = company ? company.id : state.companies[0].id;
  localStorage.setItem('gp_role', 'kunde');
  localStorage.setItem('gp_cid', cid);
  startSession('kunde', cid);
}'''

new_kunde = '''async function loginKunde() {
  const email = document.getElementById('k-email').value.trim();
  const pass = document.getElementById('k-pass').value;
  try {
    const res = await fetch(API_BASE + '/api/auth/login', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,password:pass})});
    const data = await res.json();
    if (!res.ok) { document.getElementById('k-error').textContent = 'E-Mail oder Passwort falsch.'; return; }
    document.getElementById('k-error').textContent = '';
    localStorage.setItem('gp_token', data.token);
    localStorage.setItem('gp_role', data.user.role);
    localStorage.setItem('gp_cid', data.user.company_id);
    startSession('kunde', data.user.company_id);
  } catch(e) { document.getElementById('k-error').textContent = 'Verbindungsfehler.'; }
}'''

if old_kunde in content:
    content = content.replace(old_kunde, new_kunde)
    print('loginKunde replaced')
else:
    print('WARNING: loginKunde pattern not found')

with open('frontend/index.html', 'w') as f:
    f.write(content)

print('done')
