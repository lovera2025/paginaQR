# PaginaQR / JR Eventos — Contexto del proyecto

> Documento de referencia para continuar el desarrollo en cualquier chat/sesión.
> Última actualización: 12 junio 2026

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
| Mercado Pago (Checkout Pro) | ❌ Fase C — credenciales listas, código pendiente |
| Resend (emails con QR) | ❌ Fase C |
| PIN fuerte en producción | ❌ Pendiente |
| Dominio propio | ❌ Opcional (ej. entradas.jreventos.com) |

**Momento exacto:** Bloque 1 completo (vie 12). Demo online con compra **simulada**. Siguiente: **MP sáb 13** → **Resend dom 14** → cierre lun 15 tarde.

---

## Mercado Pago — cuenta y decisión

- **Integración elegida:** Checkout Pro (redirect + webhook). No link de pago suelto, no Checkout API.
- **Cuenta:** Mercado Pago del **hijo** del jefe (amigo de confianza del dev).
- **La plata del evento cae en esa cuenta MP** (reembolsos también salen de ahí).
- **Paso 0 (gestión):** credenciales hoy — app "JR Eventos Entradas" en [developers.mercadopago.com](https://www.mercadopago.com.ar/developers) → **Access Token test** (sábado) + **producción** (lunes).
- **Implementación en código:** después del Bloque 1 (botones, upload, branding).

---

## Auth — sin cuentas de usuario

- Admin y scanner: **PIN** en variables de entorno (`ADMIN_PIN`, `SCANNER_PIN`).
- No hay registro/login con email en la app (postergar Supabase Auth).
- Admin puede entrar a `/scanner` sin re-PIN si ya tiene cookie admin.
- Producción: PIN fuerte distinto para admin vs scanner; sacar `1234` de Vercel.

---

## URLs

| Qué | URL |
|-----|-----|
| Landing | https://jreventos-entradas.vercel.app |
| Comprar | /comprar |
| Admin | /admin (PIN — cambiar en prod) |
| Scanner | /scanner (PIN — cambiar en prod) |

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

**Pendiente Fase C:** snapshot de branding al comprar (logo/nombre evento) para emails históricos.

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

**Pendiente manual:** ejecutar `supabase/storage.sql` en Supabase si el upload falla.

---

### Sábado 13 — Bloque 2: Mercado Pago

- [ ] Checkout Pro: crear preferencia al comprar → redirect a MP
- [ ] Webhook `/api/webhook-mp` → pago `approved` → `approveOrden`
- [ ] Idempotencia (mismo pago no duplica tickets)
- [ ] `/comprar/pago`: redirect real cuando hay `MP_ACCESS_TOKEN`; sin simulación en prod
- [ ] URLs retorno → `/compra/exito` / `/compra/error`

**Pruebas:**
- [ ] Compra test con tarjetas MP (sandbox)
- [ ] 3 entradas → 3 QRs distintos → scanner verde/amarillo OK

---

### Domingo 14 — Bloque 3: Email + reembolso + seguridad

- [ ] Resend al aprobar orden — HTML con logo del evento, **1 QR por entrada**
- [ ] Snapshot logo/nombre evento al momento de la compra (orden o ticket)
- [ ] Reembolso admin → API refund MP + cancelar tickets en DB
- [ ] `APP_MODE=production` + PINs nuevos en Vercel
- [ ] Desactivar simulación de pago en producción

**Pruebas:**
- [ ] Mail llega a Gmail real
- [ ] Reembolso → scanner muestra "cancelada"
- [ ] Flujo completo en celular

---

### Lunes 15 — Entrega operativa (tarde)

**Mañana (solo ajustes, no features nuevas):**
- [ ] Token MP **producción** en Vercel
- [ ] **1 compra real chica** — plata en cuenta del hijo + mail + QR + scanner
- [ ] Scanner en celu de puerta del evento

**Tarde:** demo al jefe — sistema **operativo** de punta a punta.

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
ADMIN_PIN=********
SCANNER_PIN=********
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
- **B Supabase** ✅ (falta Storage upload)
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

- [ ] Mercado Pago Checkout Pro + webhook `/api/webhook-mp`
- [ ] Reembolso vía API MP desde admin
- [ ] Resend — email HTML con logo + QR por entrada
- [ ] Snapshot branding al comprar
- [ ] Probar tarjetas test + idempotencia webhook
- [ ] MP token producción + compra real de prueba

---

## Vercel — Checklist

- [x] Proyecto conectado a GitHub
- [x] Variables Supabase en producción
- [x] Deploy producción
- [x] Dominio `jreventos-entradas.vercel.app`
- [x] Build OK
- [x] Título pestaña → "JR Eventos"
- [ ] Variables MP + Resend + PIN fuerte
- [ ] Dominio propio (opcional, post-evento)

---

## Admin — Apariencia

- [x] Nombre evento, precio, capacidad, lugar, organizador
- [x] Fecha y hora (24 h, Argentina)
- [x] Colores, descripción, contacto, footer
- [x] URL flyer / logo (manual — reemplazar por upload)
- [x] Upload imágenes (botón Subir)
- [x] Google Maps (`mapsUrl`)

---

## Cómo probar el flujo (hoy — simulación)

1. `/comprar` → formulario → simular pago exitoso
2. `/compra/exito` → ver QR(s) — una tarjeta por entrada
3. `/admin` → contadores suben
4. `/scanner` → escanear → verde → re-escanear → amarillo "ya usada"
5. Admin → reembolsar → scanner → rojo "cancelada"

**Nota:** Con Supabase y sin `MP_ACCESS_TOKEN`, `canSimulatePayment()` → simulación activa.

---

## Scripts útiles

```bash
npm run dev              # local (0.0.0.0 para celu en WiFi)
npm run verify:supabase  # chequear conexión DB
npm run update:evento    # actualizar evento demo en Supabase
```

---

## Cómo continuar en un nuevo chat

1. Leer este archivo
2. Confirmar meta: **operativo lun 15 tarde**, evento **vie 20**
3. **Siguiente tarea código:** Bloque 2 — Mercado Pago Checkout Pro + webhook (sáb 13)
4. **Después:** Resend → PIN prod → prueba compra real
5. Probar https://jreventos-entradas.vercel.app
6. Si upload falla: ejecutar `supabase/storage.sql` en SQL Editor
