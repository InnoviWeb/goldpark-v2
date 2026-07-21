require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const bcrypt = require('bcrypt');
const db = require('../db');

async function seed() {
  console.log('Seed startet...');

  // --- Admin User ---
  const adminHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 12);
  const adminResult = await db.query(
    `INSERT INTO users (email, password_hash, role)
     VALUES ($1, $2, 'admin')
     ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash
     RETURNING id`,
    ['admin@goldpark.de', adminHash]
  );
  ;

  // --- Firmen ---
  const c1 = await db.query(
    `INSERT INTO companies (name, contact, phone, email)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    ['Müller Logistics GmbH', 'Klaus Müller', '069 123456', 'info@mueller-logistics.de']
  );

  const c2 = await db.query(
    `INSERT INTO companies (name, contact, phone, email)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT DO NOTHING
     RETURNING id`,
    ['Becker Transport AG', 'Sandra Becker', '040 654321', 's.becker@becker-transport.de']
  );

  // Falls Firmen bereits existierten, hole ihre IDs
  let company1Id = c1.rows[0]?.id;
  let company2Id = c2.rows[0]?.id;

  if (!company1Id) {
    const r = await db.query("SELECT id FROM companies WHERE name = 'Müller Logistics GmbH'");
    company1Id = r.rows[0]?.id;
  }
  if (!company2Id) {
    const r = await db.query("SELECT id FROM companies WHERE name = 'Becker Transport AG'");
    company2Id = r.rows[0]?.id;
  }

  console.log('Firma 1:', company1Id);
  console.log('Firma 2:', company2Id);

  // --- Kunden User ---
  if (company1Id) {
    const k1Hash = await bcrypt.hash('Klient2024!', 12);
    await db.query(
      `INSERT INTO users (email, password_hash, role, company_id)
       VALUES ($1,$2,'kunde',$3)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, company_id = EXCLUDED.company_id`,
      ['k.mueller@mueller-logistics.de', k1Hash, company1Id]
    );
    console.log('Kunde 1: k.mueller@mueller-logistics.de / Klient2024!');
  }

  if (company2Id) {
    const k2Hash = await bcrypt.hash('Klient2024!', 12);
    await db.query(
      `INSERT INTO users (email, password_hash, role, company_id)
       VALUES ($1,$2,'kunde',$3)
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, company_id = EXCLUDED.company_id`,
      ['s.becker@becker-transport.de', k2Hash, company2Id]
    );
    console.log('Kunde 2: s.becker@becker-transport.de / Klient2024!');
  }

  // --- Fahrzeuge für Firma 1 ---
  if (company1Id) {
    const v1 = await db.query(
      `INSERT INTO vehicles
        (company_id, make, model, plate, year, km,
         service_date, service_interval, service_last_km,
         tuev_date, tires_date, tires_type, detailing_date)
       VALUES ($1,'Mercedes-Benz','Sprinter 316','FFM-ML 100',2021,87400,
               '2026-07-15',15000,80000,
               '2026-08-20','2026-10-01','Sommerreifen','2026-06-20')
       RETURNING id`,
      [company1Id]
    );

    const v2 = await db.query(
      `INSERT INTO vehicles
        (company_id, make, model, plate, year, km,
         service_date, service_interval, service_last_km,
         tuev_date, tires_date, tires_type, detailing_date)
       VALUES ($1,'Ford','Transit Custom','FFM-ML 205',2022,54200,
               '2026-09-10',20000,50000,
               '2027-03-15','2026-11-15','Sommerreifen','2026-07-01')
       RETURNING id`,
      [company1Id]
    );

    const v3 = await db.query(
      `INSERT INTO vehicles
        (company_id, make, model, plate, year, km,
         service_date, service_interval, service_last_km,
         tuev_date, tires_date, tires_type, detailing_date)
       VALUES ($1,'Volkswagen','Crafter 35','FFM-ML 312',2020,123600,
               '2026-06-12',15000,116000,
               '2026-06-25','2026-06-11','Sommerreifen','2026-08-10')
       RETURNING id`,
      [company1Id]
    );

    // Schäden für v1
    if (v1.rows[0]) {
      await db.query(
        `INSERT INTO damages (vehicle_id, title, description, date, cost, status, type, markers)
         VALUES ($1,'Delle rechte Seite','Parkunfall, ca. 8cm','2026-05-10','650','open','delle','[{"x":72,"y":52}]')`,
        [v1.rows[0].id]
      );
      await db.query(
        `INSERT INTO damages (vehicle_id, title, description, date, cost, status, type, markers)
         VALUES ($1,'Kratzer Stoßstange vorne','Kleiner Lackkratzer','2026-03-22','320','closed','kratzer','[{"x":18,"y":48}]')`,
        [v1.rows[0].id]
      );
    }

    // Schaden für v3
    if (v3.rows[0]) {
      await db.query(
        `INSERT INTO damages (vehicle_id, title, description, date, cost, status, type, markers)
         VALUES ($1,'Windschutzscheibe gesprungen','Steinschlag A66','2026-06-01','280','in-progress','riss','[{"x":30,"y":30}]')`,
        [v3.rows[0].id]
      );
    }

    console.log('Fahrzeuge Firma 1 angelegt');
  }

  // --- Fahrzeuge für Firma 2 ---
  if (company2Id) {
    const v4 = await db.query(
      `INSERT INTO vehicles
        (company_id, make, model, plate, year, km,
         service_date, service_interval, service_last_km,
         tuev_date, tires_date, tires_type, detailing_date)
       VALUES ($1,'Iveco','Daily 35S','HH-BT 440',2023,31000,
               '2026-12-01',20000,25000,
               '2027-08-10','2026-11-01','Sommerreifen','2026-09-15')
       RETURNING id`,
      [company2Id]
    );

    const v5 = await db.query(
      `INSERT INTO vehicles
        (company_id, make, model, plate, year, km,
         service_date, service_interval, service_last_km,
         tuev_date, tires_date, tires_type, detailing_date)
       VALUES ($1,'Mercedes-Benz','Vito 116','HH-BT 501',2021,67800,
               '2026-07-20',15000,60000,
               '2026-07-05','2026-10-20','Sommerreifen','2026-06-25')
       RETURNING id`,
      [company2Id]
    );

    // Schaden für v5
    if (v5.rows[0]) {
      await db.query(
        `INSERT INTO damages (vehicle_id, title, description, date, cost, status, type, markers)
         VALUES ($1,'Rückspiegel beschädigt','Spiegel links abgebrochen','2026-05-28','180','in-progress','bruch','[{"x":22,"y":45}]')`,
        [v5.rows[0].id]
      );
    }

    console.log('Fahrzeuge Firma 2 angelegt');
  }

  console.log('\nSeed abgeschlossen!');
  console.log('---');
  console.log('Admin:   admin@goldpark.de        / Goldpark2024!');
  console.log('Kunde 1: k.mueller@mueller-logistics.de / Klient2024!');
  console.log('Kunde 2: s.becker@becker-transport.de  / Klient2024!');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed-Fehler:', err);
  process.exit(1);
});
