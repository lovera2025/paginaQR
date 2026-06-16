# PaginaQR / JR Eventos — Contexto del proyecto

> Documento de referencia para continuar el desarrollo en cualquier chat/sesión.
> Última actualización: **15 junio 2026 (noche)** — Botón Reembolsar deshabilitado visualmente (opaco + aviso amarillo en Pagos). Migración SQL `app_payments_mp.sql` pendiente de correr en Supabase. Próximo: PINs fuertes + precio $8.000 + demo jefe.

## Meta inmediata

| Hito | Fecha |
|------|-------|
| **Sistema operativo** (venta real, mail, admin, scanner) | **Lunes 15 jun 2026 — tarde** |
| **Evento en vivo** (Fiesta de Promo / JR Eventos) | **Viernes 20 jun 2026** |

**Operativo** = subir imágenes desde admin, compra con **Mercado Pago real** o **Talo Pay**, webhook → tickets/QR, **email con logo**, scanner una vez por entrada, PIN fuerte en producción (sin `1234`).

---

## Estado al 15 jun 2026 (noche) — Pagos duales implementados

### ✅ Hecho en este bloque
- **Mercado Pago + Talo Pay** ambos configurables desde **Admin → Pagos** (sin Vercel, sin redeploy)
- El comprador **elige** el método al pagar (tarjeta MP o transferencia Talo)
- Si solo uno está activo → va directo; ninguno → modo simulación
- Credenciales guardadas en Supabase (`app_payments` extendido con columnas MP + toggles on/off)
- Reembolso con Talo: marca en DB. Reembolso con MP: llama a API de MP
- Commit: `a1254d7` — desplegado en Vercel

### ⚠️ Migración SQL pendiente (correr en Supabase)
Archivo: `supabase/migrations/app_payments_mp.sql`
```sql
ALTER TABLE app_payments
  ADD COLUMN IF NOT EXISTS mp_access_token TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS mp_environment TEXT NOT NULL DEFAULT 'production'
    CHECK (mp_environment IN ('sandbox', 'production')),
  ADD COLUMN IF NOT EXISTS talo_enabled BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS mp_enabled BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE ordenes
  ADD COLUMN IF NOT EXISTS payment_method TEXT
    CHECK (payment_method IS NULL OR payment_method IN ('mp', 'talo'));
```

### ✅ Reembolsar deshabilitado visualmente
**Por qué:** MP retiene fondos de tarjeta hasta días después (ej. 2 jul para pago del 15 jun). No se puede reembolsar hasta que MP libere los fondos.

**Implementado:**
- Botón **Reembolsar** en Admin → Compras: **deshabilitado** (opaco, no clickeable) + texto *"Deshabilitado temporalmente"* debajo
- Aviso amarillo en Admin → Pagos: *"Los reembolsos están temporalmente deshabilitados"*
- Solo cambios en `AdminDashboard.tsx` (backend de refund intacto y listo)
- Para reactivar: revertir las dos partes en `AdminDashboard.tsx` (2 min cuando jefe lo pida)

---

Entre el 16 y el 19: solo pruebas y ajustes menores — **no features grandes**.

---

## Estado actual

