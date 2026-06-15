-- PINs de admin y scanner (texto plano, una sola fila)
-- Ejecutar en Supabase SQL Editor

CREATE TABLE IF NOT EXISTS app_pins (
  id TEXT PRIMARY KEY DEFAULT 'default',
  admin_pin TEXT NOT NULL,
  scanner_pin TEXT NOT NULL,
  pin_revision INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Opcional: cargar PINs iniciales desde env (reemplazá los valores antes de correr)
-- INSERT INTO app_pins (id, admin_pin, scanner_pin, pin_revision)
-- VALUES ('default', '1234', '567890', 1)
-- ON CONFLICT (id) DO NOTHING;
