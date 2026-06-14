# Deploy en Vercel — demo

## Variables de entorno (Production + Preview)

Copiá los mismos valores de tu `.env.local` en Vercel → Project → Settings → Environment Variables:

| Variable | Obligatoria |
|----------|-------------|
| `APP_MODE` | `mock` o `development` (sin MP, la simulación funciona igual) |
| `ADMIN_PIN` | Sí |
| `SCANNER_PIN` | Sí |
| `SUPABASE_URL` | Sí |
| `NEXT_PUBLIC_SUPABASE_URL` | Sí |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Sí (Realtime en admin) |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí (secreto) |
| `RESEND_API_KEY` | Sí (mail con QR al comprar) |
| `RESEND_FROM` | `JR Eventos <onboarding@resend.dev>` (prueba) |
| `NEXT_PUBLIC_APP_URL` | `https://jreventos-entradas.vercel.app` |

**No** subas `.env.local` a GitHub.

### Supabase — migración email (una vez)

En Supabase → SQL Editor, ejecutá `supabase/migrations/email_sent_at.sql`:

```sql
ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;
```

Después de agregar variables → **Redeploy**.

## Probar la demo

| Ruta | PIN |
|------|-----|
| `/` | — |
| `/comprar` | — |
| `/admin` | `1234` |
| `/scanner` | `1234` |

Flujo: comprar → simular pago → **mail con QR** → `/compra/exito` → scanner (verde) → admin (contadores).

Mercado Pago: pendiente — hoy la venta pública usa **pago simulado** (`APP_MODE=development`, sin `MP_ACCESS_TOKEN`).