| Item | Estado |
|------|--------|
| Planificación completa | ✅ Hecho |
| Repo Git `paginaQR` | ✅ GitHub (lovera2025/paginaQR) |
| **Fase A — Mock local** | ✅ Completa |
| **Fase B — Supabase** | ✅ Conectada (proyecto `paginaqr-eventos`) |
| **Vercel — demo online** | ✅ Deploy + env vars |
| URL producción | ✅ https://jreventos-entradas.vercel.app |
| Evento demo configurado | ✅ Fiesta de Promo + flyer + Junior Eventos |
| QR + scanner (1 uso por entrada) | ✅ Funciona |
| Reembolso en DB + invalidación scanner | ✅ Funciona |
| Upload logo/flyer en admin | ✅ Bloque 1 (vie 12) |
| Botones Admin / Scanner en UI | ✅ Bloque 1 (vie 12) |
| Branding "JR Eventos" (título pestaña) | ✅ Bloque 1 (vie 12) |
| Feedback reembolso / baja en admin | ✅ Bloque 1 (vie 12) |
| Google Maps en admin | ✅ Bloque 1 (vie 12) |
| Formato fecha landing (`· 20:00 hs`) | ✅ vie 12 — commit `14c9a5a` |
| Resend (emails con QR) | ✅ Producción — inline CID (Gmail OK) · QR solo en mail |
| `/compra/exito` sin QR en pantalla | ✅ Mensaje “QR enviado al mail” |
| `email_sent_at` (idempotencia mail) | ✅ Migración SQL |
| Reiniciar ventas (admin) | ✅ Solo `borrador` · confirmación `REINICIAR` |
| Estados evento (borrador/venta/finalizado) | ✅ Abrir venta · Cerrar evento |
| Historial eventos pasados | ✅ **Hecho — 14 jun** |
| Crear nuevo evento (desde admin) | ✅ **Hecho — 14 jun** |
| Botón Staff en landing | ✅ Nav hero → `/admin` |
| PINs en Supabase (`app_pins`) | ✅ Cambiar desde Admin → Seguridad |
| Invalidar sesión al cambiar PIN | ✅ Mensaje + re-login con PIN nuevo |
| Mercado Pago (Checkout Pro) | ✅ **Productivo probado — 15 jun madrugada** |
| Webhook `/api/webhook-mp` + sync `/api/mp/sync` | ✅ Configurado (prueba + productivo en panel MP) |
| Reembolso vía API MP | ✅ Implementado (`lib/mercadopago/refund.ts`) · probar antes del evento |
| Precio venta definitivo | ⚠️ **$8.000** en admin (prueba fue $1.000) |
| PIN fuerte en producción | ⚠️ Cambiar desde Seguridad (no dejar `1234`) |
| `APP_MODE=production` en Vercel | ⚠️ Recomendado antes de abrir venta |
| Dominio propio | ❌ Opcional (ej. entradas.jreventos.com) |

**Momento exacto:** Compra **real con MP productivo** OK (redirect → webhook/sync → mail QR → scanner). Evento sigue en **`borrador`**. Sandbox MP falló (mezcla test/real); producción OK tras **redeploy** con `MP_ACCESS_TOKEN` productivo.

**Lecciones MP (15 jun):**
- Sin **redeploy** en Vercel, el token viejo sigue activo → error *“una de las partes es de prueba”*.
- Comisión MP ~**4,1%** (ej. $1.000 → neto ~$959 en cuenta del hijo).
- Acreditación tarjeta puede demorar (ej. disponible **2 jul**) — avisar al jefe.
- Solo hace falta **`MP_ACCESS_TOKEN`** (Checkout Pro); Public Key no se usa.

**Commits recientes:** `a965f26` (redeploy MP prod) · `1de2524` (Checkout Pro + webhook) · `5050c7f` (PINs) · `e6ef189` (historial)

---

## Mercado Pago — cuenta y decisión

- **Integración elegida:** Checkout Pro (redirect + webhook). No link de pago suelto, no Checkout API.
- **Cuenta:** Mercado Pago del **hijo** del jefe (amigo de confianza del dev).
- **La plata del evento cae en esa cuenta MP** (reembolsos también salen de ahí).
- **App:** "JR Eventos Entradas" · Checkout Pro · credenciales **productivas activas** (15 jun).
- **Vercel:** `MP_ACCESS_TOKEN` = Access Token **productivo** · redeploy obligatorio al cambiar.
- **Webhook:** `https://jreventos-entradas.vercel.app/api/webhook-mp` · evento **Pagos** · modos prueba + productivo en panel MP.
- **Implementación:** `lib/mercadopago/` · `app/api/webhook-mp` · `app/api/mp/sync` · `app/api/mp/preference` · commit `1de2524`.

---

## Auth — sin cuentas de usuario

- Admin y scanner: **dos PINs distintos** (admin = panel completo; scanner = solo puerta).
- **Fuente principal:** tabla Supabase `app_pins` (texto plano, una fila `default`).
- **Fallback:** si la tabla está vacía, usa `ADMIN_PIN` / `SCANNER_PIN` de Vercel (solo arranque).
- **Cambiar PINs:** Admin → **Seguridad** → **Cambiar PINs** (no hace falta entrar a Vercel).
- Al cambiar: sube `pin_revision` → sesiones viejas invalidadas → mensaje *“El PIN fue actualizado…”*.
- Cookie de sesión: `rol:revision` · duración 12 h.
- No hay registro/login con email (postergar Supabase Auth).
- Admin logueado puede abrir `/scanner` sin re-PIN.
- **Antes del evento:** cambiar PINs de prueba (`1234`) desde Seguridad.

