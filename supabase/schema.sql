-- PaginaQR — Schema Supabase (multi-fiesta + tipos de entrada)
-- Ejecutar en SQL Editor del proyecto Supabase nuevo

-- ─── Tablas ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS eventos (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE,
  nombre TEXT NOT NULL,
  subtitulo TEXT NOT NULL DEFAULT '',
  dj TEXT NOT NULL DEFAULT '',
  fecha TIMESTAMPTZ NOT NULL,
  precio NUMERIC(10,2) NOT NULL,
  capacidad INT NOT NULL,
  activo BOOLEAN DEFAULT true,
  estado TEXT NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador', 'venta', 'pausado', 'finalizado')),
  logo_url TEXT DEFAULT '',
  flyer_url TEXT DEFAULT '',
  color_primario TEXT DEFAULT '#ff006e',
  color_secundario TEXT DEFAULT '#8338ec',
  descripcion TEXT DEFAULT '',
  lugar TEXT DEFAULT '',
  maps_url TEXT DEFAULT '',
  contacto_whatsapp TEXT DEFAULT '',
  contacto_email TEXT DEFAULT '',
  contacto_instagram TEXT DEFAULT '',
  texto_footer TEXT DEFAULT '',
  organizador_nombre TEXT DEFAULT '',
  mensaje_postergado TEXT DEFAULT '',
  mensaje_proximamente TEXT DEFAULT '',
  proximamente BOOLEAN NOT NULL DEFAULT false,
  venta_abre TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

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
  proximamente BOOLEAN NOT NULL DEFAULT false,
  mostrar_precio_previo BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ordenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id TEXT NOT NULL REFERENCES eventos(id),
  tipo_entrada_id UUID REFERENCES tipos_entrada(id) ON DELETE SET NULL,
  tipo_nombre TEXT NOT NULL DEFAULT 'General',
  precio_unitario NUMERIC(10,2),
  mp_payment_id TEXT UNIQUE,
  payment_method TEXT CHECK (payment_method IS NULL OR payment_method IN ('mp', 'talo')),
  comprador_nombre TEXT NOT NULL,
  comprador_email TEXT NOT NULL,
  cantidad INT NOT NULL CHECK (cantidad > 0 AND cantidad <= 10),
  monto_total NUMERIC(10,2) NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'aprobado', 'rechazado', 'reembolsado')),
  email_sent_at TIMESTAMPTZ,
  modo_pago TEXT CHECK (modo_pago IS NULL OR modo_pago IN ('simulado', 'sandbox', 'produccion')),
  monto_reembolsado NUMERIC(10,2) NOT NULL DEFAULT 0,
  problema TEXT CHECK (problema IS NULL OR problema IN ('pago_sin_cupo')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id UUID NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
  evento_id TEXT NOT NULL REFERENCES eventos(id),
  tipo_entrada_id UUID REFERENCES tipos_entrada(id) ON DELETE SET NULL,
  tipo_nombre TEXT NOT NULL DEFAULT 'General',
  estilo TEXT NOT NULL DEFAULT 'general',
  comprador_nombre TEXT NOT NULL,
  comprador_email TEXT NOT NULL,
  numero_entrada INT NOT NULL,
  total_entradas INT NOT NULL,
  usado BOOLEAN DEFAULT false,
  cancelado BOOLEAN DEFAULT false,
  usado_at TIMESTAMPTZ,
  cancelado_at TIMESTAMPTZ,
  motivo_cancelacion TEXT,
  reembolsado BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('venta', 'ingreso', 'baja', 'reembolso', 'pago')),
  mensaje TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_pins (
  id TEXT PRIMARY KEY DEFAULT 'default',
  admin_pin TEXT NOT NULL,
  scanner_pin TEXT NOT NULL,
  pin_revision INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS app_payments (
  id TEXT PRIMARY KEY DEFAULT 'default',
  talo_user_id TEXT NOT NULL DEFAULT '',
  talo_client_id TEXT NOT NULL DEFAULT '',
  talo_client_secret TEXT NOT NULL DEFAULT '',
  environment TEXT NOT NULL DEFAULT 'production'
    CHECK (environment IN ('sandbox', 'production')),
  mp_access_token TEXT NOT NULL DEFAULT '',
  mp_environment TEXT NOT NULL DEFAULT 'production'
    CHECK (mp_environment IN ('sandbox', 'production')),
  talo_enabled BOOLEAN NOT NULL DEFAULT true,
  mp_enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ DEFAULT now()
);

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
  politica_anulacion TEXT NOT NULL DEFAULT '¿Te arrepentiste? Escribinos por WhatsApp dentro de las 4 horas de la compra y te devolvemos el dinero. Pasado ese plazo no hay devolución.',
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Índices ──────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_tipos_evento ON tipos_entrada(evento_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_tipo ON ordenes(tipo_entrada_id);
CREATE INDEX IF NOT EXISTS idx_tickets_tipo ON tickets(tipo_entrada_id);
CREATE INDEX IF NOT EXISTS idx_eventos_estado ON eventos(estado);

CREATE INDEX IF NOT EXISTS idx_tickets_evento ON tickets(evento_id);
CREATE INDEX IF NOT EXISTS idx_tickets_orden ON tickets(orden_id);
CREATE INDEX IF NOT EXISTS idx_tickets_estado ON tickets(cancelado, usado);
CREATE INDEX IF NOT EXISTS idx_ordenes_estado ON ordenes(estado);
CREATE INDEX IF NOT EXISTS idx_ordenes_evento ON ordenes(evento_id);
CREATE INDEX IF NOT EXISTS idx_ordenes_evento_estado_fecha ON ordenes(evento_id, estado, created_at);

-- ─── Datos iniciales ──────────────────────────────────────────────────────
-- Las fiestas se cargan con supabase/seeds/recepciones_2026.sql (o desde el admin).
INSERT INTO app_branding (id) VALUES ('default') ON CONFLICT (id) DO NOTHING;

-- ─── RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE tipos_entrada ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_branding ENABLE ROW LEVEL SECURITY;
-- PINs y credenciales de pago: solo el servidor (service_role). Sin políticas para anon.
ALTER TABLE app_pins ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_payments ENABLE ROW LEVEL SECURITY;

-- Público: solo leer fiestas publicadas
CREATE POLICY "eventos_public_read" ON eventos
  FOR SELECT USING (estado IN ('venta', 'pausado'));

-- Todo lo demás: solo service_role (API server-side)
-- No crear políticas de anon/authenticated para ordenes, tickets, activity_log

-- ─── Realtime ─────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE eventos;
ALTER PUBLICATION supabase_realtime ADD TABLE ordenes;
ALTER PUBLICATION supabase_realtime ADD TABLE tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE activity_log;
ALTER PUBLICATION supabase_realtime ADD TABLE tipos_entrada;
