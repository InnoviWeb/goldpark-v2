-- Migration: drivers-Tabelle anlegen
-- Für bereits bestehende Datenbanken ausführen: psql $DATABASE_URL -f db/migrate_drivers.sql

CREATE TABLE IF NOT EXISTS drivers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  fuehrerschein_klassen TEXT,
  fuehrerschein_nummer TEXT,
  letzte_kontrolle DATE,
  naechste_kontrolle DATE,
  status TEXT CHECK (status IN ('kontrolliert','ausstehend','ungueltig')),
  notiz TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
