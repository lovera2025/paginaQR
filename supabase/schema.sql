-- PaginaQR — Schema Supabase (Fase B)
-- Ejecutar en SQL Editor del proyecto Supabase nuevo

-- ─── Tablas ───────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS eventos (
  id TEXT PRIMARY KEY,
  nombre TEXT NOT NULL,
  fecha TIMESTAMPTZ NOT NULL,
  precio NUMERIC(10,2) NOT NULL,
  capacidad INT NOT NULL,
  activo BOOLEAN DEFAULT true,
  estado TEXT NOT NULL DEFAULT 'borrador'
    CHECK (estado IN ('borrador', 'venta', 'finalizado')),
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
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ordenes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evento_id TEXT NOT NULL REFERENCES eventos(id),
  mp_payment_id TEXT UNIQUE,
  comprador_nombre TEXT NOT NULL,
  comprador_email TEXT NOT NULL,
  cantidad INT NOT NULL CHECK (cantidad > 0 AND cantidad <= 10),
  monto_total NUMERIC(10,2) NOT NULL,
  estado TEXT NOT NULL DEFAULT 'pendiente'
    CHECK (estado IN ('pendiente', 'aprobado', 'rechazado', 'reembolsado')),
  email_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  orden_id UUID NOT NULL REFERENCES ordenes(id) ON DELETE CASCADE,
  evento_id TEXT NOT NULL REFERENCES eventos(id),
  comprador_nombre TEXT NOT NULL,
  comprador_email TEXT NOT NULL,
  numero_entrada INT NOT NULL,
  total_entradas INT NOT NULL,
  usado BOOLEAN DEFAULT false,
  cancelado BOOLEAN DEFAULT false,
  usado_at TIMESTAMPTZ,
  cancelado_at TIMESTAMPTZ,
  motivo_cancelacion TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS activity_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL CHECK (tipo IN ('venta', 'ingreso', 'baja', 'reembolso')),
  mensaje TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ─── Índices ──────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_tickets_evento ON tickets(evento_id);
CREATE INDEX IF NOT EXISTS idx_tickets_orden ON tickets(orden_id);
CREATE INDEX IF NOT EXISTS idx_tickets_estado ON tickets(cancelado, usado);
CREATE INDEX IF NOT EXISTS idx_ordenes_estado ON ordenes(estado);
CREATE INDEX IF NOT EXISTS idx_ordenes_evento ON ordenes(evento_id);

-- ─── Seed evento demo ─────────────────────────────────────────────────────

INSERT INTO eventos (
  id, nombre, fecha, precio, capacidad, activo,
  logo_url, flyer_url, color_primario, color_secundario,
  descripcion, lugar, maps_url,
  contacto_whatsapp, contacto_email, contacto_instagram,
  texto_footer, organizador_nombre
) VALUES (
  'evento-demo',
  'Fiesta de Promo — Buzo Chomba Bandera',
  '2026-06-20T23:00:00Z',
  15000,
  300,
  true,
  '/flyer.jpeg',
  '/flyer.jpeg',
  '#FFCC00',
  '#1a1a1a',
  'Fiesta de promo con desfile, presentación y joda. Incluye buzo, chomba y bandera.',
  'A confirmar',
  '',
  '',
  '',
  '',
  'Consultas por WhatsApp o redes. Reembolsos: contactá al organizador.',
  'Promo 2026'
) ON CONFLICT (id) DO NOTHING;

-- ─── RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE eventos ENABLE ROW LEVEL SECURITY;
ALTER TABLE ordenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Público: solo leer evento activo
CREATE POLICY "eventos_public_read" ON eventos
  FOR SELECT USING (activo = true);

-- Todo lo demás: solo service_role (API server-side)
-- No crear políticas de anon/authenticated para ordenes, tickets, activity_log

-- ─── Realtime ─────────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE eventos;
ALTER PUBLICATION supabase_realtime ADD TABLE ordenes;
ALTER PUBLICATION supabase_realtime ADD TABLE tickets;
ALTER PUBLICATION supabase_realtime ADD TABLE activity_log;
