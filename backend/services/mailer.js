const { Resend } = require('resend');
const resend = new Resend(process.env.RESEND_API_KEY);

const FROM = 'Goldpark Management <noreply@goldpark-fuhrparkmanagement.de>';
const ADMIN_EMAIL = 'info@goldpark-fuhrparkmanagement.de';

async function sendWelcomeMail(kundeEmail, kundenName, firmaName) {
  await resend.emails.send({
    from: FROM,
    to: kundeEmail,
    subject: 'Willkommen bei Goldpark Management',
    html: `<h2>Willkommen, ${kundenName}!</h2>
    <p>Ihr Kundenzugang für das Goldpark Fuhrparkportal wurde eingerichtet.</p>
    <p>Sie können sich unter <a href="https://goldpark-v2.vercel.app">goldpark-v2.vercel.app</a> einloggen.</p>
    <p>Bei Fragen stehen wir Ihnen jederzeit zur Verfügung.</p>
    <br><p>Ihr Goldpark Management Team</p>`
  });
}

async function sendTerminBenachrichtigung(adminEmail, firmaName, datum, status, nachricht) {
  const statusText = status === 'bestaetigt' ? 'bestätigt' : status === 'abgelehnt' ? 'abgelehnt' : 'aktualisiert';
  await resend.emails.send({
    from: FROM,
    to: adminEmail || ADMIN_EMAIL,
    subject: `Termin ${statusText} — ${firmaName}`,
    html: `<h2>Terminänderung von ${firmaName}</h2>
    <p>Status: <strong>${statusText}</strong></p>
    <p>Datum: ${datum}</p>
    ${nachricht ? `<p>Nachricht: ${nachricht}</p>` : ''}
    <p><a href="https://goldpark-v2.vercel.app">Im Portal ansehen</a></p>`
  });
}

async function sendServiceErinnerungen(db) {
  const heute = new Date();
  const in14Tagen = new Date(heute);
  in14Tagen.setDate(heute.getDate() + 14);
  const datumStr = in14Tagen.toISOString().split('T')[0];

  const result = await db.query(`
    SELECT v.id, v.make, v.model, v.plate, v.service_date, v.tuev_date, v.tires_date,
           c.name as firma_name
    FROM vehicles v
    JOIN companies c ON c.id = v.company_id
    WHERE v.service_date <= $1 OR v.tuev_date <= $1 OR v.tires_date <= $1
  `, [datumStr]);

  if (!result.rows.length) return;

  const zeilen = result.rows.map(v => {
    const punkte = [];
    if (v.service_date && v.service_date <= in14Tagen) punkte.push(`Service fällig: ${v.service_date.toISOString().split('T')[0]}`);
    if (v.tuev_date && v.tuev_date <= in14Tagen) punkte.push(`TÜV fällig: ${v.tuev_date.toISOString().split('T')[0]}`);
    if (v.tires_date && v.tires_date <= in14Tagen) punkte.push(`Reifenwechsel fällig: ${v.tires_date.toISOString().split('T')[0]}`);
    return `<tr><td>${v.firma_name}</td><td>${v.make} ${v.model} (${v.plate})</td><td>${punkte.join('<br>')}</td></tr>`;
  }).join('');

  await resend.emails.send({
    from: FROM,
    to: ADMIN_EMAIL,
    subject: `${result.rows.length} Fahrzeug(e) mit fälligen Terminen`,
    html: `<h2>Fällige Termine in den nächsten 14 Tagen</h2>
    <table border="1" cellpadding="8">
    <tr><th>Firma</th><th>Fahrzeug</th><th>Was steht an</th></tr>
    ${zeilen}
    </table>
    <p><a href="https://goldpark-v2.vercel.app">Im Portal ansehen</a></p>`
  });
}

module.exports = { sendWelcomeMail, sendTerminBenachrichtigung, sendServiceErinnerungen };
