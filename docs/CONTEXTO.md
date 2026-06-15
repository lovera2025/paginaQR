# PaginaQR / JR Eventos — Contexto del proyecto

> Documento de referencia para continuar el desarrollo en cualquier chat/sesión.
> Última actualización: 14 junio 2026 — Historial + PINs en Supabase desplegados. **Próximo chat: Mercado Pago**

## Meta inmediata

| Hito | Fecha |
|------|-------|
| **Sistema operativo** (venta real, mail, admin, scanner) | **Lunes 15 jun 2026 — tarde** |
| **Evento en vivo** (Fiesta de Promo / JR Eventos) | **Viernes 20 jun 2026** |

**Operativo** = subir imágenes desde admin, compra con **Mercado Pago real**, webhook → tickets/QR, **email con logo**, scanner una vez por entrada, reembolso funcional, PIN fuerte en producción (sin `1234`).

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
| Reembolso en DB + invalidación scanner | ✅ Funciona (MP refund pendiente) |
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
| Mercado Pago (Checkout Pro) | ❌ **Próximo chat** |
| Reembolso vía API MP | ❌ Con MP |
| PIN fuerte en producción | ⚠️ Cambiar desde Seguridad (no dejar `1234`) |
| Dominio propio | ❌ Opcional (ej. entradas.jreventos.com) |

**Momento exacto:** Compra **simulada** en prod. Mail + scanner + historial + PINs desde admin OK. **Próximo:** MP (Checkout Pro + webhook) cuando haya Access Token.

**Commits recientes:** `5050c7f` (PINs Supabase) · `e6ef189` (historial + Staff) · `22323c9` (docs) · `187fd79` (reinicio + estados)

---

## Mercado Pago — cuenta y decisión

- **Integración elegida:** Checkout Pro (redirect + webhook). No link de pago suelto, no Checkout API.
- **Cuenta:** Mercado Pago del **hijo** del jefe (amigo de confianza del dev).
- **La plata del evento cae en esa cuenta MP** (reembolsos también salen de ahí).
- **Paso 0 (gestión):** app "JR Eventos Entradas" en [developers.mercadopago.com](https://www.mercadopago.com.ar/developers) → **Access Token test** (sábado) + **producción** (lunes).
- **Implementación en código:** Bloque 2 (sábado 13).

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
| 6 | **Mercado Pago** | ❌ **Próximo** (Checkout Pro + webhook) |
| 7 | **Ops prod** | ❌ Reembolso MP, `APP_MODE=production`, demo jefe |

**Decisión acordada (13 jun):** Historial **antes** que MP — MP es más sensible; conviene tener archivado/listas listas antes de plata real.

### Ciclo de prueba (sin MP)

```
Reiniciar ventas → compra simulada → mail Resend → /compra/exito → scanner
→ reembolso (opcional) → Reiniciar otra vez
```

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
| Webhook MP (futuro) | No duplicar tickets si mismo `mp_payment_id` |
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

### Mercado Pago (PRÓXIMO — más sensible)

- [ ] Checkout Pro + webhook `/api/webhook-mp`
- [ ] Idempotencia pago · sacar simulación con token en prod
- [ ] Reembolso API MP desde admin

**Pruebas MP:**
- [ ] Compra test tarjetas sandbox
- [ ] 3 entradas → 3 QRs → scanner OK

---

### Cierre producción (lun 15)

- [ ] Reembolso MP + PIN fuerte + `APP_MODE=production`
- [ ] Token MP producción · 1 compra real chica
- [ ] Demo al jefe

---

## Checklist "listo lunes tarde"

```
[ ] /admin con PIN nuevo (no 1234)
[ ] Subo flyer y logo con botón (no URL manual)
[ ] Abro /scanner desde admin
[ ] Compro 1 entrada con MP → plata en cuenta del hijo
[ ] Me llega mail con logo y QR
[ ] Escaneo → verde; repito mismo QR → amarillo
[ ] Compro 3 entradas → 3 QRs, 3 ingresos OK
[ ] Reembolso desde admin → QR inválido en scanner
[ ] Simulación de pago NO visible en producción
```

---

## Variables Vercel (producción — domingo/lunes)

```
APP_MODE=production
ADMIN_PIN=********          # fallback si app_pins vacía; opcional tras migrar PINs
SCANNER_PIN=********        # fallback si app_pins vacía
MP_ACCESS_TOKEN=********          # test sábado → prod lunes
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
- **C MP + Resend** ❌ — en curso (meta lun 15 tarde)
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
- [ ] Mercado Pago Checkout Pro + webhook `/api/webhook-mp`
- [ ] Reembolso vía API MP desde admin
- [ ] Snapshot branding al comprar
- [ ] MP token producción + compra real de prueba
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
- [ ] Variable `MP_ACCESS_TOKEN`
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
- [ ] Verificar precio en DB vs flyer si no coincide en producción

---

## Qué falta — resumen para próxima sesión

| Prioridad | Bloque | Tareas |
|-----------|--------|--------|
| 1 | **Mercado Pago** | Access Token (hijo) · Checkout Pro · webhook `/api/webhook-mp` · sacar simulación |
| 2 | **Ops prod** | Cambiar PINs desde Seguridad · `APP_MODE=production` · reembolso MP · demo jefe (lun 15) |
| 3 | **Opcional** | Snapshot branding al comprar · dominio propio |

**Gestión paralela:** recuperar contraseña/token MP del hijo

**Ciclo prueba actual (borrador):** Reiniciar → comprar simulado → mail → scanner → Reiniciar

**Antes de venta real:** Abrir venta pública · MP conectado · PINs fuertes en Supabase

---
## Cómo probar el flujo (simulación — hasta conectar MP)

1. `/comprar` → formulario → simular pago exitoso
2. `/compra/exito` → mensaje “QR enviado al mail” (QR **solo** en Gmail)
3. `/admin` → contadores suben · **Resumen** → estado Borrador · **Reiniciar ventas** si querés limpiar
4. `/scanner` → escanear QR del mail → verde → re-escanear → amarillo "ya usada"
5. Admin → reembolsar → scanner → rojo "cancelada"

**Nota:** Sin `MP_ACCESS_TOKEN`, `canSimulatePayment()` → simulación activa. **Abrir venta pública** bloquea Reiniciar.

---

## Scripts útiles

```bash
npm run dev              # local (0.0.0.0 para celu en WiFi)
npm run verify:supabase  # chequear conexión DB
npm run update:evento    # actualizar evento demo en Supabase
```

---

## Cómo continuar en un nuevo chat

1. Leer este archivo — **Estado actual**, **PINs**, **Historial**, **Reiniciar ventas**
2. Meta: **operativo lun 15 tarde**, evento **vie 20**
3. Usuario dirá **“implementá Mercado Pago”** — requiere `MP_ACCESS_TOKEN` del hijo
4. Verificar: PINs cambiados en Seguridad · migración `app_pins.sql` corrida · deploy `5050c7f`+
5. Migraciones Supabase si faltan: `email_sent_at.sql`, `evento_estado.sql`, `app_pins.sql`
6. Orden: **MP → ops prod** (historial y PINs ya hechos)
