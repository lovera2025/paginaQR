-- Migración: estado pausado para frenar ventas sin cerrar el evento
-- Ejecutar en Supabase SQL Editor

ALTER TABLE eventos DROP CONSTRAINT IF EXISTS eventos_estado_check;
ALTER TABLE eventos ADD CONSTRAINT eventos_estado_check
  CHECK (estado IN ('borrador', 'venta', 'pausado', 'finalizado'));
