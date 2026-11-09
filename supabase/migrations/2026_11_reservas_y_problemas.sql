-- Reservas de 15 minutos y compras con problema de pago (nov 2026).
-- Correr DESPUÉS de 2026_11_modo_prueba_proximamente_anulaciones.sql. Es idempotente.

-- ─── Compra que hay que resolver a mano ───────────────────────────────────
-- 'pago_sin_cupo' = el pago entró pero ya no quedaban entradas: hay que devolver la plata.
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS problema TEXT;
ALTER TABLE ordenes DROP CONSTRAINT IF EXISTS ordenes_problema_check;
ALTER TABLE ordenes ADD CONSTRAINT ordenes_problema_check
  CHECK (problema IS NULL OR problema IN ('pago_sin_cupo'));

-- ─── Índice para las reservas (compras sin pagar recientes de cada fiesta) ─
CREATE INDEX IF NOT EXISTS idx_ordenes_evento_estado_fecha ON ordenes(evento_id, estado, created_at);
