-- Modo prueba, "Próximamente" y anulaciones manuales (nov 2026).
-- Correr DESPUÉS de multi_evento.sql. Es idempotente: se puede volver a correr.

-- ─── Seguridad: PINs y credenciales de pago solo desde el servidor ─────────
-- Sin RLS, la clave pública (anon) podía leer los PINs y el token de Mercado Pago.
ALTER TABLE IF EXISTS app_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS app_payments ENABLE ROW LEVEL SECURITY;

-- ─── Próximamente (fiesta y tipo de entrada) ──────────────────────────────
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS proximamente BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS venta_abre TIMESTAMPTZ; -- null = fecha a confirmar
ALTER TABLE tipos_entrada ADD COLUMN IF NOT EXISTS proximamente BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tipos_entrada ADD COLUMN IF NOT EXISTS mostrar_precio_previo BOOLEAN NOT NULL DEFAULT false;

-- ─── Modo de pago de cada compra (simulado / sandbox / produccion) ────────
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS modo_pago TEXT;
ALTER TABLE ordenes DROP CONSTRAINT IF EXISTS ordenes_modo_pago_check;
ALTER TABLE ordenes ADD CONSTRAINT ordenes_modo_pago_check
  CHECK (modo_pago IS NULL OR modo_pago IN ('simulado', 'sandbox', 'produccion'));

-- ─── Anulaciones manuales (el comprador avisa por WhatsApp) ───────────────
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS monto_reembolsado NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS reembolsado BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE app_branding ADD COLUMN IF NOT EXISTS politica_anulacion TEXT NOT NULL
  DEFAULT '¿Te arrepentiste? Escribinos por WhatsApp dentro de las 4 horas de la compra y te devolvemos el dinero. Pasado ese plazo no hay devolución.';

-- ─── Actividad: avisos de pago (webhooks) ─────────────────────────────────
ALTER TABLE activity_log DROP CONSTRAINT IF EXISTS activity_log_tipo_check;
ALTER TABLE activity_log ADD CONSTRAINT activity_log_tipo_check
  CHECK (tipo IN ('venta', 'ingreso', 'baja', 'reembolso', 'pago'));
