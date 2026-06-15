-- Credenciales Talo Pay + Mercado Pago (configurables desde Admin → Pagos)
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
