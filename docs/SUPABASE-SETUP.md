# Conectar Supabase (Fase B)

## 1. Crear proyecto

1. [supabase.com](https://supabase.com) → New project
2. Nombre: `pagina-qr-entradas` (o similar)
3. Región: South America (São Paulo)

## 2. Ejecutar schema

1. SQL Editor → New query
2. Pegar contenido de `supabase/schema.sql`
3. Run

## 3. Activar Realtime

Database → Replication → habilitar:
- `eventos`
- `ordenes`
- `tickets`
- `activity_log`

## 4. Variables de entorno

En `.env.local`:

```env
APP_MODE=development
SUPABASE_URL=https://TU_PROYECTO.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # Settings → API → service_role (secreto)
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROYECTO.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...   # Settings → API → anon public
```

Reiniciar `npm run dev`.

## 5. Verificar

- Landing carga evento desde Supabase
- Compra → simular pago → tickets en Table Editor
- Admin actualiza al instante (Realtime)

## Nota

Mientras no configures Supabase, el sistema sigue usando **mock en memoria** automáticamente.
