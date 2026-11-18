-- DNI y fecha de nacimiento del comprador, y seguimiento de las transferencias de Talo (18 nov 2026).
-- Correr DESPUÉS de 2026_11_mensaje_proximamente.sql. Es idempotente.

-- ─── Recuperar mis entradas ───────────────────────────────────────────────
-- Desde ahora la compra pide DNI y fecha de nacimiento: con los dos juntos el comprador
-- vuelve a ver sus entradas desde la web (sin mail ni WhatsApp).
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS comprador_dni TEXT;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS comprador_nacimiento DATE;
CREATE INDEX IF NOT EXISTS idx_ordenes_dni ON ordenes(comprador_dni) WHERE comprador_dni IS NOT NULL;

-- ─── Transferencias de Talo ───────────────────────────────────────────────
-- Todos los pagos de Talo que se generaron para una compra (si se generó otro, el anterior no se
-- pierde: si alguien transfirió a ese alias, igual se encuentra).
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS pagos_talo TEXT[] NOT NULL DEFAULT '{}';
-- Plata que llegó cuando la transferencia fue de menos (Talo: UNDERPAID). NULL = no aplica.
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS monto_recibido NUMERIC;

UPDATE ordenes
SET pagos_talo = ARRAY[mp_payment_id]
WHERE payment_method = 'talo' AND mp_payment_id IS NOT NULL AND pagos_talo = '{}';

-- ─── Pago doble ───────────────────────────────────────────────────────────
-- 'pago_doble' = la compra ya estaba paga y llegó otro pago: hay que devolver uno.
ALTER TABLE ordenes DROP CONSTRAINT IF EXISTS ordenes_problema_check;
ALTER TABLE ordenes ADD CONSTRAINT ordenes_problema_check
  CHECK (problema IS NULL OR problema IN ('pago_sin_cupo', 'pago_doble'));

-- ─── Guardar un pago de Talo sin pisar los anteriores ─────────────────────
-- Agrega el id a pagos_talo de forma atómica (aunque la compra ya no esté pendiente, para no perderlo)
-- y lo deja como pago actual solo si la compra sigue pendiente. Devuelve el estado de la compra.
CREATE OR REPLACE FUNCTION agregar_pago_talo(p_orden UUID, p_pago TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_estado TEXT;
BEGIN
  UPDATE ordenes
  SET pagos_talo = CASE WHEN p_pago = ANY(pagos_talo) THEN pagos_talo ELSE array_append(pagos_talo, p_pago) END,
      mp_payment_id = CASE WHEN estado = 'pendiente' THEN p_pago ELSE mp_payment_id END,
      payment_method = CASE WHEN estado = 'pendiente' THEN 'talo' ELSE payment_method END
  WHERE id = p_orden
  RETURNING estado INTO v_estado;
  RETURN v_estado;
END;
$$;
REVOKE ALL ON FUNCTION agregar_pago_talo(UUID, TEXT) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION agregar_pago_talo(UUID, TEXT) TO service_role;

-- ─── Tope de "Recuperar mis entradas" por DNI (vale para todas las instancias) ─
CREATE TABLE IF NOT EXISTS recuperar_intentos (
  id BIGSERIAL PRIMARY KEY,
  dni TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_recuperar_intentos_dni ON recuperar_intentos(dni, created_at);
ALTER TABLE recuperar_intentos ENABLE ROW LEVEL SECURITY;

-- ─── Una entrada por número dentro de cada compra ─────────────────────────
-- Si se pierde la respuesta al emitir y se reintenta, no se duplican las entradas.
CREATE UNIQUE INDEX IF NOT EXISTS idx_tickets_orden_numero ON tickets(orden_id, numero_entrada);
