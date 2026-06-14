-- Migración: estados del evento (borrador / venta / finalizado)
-- Ejecutar en Supabase SQL Editor

ALTER TABLE eventos ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'borrador';

ALTER TABLE eventos DROP CONSTRAINT IF EXISTS eventos_estado_check;
ALTER TABLE eventos ADD CONSTRAINT eventos_estado_check
  CHECK (estado IN ('borrador', 'venta', 'finalizado'));
