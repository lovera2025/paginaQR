# Deploy en Vercel

## Antes de lanzar (nov 2026)

1. Variables del proyecto Supabase nuevo `junior-eventos` (abajo) y **`AUTH_SECRET`** (texto largo al azar: firma la sesión del staff).
2. `APP_MODE=production` (aunque falte, en el deploy de producción ya no se simulan pagos).
3. **Borrar `MP_ACCESS_TOKEN`** de las variables de Vercel: el token de Mercado Pago se carga desde Admin → Pagos
   (primero el de prueba, después el real). Si queda el token productivo viejo en Vercel, se usa cuando la tabla de pagos está vacía.
4. Merge de `rediseno-recepciones` a `main` → Vercel despliega solo.
5. En Mercado Pago (tu app → Webhooks): `https://<tu-dominio>/api/webhook-mp`, evento **Pagos**, modo prueba y productivo.

## Variables de entorno (Production + Preview)

Copiá los mismos valores de tu `.env.local` en Vercel → Project → Settings → Environment Variables:

| Variable | Obligatoria |
|----------|-------------|
| `APP_MODE` | `production` en Vercel (en local: `development`) |
| `AUTH_SECRET` | Sí (firma la sesión del staff; si falta se usa la service role) |
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

Migración estados evento (`supabase/migrations/evento_estado.sql`):

```sql
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS estado TEXT NOT NULL DEFAULT 'borrador';
ALTER TABLE eventos DROP CONSTRAINT IF EXISTS eventos_estado_check;
ALTER TABLE eventos ADD CONSTRAINT eventos_estado_check
  CHECK (estado IN ('borrador', 'venta', 'finalizado'));
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