---

## URLs

| Qué | URL |
|-----|-----|
| Landing | https://jreventos-entradas.vercel.app |
| Comprar | /comprar |
| Admin | /admin (PIN admin) |
| Scanner | /scanner (PIN scanner) |
| Staff (landing) | Botón **Staff** en nav del hero → `/admin` |

**Nota UX:** **Staff** en nav del hero. Link Admin también en footer. **Scanner** en header del panel admin.

Local: `npm run dev` → http://localhost:3000

Guías: `docs/SUPABASE-SETUP.md`, `docs/VERCEL-DEPLOY.md`

---

## Qué es el sistema

Sistema de venta de entradas para eventos (Argentina). Marca: **Junior Eventos / JR Eventos**.

- Web pública: landing → compra sin cuenta → pago (MP) → QR único **por entrada**
- Scanner (`/scanner`): PWA, valida ingreso (PIN); cada QR vale **una sola vez**
- Admin (`/admin`): contadores en vivo, listas, branding, upload imágenes, bajas/reembolsos (PIN)

**Stack:** Next.js 14, Supabase (+ Storage), Vercel, Mercado Pago Checkout Pro, Resend

---

## Modelo de datos

### `ordenes` — estado: pendiente | aprobado | rechazado | reembolsado
### `tickets` — solo existen si orden aprobada. Campos: usado, cancelado
**NO hay `pagado` en tickets.** Varias entradas en una compra = **un ticket/QR por entrada** (no uno solo para toda la orden).

**Hecho Fase C (parcial):** `email_sent_at` en orden · mail Resend con adjuntos inline (`contentId` camelCase + QR base64).

**Pendiente Fase C:** snapshot de branding al comprar (para mails históricos si admin edita evento).

---

## Plan lógico anti-bugs (decisiones acordadas)

Objetivo: construir en capas, probar cada pieza sin ensuciar datos reales, y no mezclar “prueba” con “evento archivado”.

### Orden de implementación (actualizado 13 jun noche)

| # | Bloque | Estado |
|---|--------|--------|
| 1 | **Resend** | ✅ Mail + QR por entrada (pago simulado) |
| 2 | **Reiniciar ventas** | ✅ Solo borrador |
| 3 | **Estados evento** | ✅ borrador → venta → finalizado |
| 4 | **Historial** | ✅ Pestaña + crear evento |
| 5 | **PINs Supabase** | ✅ Cambiar desde admin · invalidar sesión |
| 6 | **Mercado Pago** | ✅ Checkout Pro + webhook + compra real probada |
| 7 | **Ops prod** | ⚠️ **Hoy lun 15 tarde** — PINs, precio $8k, demo jefe, abrir venta |

**Decisión acordada (13 jun):** Historial **antes** que MP — MP es más sensible; conviene tener archivado/listas listas antes de plata real.

### Ciclo de prueba (borrador — con MP productivo)

```
Reiniciar ventas → /comprar → MP (tarjeta real) → mail QR → scanner
→ reembolso opcional → Reiniciar otra vez
```

(Simulación verde/rojo solo si no hay `MP_ACCESS_TOKEN` en Vercel.)

### Capacidad y contadores (cómo funciona hoy)

- **Capacidad** = máximo entradas a vender (Admin → Apariencia). 1 ticket = 1 persona = 1 QR.
- **Contadores** no se cargan a mano: se calculan de `tickets` + `ordenes`.
- **Disponibles** = `capacidad − tickets activos (no cancelados)`.
- Al comprar, el servidor bloquea si no hay cupo (`lib/supabase/queries.ts`).
- Stats/contadores filtrados por `evento_id` del evento activo ✅

### Idempotencia (evitar bugs)

| Acción | Regla |
|--------|--------|
| Mail | Solo enviar si `email_sent_at` es null en la orden |
| Webhook MP | No duplicar tickets si mismo `mp_payment_id` · sync en `/compra/exito` como respaldo |
| Reiniciar | Botón disabled mientras corre; confirmación `REINICIAR` |
| Cambiar PIN | Pedir PIN admin actual; subir `pin_revision`; invalidar cookies |

---

## Estados del evento e historial

### Estados (`eventos.estado`)

