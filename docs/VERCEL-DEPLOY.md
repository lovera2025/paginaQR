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

**No** subas `.env.local` a GitHub.

Después de agregar variables → **Redeploy**.

## Probar la demo

| Ruta | PIN |
|------|-----|
| `/` | — |
| `/comprar` | — |
| `/admin` | `1234` |
| `/scanner` | `1234` |

Flujo: comprar → simular pago → QR → scanner (verde) → admin (contadores).
