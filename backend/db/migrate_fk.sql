-- Migration: users.company_id Fremdschlüssel auf ON DELETE CASCADE umstellen
-- Für bereits bestehende Datenbanken ausführen: psql $DATABASE_URL -f db/migrate_fk.sql

BEGIN;

-- Alten Constraint entfernen (falls vorhanden)
ALTER TABLE users
  DROP CONSTRAINT IF EXISTS fk_users_company;

-- Spalte neu setzen (NULL-Werte bleiben erhalten)
ALTER TABLE users
  ALTER COLUMN company_id TYPE UUID USING company_id::UUID;

-- Neuen Constraint mit CASCADE anlegen
ALTER TABLE users
  ADD CONSTRAINT fk_users_company
  FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

COMMIT;