| Estado | Venta | Reiniciar ventas | Uso |
|--------|-------|------------------|-----|
| `borrador` | No (o solo prueba interna) | ✅ Sí | Config + pruebas Resend/scanner |
| `venta` | ✅ Pública | ❌ No | Evento del 20 con MP |
| `finalizado` | ❌ | ❌ | **Historial** — no borrar datos |

Solo **un** evento con `activo = true` en borrador/venta a la vez.

### Dos botones distintos (no confundir)

| Botón | Cuándo | Efecto |
|-------|--------|--------|
| **Reiniciar ventas** | Solo `borrador` / pruebas | DELETE órdenes + tickets (CASCADE) + activity del evento actual |
| **Cerrar evento** | Post-fiesta real | `estado = finalizado`, `activo = false`; **datos intactos** |

**Nunca** usar Reiniciar después de ventas reales — se pierde historial y trazabilidad de plata.

### Historial — qué mostrar por evento pasado

**Resumen:** vendidas, capacidad, recaudado, reembolsado, ingresaron, sin usar, canceladas.

**Detalle (solo lectura):**
- Lista **compradores** (órdenes: nombre, email, cantidad, monto, estado, fecha)
- Detalle **entradas** por orden (nº entrada, usado/cancelado, hora ingreso)

Admin → pestaña **Historial** → elegir evento → ver stats + tablas.

### Cerrar evento → nuevo evento

1. Botón **Cerrar evento y archivar** → `finalizado`
2. Rechazar órdenes `pendientes` si quedaron
3. **Crear nuevo evento** (borrador) para la próxima fiesta
4. El evento del 20 queda consultable para siempre en Historial

---

## Reiniciar ventas — implementado ✅

- API: `POST /api/admin/reset-ventas` · body `{ confirmacion: "REINICIAR" }`
- UI: Admin → **Resumen** · botón rojo + modal
- Solo si `evento.estado === 'borrador'`
- Borra: `ordenes` del evento (tickets CASCADE) + `activity_log`
- **No** borra `eventos` ni Storage
- Efecto: contadores 0 · QRs viejos → scanner “Entrada no válida”
- **No archiva** en historial — distinto de **Cerrar evento**

## Estados evento — implementado ✅

- Columna `eventos.estado` · migración `supabase/migrations/evento_estado.sql`
- API: `POST /api/admin/evento/estado` · `{ accion: "abrir_venta" | "cerrar" }`
- **Abrir venta:** borrador → venta (bloquea Reiniciar)
- **Cerrar evento:** venta → finalizado + `activo = false` (datos intactos en DB)
- Lógica: `lib/evento/estado.ts`

## PINs — implementado ✅ (14 jun)

- Tabla: `app_pins` · migración `supabase/migrations/app_pins.sql`
- Campos: `admin_pin`, `scanner_pin`, `pin_revision`, `updated_at`
- Lectura: `lib/auth/pins.ts` → Supabase primero, env Vercel si no hay fila
- Login: `POST /api/auth/pin` · sesión con revisión en cookie
- Validación sesión: `GET /api/auth/check` · `requireAuth()` en APIs admin/scanner
- Cambiar: `POST /api/admin/pins` · body `{ pinActual, pinAdminNuevo, pinScannerNuevo }`
- UI: Admin → **Seguridad** → **Cambiar PINs** (sin guía Vercel)
- Reglas: mínimo 6 caracteres · admin ≠ scanner · confirmación en formulario
- Efecto al guardar: `clearAuthCookie()` → reload → PinGate con mensaje amarillo

**Migración Supabase (una vez):**

