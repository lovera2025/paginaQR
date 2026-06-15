-- Credenciales Talo Pay (configurables desde Admin → Pagos)
CREATE TABLE IF NOT EXISTS app_payments (
  id TEXT PRIMARY KEY DEFAULT 'default',
  talo_user_id TEXT NOT NULL DEFAULT '',
  talo_client_id TEXT NOT NULL DEFAULT '',
  talo_client_secret TEXT NOT NULL DEFAULT '',
  environment TEXT NOT NULL DEFAULT 'production'
    CHECK (environment IN ('sandbox', 'production')),
  updated_at TIMESTAMPTZ DEFAULT now()
);
