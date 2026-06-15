-- Mercado Pago + toggles de métodos (Admin → Pagos)
ALTER TABLE app_payments
  ADD COLUMN IF NOT EXISTS mp_access_token TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS mp_environment TEXT NOT NULL DEFAULT 'production'
    CHECK (mp_environment IN ('sandbox', 'production')),
  ADD COLUMN IF NOT EXISTS talo_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS mp_enabled BOOLEAN NOT NULL DEFAULT true;

-- Método usado en cada orden (reembolso MP vs Talo)
ALTER TABLE ordenes
  ADD COLUMN IF NOT EXISTS payment_method TEXT
    CHECK (payment_method IS NULL OR payment_method IN ('mp', 'talo'));