```sql
CREATE TABLE IF NOT EXISTS app_pins (
  id TEXT PRIMARY KEY DEFAULT 'default',
  admin_pin TEXT NOT NULL,
  scanner_pin TEXT NOT NULL,
  pin_revision INT NOT NULL DEFAULT 1,
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

**Probar:** Seguridad → Cambiar PINs → re-login admin + scanner con PINs nuevos.

---

## Resend — guía setup (gestión, antes/durante código)

**Proveedor:** [Resend](https://resend.com) — servicio confiable, API simple, usado en producción con Next.js/Vercel. **Plan free: $0** — 3.000 mails/mes, 100/día (alcanza para ~300 entradas en un evento). No usar SMTP casero para QR transaccionales.

### Paso 1 — Cuenta

1. Entrá a https://resend.com/signup
2. Registrate (GitHub o email)
3. Verificá tu email de cuenta

### Paso 2 — API Key

1. Dashboard → **API Keys** (https://resend.com/api-keys)
2. **Create API Key** → nombre ej. `JR Eventos dev`
3. Permiso: **Sending access** (suficiente)
4. Copiá la key (`re_...`) — **solo se muestra una vez**
5. Pegar en `.env.local` y Vercel (nunca en GitHub):

```env
RESEND_API_KEY=re_xxxxxxxx
RESEND_FROM=JR Eventos <onboarding@resend.dev>
```

### Paso 3 — Probar sin dominio propio (recomendado ahora)

Resend incluye remitente de prueba:

- **From:** `onboarding@resend.dev`
- Podés enviar a **tu Gmail** (y emails que verifiques en Resend → **Domains** → sin dominio, en plan free a veces solo destinatarios verificados)

Para pruebas: usá **tu propio Gmail** como comprador en `/comprar`.

### Paso 4 — Producción (antes del evento 20, opcional)

1. Resend → **Domains** → Add domain (ej. dominio del organizador)
2. Agregar registros DNS (SPF, DKIM) que indica Resend
3. Cuando verifique: `RESEND_FROM=Entradas <entradas@tudominio.com>`
4. Mejor deliverability a Gmail de compradores

### Paso 5 — Variables completas (local + Vercel)

```env
RESEND_API_KEY=re_...
RESEND_FROM=JR Eventos <onboarding@resend.dev>   # prueba
NEXT_PUBLIC_APP_URL=https://jreventos-entradas.vercel.app
```

### Paso 6 — Código ✅

- `lib/email/send.ts` + `lib/email/template.ts` + `lib/email/attachments.ts`
- Hook en `approveOrden` (mock + futuro MP)
- Adjuntos inline Resend: **`contentId`** + **`contentType`** (camelCase) · QR en base64 · flyer vía `path`
- `/compra/exito`: **no** muestra QR — solo aviso de mail enviado
- Fallback sin `RESEND_API_KEY`: log `[EMAIL SIMULADO]`

### Paso 7 — Probar

1. `RESEND_API_KEY` en `.env.local` · `npm run dev`
2. `/comprar` → tu Gmail → simular pago exitoso
3. Revisar bandeja (y spam) · QR escaneable en scanner
4. Misma compra no debe duplicar mail (idempotencia)

Guía oficial: https://resend.com/docs/send-with-nextjs

---

## Email de confirmación — diseño acordado (a implementar)

> **Estado:** ✅ implementado y probado en Gmail móvil (fix contentId jun 2026).

### Objetivo / sensación

El mail no es un texto plano con un QR chico. Es la **confirmación visual del evento**: el comprador debe sentir *“compré para ESTA fiesta, acá está MI entrada, esto muestro en la puerta”*. Debe ser **muy llamativo**, al nivel del flyer de la landing.

### Estructura del mail (HTML)

```
┌─────────────────────────────────────┐
│  [FLYER — banner ancho full-width]  │  ← hero visual (prioridad)
│  [logo]  JR Eventos / organizador   │  ← logo chico junto al nombre
├─────────────────────────────────────┤
│  NOMBRE DEL EVENTO (grande, bold)   │
│  Sábado 20 de junio · 20:00 hs      │  ← mismo formatFecha que web
│  Lugar · [Ver en mapa] si mapsUrl   │
├─────────────────────────────────────┤
│  Hola {compradorNombre},            │
│  Confirmamos tu compra: X entrada(s)│
├─────────────────────────────────────┤
│  ┌─ Entrada 1 de 3 ─────────────┐   │  ← repetir por cada ticket
│  │     [ QR GRANDE en card      │   │
│  │       blanca, centrado ]     │   │
│  └──────────────────────────────┘   │
│  Presentá este QR en la entrada     │
├─────────────────────────────────────┤
│  Guardá este mail · Dudas → WhatsApp│
└─────────────────────────────────────┘
```

### Reglas de contenido

| Elemento | Regla |
|----------|--------|
| **Flyer** | Banner arriba (`evento.flyerUrl`) — **prioridad visual** sobre solo logo |
| **Logo** | Chico bajo o sobre el flyer (`evento.logoUrl`) |
| **Nombre evento** | Grande, mismo nombre que la web |
| **Fecha/hora** | `Sábado … · HH:mm hs` (Argentina) |
| **Lugar + mapa** | `evento.lugar` + link si `mapsUrl` |
| **Comprador** | Nombre + cantidad de entradas |
| **QR** | **Uno por ticket** — grande, fondo blanco, card con borde; `colorPrimario` del evento en acentos |
| **Varias entradas** | Una card por QR: “Entrada 2 de 3”, etc. |
| **Footer** | “Guardá este mail”, contacto organizador |

### Snapshot al comprar (anti-bugs)

Guardar en la **orden** (o campos JSON) al `approveOrden`:

- `evento_nombre`, `evento_fecha`, `evento_lugar`, `evento_maps_url`
- `evento_logo_url`, `evento_flyer_url`
- `evento_color_primario`, `organizador_nombre`

Así el mail histórico no cambia si el admin edita el evento después.

### Técnico (implementación futura)

| Pieza | Archivo / nota |
|-------|----------------|
| QR PNG | `lib/qr/generate.ts` → `generateQrBuffer(ticketId)` |
| Envío | `lib/email/send.ts` (nuevo) · Resend API |
| Hook | Tras tickets creados en `approveOrden` (mock + MP) |
| Idempotencia | `ordenes.email_sent_at` — migración SQL |
| Imágenes mail | Flyer/logo como URL pública (Supabase Storage o `/public`) |
| Fallback | Sin `RESEND_API_KEY` → log `[EMAIL SIMULADO]` |

### Asunto del mail (sugerido)

`Tu entrada — {nombre evento} · {fecha corta}`

Ej: `Tu entrada — Fiesta de Promo · 20 jun`

### Prueba visual

1. Compra simulada con **tu Gmail**
2. Mail debe verse bien en **Gmail móvil** (donde mostrarán el QR en puerta)
3. Escanear QR del mail en `/scanner` → verde
4. 3 entradas → 3 cards QR en el mismo mail

### Preferencia visual acordada

**Flyer grande arriba** + logo secundario (no mail minimalista solo con logo).

---

## Plan viernes 12 → lunes 15 (tarde)

### Viernes 12 — Bloque 1: UI y organizador ✅

**Gestión (paralelo):**
- [ ] Access Token MP **test** del hijo (guardar en `.env.local`, nunca en Git)
- [ ] API key Resend
- [ ] Definir `ADMIN_PIN` y `SCANNER_PIN` fuertes

**Código:**
- [x] Supabase Storage + upload logo/flyer desde admin (botón Subir + preview)
- [x] Link **Admin** en landing/footer
- [x] Botón **Scanner** en header del panel admin
- [x] Título/metadata pestaña → **"JR Eventos"**
- [x] Feedback claro en reembolso y baja de entrada
- [x] Campo Google Maps en admin (`mapsUrl`)
- [x] Formato fecha landing: `Sábado 20 de junio · 20:00 hs` (`lib/utils.ts` → `formatFecha`)
- [x] Push GitHub + deploy Vercel

**Pendiente manual (antes de usar upload):**
- [ ] Ejecutar `supabase/storage.sql` en Supabase SQL Editor (bucket `eventos`)

---

### Sábado 13 — Resend + reinicio + estados ✅

- [x] Resend en Vercel + migración `email_sent_at`
- [x] Mail con flyer + QR (fix Gmail contentId)
- [x] `/compra/exito` sin QR en pantalla
- [x] Reiniciar ventas + estados + Abrir venta + Cerrar evento
- [x] Migración `evento_estado.sql` (correr en Supabase si falta)

---

### Domingo 14 — Historial + PINs ✅

- [x] Pestaña **Historial** + detalle compradores/entradas
- [x] **Crear nuevo evento** (sin activo, borrador, copiar branding)
- [x] Botón **Staff** en landing
- [x] **PINs en Supabase** — cambiar desde Seguridad, invalidar sesión
- [x] Migración `app_pins.sql` en Supabase
- [x] Deploy `5050c7f` en Vercel

---

### Mercado Pago ✅ (madrugada lun 15)

- [x] App "JR Eventos Entradas" · Checkout Pro
- [x] Credenciales productivas activas
- [x] `MP_ACCESS_TOKEN` productivo en Vercel + **redeploy**
- [x] Webhook `/api/webhook-mp` (panel MP prueba + productivo)
- [x] Compra real probada ($1.000 test) → mail QR → acreditación MP cuenta hijo
- [x] Reembolso API MP en código (probar desde admin antes del 20)
- [ ] Scanner con QR de prueba (verde + amarillo re-escaneo)
- [ ] Compra 3 entradas → 3 QRs (opcional)

---

### Lunes 15 — plan del día (tarde, según jefe)

**Estado al mediodía:** MP OK · evento en **borrador** · precio prueba $1.000 · venta real objetivo **$8.000**.

| # | Tarea | Quién / cuándo |
|---|--------|----------------|
| 1 | Escanear QR de prueba en `/scanner` | Dev |
| 2 | **Reiniciar ventas** (borrador, confirmar `REINICIAR`) | Dev |
| 3 | Admin → Apariencia → **precio $8.000** + flyer coherente | Dev |
| 4 | **PINs fuertes** en Seguridad (admin + scanner) | Dev |
| 5 | `APP_MODE=production` en Vercel (opcional recomendado) | Dev |
| 6 | **Demo al jefe** — compra real chica o walkthrough admin/scanner | Tarde |
| 7 | Si jefe aprueba → **Abrir venta** (borrador → venta) | Tras OK jefe |
| 8 | Avisar jefe: comisión MP ~4% · plata tarjeta puede liberar **después** del 20 | Demo |

**No hacer hasta que jefe diga:** Abrir venta pública (bloquea Reiniciar).

**Entre 16–19 jun:** solo pruebas menores — no features grandes.

---

### Cierre producción (lun 15 tarde)

- [x] Token MP producción · 1 compra real probada
- [ ] Scanner prueba + Reiniciar ventas
- [ ] Precio $8.000 guardado
- [ ] PIN fuerte + `APP_MODE=production`
- [ ] Reembolso MP probado desde admin (opcional, recupera plata test)
- [ ] Demo al jefe · **Abrir venta** si aprueba

---

## Checklist "listo lunes tarde"

```
[x] Compro 1 entrada con MP productivo → plata en cuenta del hijo (prueba $1.000)
[x] Me llega mail con logo y QR
[x] Simulación de pago NO visible en producción (MP redirect)
[ ] Escaneo QR prueba → verde; repito → amarillo
[ ] Reiniciar ventas + precio $8.000 en admin
[ ] /admin con PIN nuevo (no 1234)
[ ] Demo al jefe → Abrir venta si aprueba
[ ] Compro 3 entradas → 3 QRs (opcional)
[ ] Reembolso desde admin → QR inválido (opcional, probar API MP)
[ ] Subo flyer y logo con botón si hace falta actualizar precio visual
```

---

## Variables Vercel (producción — domingo/lunes)

```
APP_MODE=production
ADMIN_PIN=********          # fallback si app_pins vacía; opcional tras migrar PINs
SCANNER_PIN=********        # fallback si app_pins vacía
MP_ACCESS_TOKEN=********          # productivo (activo 15 jun) · redeploy al cambiar
RESEND_API_KEY=********
RESEND_FROM=Entradas <...@...>
NEXT_PUBLIC_APP_URL=https://jreventos-entradas.vercel.app
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

