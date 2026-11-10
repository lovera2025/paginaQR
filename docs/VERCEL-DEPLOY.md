# Publicación en Vercel

> Actualizado el 10 nov 2026 (lanzamiento).

## Dónde está

| Qué | Valor |
|-----|-------|
| Proyecto Vercel | `jreventos-entradas` (equipo `maximiliano-loveras-projects`, plan Hobby) |
| Dirección pública | **https://junioreventos.vercel.app** |
| También responden | `junior-eventos.vercel.app`, `jreventos-entradas.vercel.app` |
| Repositorio | `lovera2025/paginaQR`, rama `main` (cada merge a `main` publica solo) |
| Base de datos | Supabase `junior-eventos` (ref `jllfdxxleszeimsxruva`) |

## Ojo con el plan gratis

El plan Hobby de Vercel es, por sus condiciones, para uso **no comercial**. Se decidió publicar igual
(10 nov 2026) sabiendo el riesgo: si Vercel lo detecta puede pedir pasar a Pro (US$ 20 por mes) o pausar
el proyecto. Si pasa, la salida es subir el plan del mismo proyecto: no cambia la dirección ni los datos.

Alternativa evaluada y descartada: Netlify gratis permite vender pero tiene un tope de 300 créditos por
mes; al gastarlos pausa la web hasta el mes siguiente (o hasta pagar US$ 9 por mes).

## Variables de entorno (solo Production)

| Variable | Para qué |
|----------|----------|
| `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL` | Proyecto `junior-eventos` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave pública (actualización en vivo del panel) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave secreta del servidor |
| `AUTH_SECRET` | Firma la sesión del staff (texto largo al azar) |
| `APP_MODE` | `production` |
| `NEXT_PUBLIC_APP_URL` | `https://junioreventos.vercel.app` (arma la vuelta de Mercado Pago y el aviso de pagos) |
| `ADMIN_PIN`, `SCANNER_PIN` | Solo de respaldo: los PIN reales se guardan en la base desde Panel → Seguridad |

No van en Vercel: la clave de Mercado Pago (se carga en Panel → Pagos) ni las de Resend (sin mail).

Para cambiarlas: Vercel → proyecto → Settings → Environment Variables, y después **Redeploy**.
Si cambia la dirección pública, actualizar `NEXT_PUBLIC_APP_URL`, redesplegar y volver a copiar la
dirección del aviso de pagos en Mercado Pago (Panel → Pagos → paso 3).

## Publicar un cambio

1. Trabajar en una rama, `npm test` y `npm run lint`.
2. Pull request a `main` (Vercel arma una vista previa; ahí corre con datos de ejemplo, sin la base real).
3. Merge → Vercel publica en producción en 1 o 2 minutos.

Vuelta atrás: Vercel → Deployments → el anterior → **Instant Rollback**.

## Migraciones de la base

Están en `supabase/migrations/`. `npm run verify:supabase` avisa si falta alguna. La última es
`2026_11_mensaje_proximamente.sql`.

## Probar en la compu sin pisar otro servidor

`NEXT_DIST_DIR=.next-preview next dev -p 3105` levanta un segundo servidor en la misma carpeta
(configuración `dev-aislado` en `.claude/launch.json`). Next agrega esa carpeta a `tsconfig.json`:
no commitear ese cambio.
