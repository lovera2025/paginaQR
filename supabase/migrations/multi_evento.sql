-- Multi-fiesta + tipos de entrada (Anticipada / General / VIP) + marca global.
-- Correr UNA vez en Supabase → SQL Editor ANTES de desplegar el código nuevo.
-- Es idempotente: se puede volver a correr sin romper nada.

-- ─── Fiestas ──────────────────────────────────────────────────────────────
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS slug TEXT;
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS subtitulo TEXT NOT NULL DEFAULT '';
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS dj TEXT NOT NULL DEFAULT '';
UPDATE eventos SET slug = id WHERE slug IS NULL OR slug = '';
CREATE UNIQUE INDEX IF NOT EXISTS idx_eventos_slug ON eventos(slug);
CREATE INDEX IF NOT EXISTS idx_eventos_estado ON eventos(estado);

-- ─── Tipos de entrada ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tipos_entrada (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id TEXT NOT NULL REFERENCES eventos(id) ON DELETE CASCADE,
  nombre TEXT NOT NULL,
  descripcion TEXT NOT NULL DEFAULT '',
  beneficios TEXT[] NOT NULL DEFAULT '{}',
  precio NUMERIC(10,2) NOT NULL CHECK (precio > 0),
  cupo INT CHECK (cupo IS NULL OR cupo > 0),
  venta_desde TIMESTAMPTZ,
  venta_hasta TIMESTAMPTZ,
  estilo TEXT NOT NULL DEFAULT 'general'
    CHECK (estilo IN ('anticipada', 'general', 'vip', 'custom')),
  color_acento TEXT NOT NULL DEFAULT '',
  activo BOOLEAN NOT NULL DEFAULT true,
  orden INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tipos_evento ON tipos_entrada(evento_id);
ALTER TABLE tipos_entrada ENABLE ROW LEVEL SECURITY;

-- Snapshot del tipo en cada compra y en cada entrada (si el admin cambia
-- el precio o el nombre después, lo ya vendido no cambia).
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS tipo_entrada_id UUID REFERENCES tipos_entrada(id) ON DELETE SET NULL;
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS tipo_nombre TEXT NOT NULL DEFAULT 'General';
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS precio_unitario NUMERIC(10,2);
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS tipo_entrada_id UUID REFERENCES tipos_entrada(id) ON DELETE SET NULL;
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS tipo_nombre TEXT NOT NULL DEFAULT 'General';
ALTER TABLE tickets ADD COLUMN IF NOT EXISTS estilo TEXT NOT NULL DEFAULT 'general';
CREATE INDEX IF NOT EXISTS idx_ordenes_tipo ON ordenes(tipo_entrada_id);
CREATE INDEX IF NOT EXISTS idx_tickets_tipo ON tickets(tipo_entrada_id);

-- Cada fiesta que ya existía recibe un tipo "General" con su precio actual
-- y sus compras/entradas quedan apuntando a ese tipo.
INSERT INTO tipos_entrada (evento_id, nombre, descripcion, precio, estilo, orden)
SELECT e.id, 'General', 'Acceso a la fiesta toda la noche.', e.precio, 'general', 0
FROM eventos e
WHERE NOT EXISTS (SELECT 1 FROM tipos_entrada t WHERE t.evento_id = e.id);

UPDATE ordenes o
SET tipo_entrada_id = t.id,
    tipo_nombre = t.nombre,
    precio_unitario = COALESCE(o.precio_unitario, o.monto_total / NULLIF(o.cantidad, 0))
FROM tipos_entrada t
WHERE o.tipo_entrada_id IS NULL AND t.evento_id = o.evento_id AND t.nombre = 'General';

UPDATE tickets k
SET tipo_entrada_id = t.id, tipo_nombre = t.nombre, estilo = t.estilo
FROM tipos_entrada t
WHERE k.tipo_entrada_id IS NULL AND t.evento_id = k.evento_id AND t.nombre = 'General';

-- ─── Marca global (nombre, logo, contacto del sitio) ──────────────────────
CREATE TABLE IF NOT EXISTS app_branding (
  id TEXT PRIMARY KEY DEFAULT 'default',
  nombre TEXT NOT NULL DEFAULT 'Junior Eventos',
  logo_url TEXT NOT NULL DEFAULT '',
  tagline TEXT NOT NULL DEFAULT 'Recepciones de egresados · Promo 2026',
  contacto_whatsapp TEXT NOT NULL DEFAULT '',
  contacto_instagram TEXT NOT NULL DEFAULT 'junior_eventos_ok',
  contacto_email TEXT NOT NULL DEFAULT '',
  texto_footer TEXT NOT NULL DEFAULT 'Entradas personales con QR. Cada QR vale una sola vez.',
  color_primario TEXT NOT NULL DEFAULT '#d4a853',
  color_secundario TEXT NOT NULL DEFAULT '#050508',
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE app_branding ENABLE ROW LEVEL SECURITY;
INSERT INTO app_branding (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

-- Realtime para que el admin vea cambios de tipos al instante (opcional).
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE tipos_entrada;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