**No** subir `.env.local` a GitHub.

---

## Fases (referencia)

- **A Mock** ✅
- **B Supabase** ✅ (Storage + upload en admin)
- **C MP + Resend** ✅ — MP productivo probado · ops lun 15 tarde pendiente
- **D Post-evento** — dominio propio, Supabase Auth opcional, Checkout Bricks opcional

---

## Fase A — Checklist

- [x] Next.js 14 + TypeScript + Tailwind
- [x] Mock DB + seed evento
- [x] Landing + footer
- [x] /comprar + simulador pago
- [x] QR + /compra/exito (múltiples entradas = múltiples QR)
- [x] /scanner + /api/verificar (atómico en Supabase)
- [x] /admin: stats, listas, bajas, reembolso DB, branding
- [x] Pruebas en celu / Vercel

---

## Fase B — Checklist

- [x] Proyecto Supabase `paginaqr-eventos`
- [x] Schema (`supabase/schema.sql`) + Realtime
- [x] `.env.local` + `npm run verify:supabase`
- [x] Capa `lib/db` auto Supabase/mock
- [x] Admin Realtime (contadores sin F5)
- [x] Flyer en `public/flyer.jpeg` + evento promo en DB
- [x] Fix caché landing (`force-dynamic`, no-store)
- [x] Simulación de pago funciona sin MP (`canSimulatePayment`)
- [x] Campo **fecha/hora** en admin (formato 24 h Argentina)
- [x] Supabase Storage + upload logo/flyer desde admin

