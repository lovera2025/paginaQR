# Conectar Supabase — paginaqr-eventos

> Si **solo creaste el proyecto** en Supabase, seguí estos 3 pasos en orden.

## Paso 1 — Ejecutar el schema (obligatorio)

El proyecto Supabase está **vacío** hasta que corras el SQL.

1. Abrí [supabase.com/dashboard](https://supabase.com/dashboard) → proyecto **paginaqr-eventos**
2. Menú izquierdo → **SQL Editor** → **New query**
3. Abrí el archivo `supabase/schema.sql` de este repo (o copiá todo su contenido)
4. Pegá en el editor y clic **Run**

Deberías ver: `Success. No rows returned` (o similar).

**Verificar:** Table Editor → deben existir `eventos`, `ordenes`, `tickets`, `activity_log` y una fila en `eventos`.

## Paso 1b — Storage para upload de imágenes (admin)

1. SQL Editor → **New query**
2. Pegá el contenido de `supabase/storage.sql` y **Run**
3. Verificá en **Storage** → bucket `eventos` (público)

Sin este paso, el botón **Subir imagen** en admin fallará.

## Paso 2 — Variables de entorno

1. Supabase → **Project Settings** (engranaje) → **API**
2. Copiá estos valores a `.env.local` en la carpeta del proyecto:

```env
APP_MODE=development
ADMIN_PIN=1234
SCANNER_PIN=1234

SUPABASE_URL=https://TU_PROJECT_REF.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # service_role — SECRETO, solo servidor
NEXT_PUBLIC_SUPABASE_URL=https://TU_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...   # anon public
```

**Importante:** la `service_role` nunca la subas a GitHub ni la pegues en chats públicos.

## Paso 3 — Verificar conexión

```bash
npm run verify:supabase
```

Si todo está bien:

```bash
npm run dev
```

Abrí http://localhost:3000 — la landing debe cargar el evento desde Supabase (no mock).

---

## Qué hace el schema

- Crea tablas: `eventos`, `ordenes`, `tickets`, `activity_log`
- Inserta evento demo **Noche Electrónica 2026**
- Activa RLS (seguridad)
- Activa **Realtime** en las 4 tablas (admin se actualiza solo)

## Probar el flujo

1. `/comprar` → completar formulario → simular pago
2. Supabase **Table Editor** → `ordenes` y `tickets` con datos nuevos
3. Reiniciar `npm run dev` → los datos **siguen** (ya no es mock)
4. `/admin` (PIN 1234) → contadores suben al simular venta

## Vercel (después)

En el proyecto Vercel, agregá las **mismas** variables de Supabase en Settings → Environment Variables.

## Volver a mock

Borrá o comentá `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` en `.env.local`, o poné `APP_MODE=mock`.
