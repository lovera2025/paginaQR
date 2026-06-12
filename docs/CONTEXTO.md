# PaginaQR / JR Eventos — Contexto del proyecto

> Documento de referencia para continuar el desarrollo en cualquier chat/sesión.
> Última actualización: 12 junio 2026

## Estado actual

| Item | Estado |
|------|--------|
| Planificación completa | ✅ Hecho |
| Repo Git `paginaQR` | ✅ GitHub (lovera2025/paginaQR) |
| **Fase A — Mock local** | ✅ Completa |
| **Fase B — Supabase** | ✅ Conectada (proyecto `paginaqr-eventos`) |
| **Vercel — demo online** | ✅ Deploy + env vars |
| URL producción demo | ✅ https://jreventos-entradas.vercel.app |
| Evento demo configurado | ✅ Fiesta de Promo + flyer + Junior Eventos |
| Mercado Pago | ❌ Fase C |
| Resend (emails) | ❌ Fase C |
| Upload logo/flyer en admin | ❌ Pendiente |
| Dominio propio | ❌ Opcional (ej. entradas.jreventos.com) |

**Momento exacto:** Demo pública online (Vercel + Supabase). Compra **simulada**, QR y scanner **reales**. Siguiente: upload imágenes en admin → MP test → Resend → producción.

---

## URLs demo

| Qué | URL |
|-----|-----|
| Landing | https://jreventos-entradas.vercel.app |
| Comprar | /comprar |
| Admin | /admin (PIN `1234`) |
| Scanner | /scanner (PIN `1234`) |

Local: `npm run dev` → http://localhost:3000

Guías: `docs/SUPABASE-SETUP.md`, `docs/VERCEL-DEPLOY.md`

---

## Qué es el sistema

Sistema de venta de entradas para eventos (Argentina). Marca: **Junior Eventos / JR Eventos**.

- Web pública: landing → compra sin cuenta → pago simulado → QR único
- Scanner (`/scanner`): PWA, valida ingreso (PIN)
- Admin (`/admin`): contadores en vivo, listas, branding, bajas/reembolsos (PIN)

**Stack:** Next.js 14, Supabase, Vercel, Mercado Pago (pend.), Resend (pend.)

---

## Modelo de datos

### `ordenes` — estado: pendiente | aprobado | rechazado | reembolsado
### `tickets` — solo existen si orden aprobada. Campos: usado, cancelado
**NO hay `pagado` en tickets.**

---

## Fases

- **A Mock** ✅ — simulación completa
- **B Supabase** ✅ — DB, Realtime, persistencia
- **C MP test + Resend** ❌ — siguiente gran bloque
- **D Producción** ❌ — MP prod, dominio, PIN fuerte

---

## Fase A — Checklist

- [x] Next.js 14 + TypeScript + Tailwind
- [x] Mock DB + seed evento
- [x] Landing + footer
- [x] /comprar + simulador pago
- [x] QR + /compra/exito
- [x] /scanner + /api/verificar
- [x] /admin: stats, listas, bajas, reembolso, branding
- [x] Pruebas en celu / Vercel (demo con jefe)

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
- [ ] Supabase Storage + upload logo/flyer desde admin

---

## Vercel — Checklist

- [x] Proyecto conectado a GitHub
- [x] Variables de entorno (import `.env.local`)
- [x] Deploy producción
- [x] Dominio `jreventos-entradas.vercel.app`
- [x] Build OK (fix ESLint `shouldUseSupabase`)
- [ ] Título pestaña → "JR Eventos" (hoy: "PaginaQR — Entradas")
- [ ] Dominio propio (cuando exista)

---

## Admin — qué se edita hoy (Apariencia)

- [x] Nombre evento, precio, capacidad, lugar, organizador
- [x] Fecha y hora (24 h, Argentina)
- [x] Colores, descripción, contacto, footer
- [x] URL flyer / logo (manual)
- [ ] Upload imágenes (botón Subir)
- [ ] Google Maps (`mapsUrl`)

---

## Pendiente — orden sugerido

### Mejoras demo / UX
1. [ ] Upload logo y flyer en admin (Supabase Storage)
2. [ ] Branding: título pestaña + metadata "JR Eventos"
3. [ ] Campo Google Maps en admin

### Fase C — Pagos y emails
4. [ ] Mercado Pago sandbox (checkout + webhook `/api/webhook-mp`)
5. [ ] Resend — email HTML con QR adjunto
6. [ ] Probar tarjetas test MP + idempotencia webhook

### Fase D — Producción
7. [ ] MP token producción
8. [ ] Dominio propio + Resend verificado
9. [ ] PIN fuerte (no `1234`)
10. [ ] Checklist pre-evento (compra real, scanner en varios celus, reenvío QR)

---

## Cómo probar el flujo

1. `/comprar` → formulario → simular pago exitoso
2. `/compra/exito` → ver QR
3. `/admin` → contadores suben
4. `/scanner` → escanear → verde → re-escanear → amarillo "ya usada"

**Nota:** Con Supabase configurado, `APP_MODE=mock` o `development` sin `MP_ACCESS_TOKEN` → simulación activa.

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
2. Probar https://jreventos-entradas.vercel.app
3. Siguiente tarea: upload imágenes en admin **o** Fase C (MP + Resend)