---

## Fase C — Checklist (meta lun 15)

- [x] Resend — mail flyer + QR + `email_sent_at`
- [x] Reiniciar ventas (solo borrador) + estados evento
- [x] Historial — pestaña admin · eventos finalizados · stats + compradores + entradas
- [x] Crear nuevo evento desde admin
- [x] Botón Staff en nav del hero → /admin
- [x] PINs en Supabase — cambiar desde Seguridad (sin Vercel)
- [x] Mercado Pago Checkout Pro + webhook `/api/webhook-mp`
- [x] Reembolso vía API MP desde admin (código listo · probar en admin)
- [x] MP token producción + compra real de prueba
- [ ] Snapshot branding al comprar (opcional)
- [ ] Cambiar PINs de prueba en prod + `APP_MODE=production`

---

## Vercel — Checklist

- [x] Proyecto conectado a GitHub
- [x] Variables Supabase en producción
- [x] Deploy producción
- [x] Dominio `jreventos-entradas.vercel.app`
- [x] Build OK
- [x] Título pestaña → "JR Eventos"
- [x] Variables Resend en producción
- [x] Variable `MP_ACCESS_TOKEN` (productivo)
- [ ] PINs fuertes guardados en Supabase (desde Seguridad)
- [ ] Dominio propio (opcional, post-evento)

---

## Admin — Apariencia

- [x] Nombre evento, precio, capacidad, lugar, organizador
- [x] Fecha y hora (24 h, Argentina)
- [x] Colores, descripción, contacto, footer
- [x] URL flyer / logo (manual — reemplazar por upload)
- [x] Upload imágenes (botón Subir)
- [x] Google Maps (`mapsUrl`)
- [x] Formato fecha evento en landing (`Sábado … · HH:mm hs`)

---

## Pendiente opcional (post Bloque 1)

- [x] Link **Staff** en nav del hero → `/admin`
- [ ] Verificar precio **$8.000** en admin vs flyer (prueba fue $1.000)

---

## Qué falta — resumen para próxima sesión (lun 15 tarde)

| Prioridad | Bloque | Tareas |
|-----------|--------|--------|
| 1 | **Ops hoy** | Scanner prueba · Reiniciar · precio $8k · PINs · demo jefe |
| 2 | **Go live** | **Abrir venta** cuando diga el jefe (borrador → venta) |
| 3 | **Opcional** | Reembolso MP test · 3 entradas · snapshot branding · dominio propio |

**Ciclo actual (borrador):** Scanner QR prueba → Reiniciar → precio 8000 → esperar jefe → Abrir venta

**Antes de venta real al público:** PINs fuertes · precio $8.000 · MP productivo OK ✅

---
## Cómo probar el flujo (MP productivo — borrador)

1. `/comprar` → formulario → redirect Mercado Pago → tarjeta **real**
2. `/compra/exito` → “QR enviado al mail” (QR **solo** en Gmail)
3. `/scanner` → escanear QR → verde → re-escanear → amarillo
4. Admin → **Reiniciar ventas** (`REINICIAR`) mientras esté en borrador
5. Admin → reembolsar (opcional) → scanner → rojo "cancelada"

**Nota:** Con `MP_ACCESS_TOKEN` en Vercel no hay simulación. **Abrir venta** bloquea Reiniciar.

---

## Scripts útiles

```bash
npm run dev              # local (0.0.0.0 para celu en WiFi)
npm run verify:supabase  # chequear conexión DB
npm run update:evento    # actualizar evento demo en Supabase
```

---

## Cómo continuar en un nuevo chat

1. Leer este archivo — **Estado actual**, **Plan lun 15 tarde**, **MP productivo**
2. Meta: **demo jefe hoy tarde** · evento **vie 20**
3. Evento en **borrador** hasta que jefe diga **Abrir venta**
4. Pendiente: scanner prueba · Reiniciar · precio **$8.000** · PINs · opcional reembolso test
5. Deploy actual: `a965f26`+ · MP en `1de2524`
6. **Redeploy Vercel** siempre que cambies `MP_ACCESS_TOKEN`
