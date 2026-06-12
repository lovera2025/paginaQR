# PaginaQR — Contexto del proyecto

> Documento de referencia para continuar el desarrollo en cualquier chat/sesión.
> Última actualización: junio 2026

## Estado actual

| Item | Estado |
|------|--------|
| Planificación completa | ✅ Hecho |
| Repo Git `paginaQR` | ✅ Creado |
| **Fase A mock local** | ✅ Implementada |
| **Fase B Supabase (código)** | ✅ Preparada — falta conectar tu proyecto |
| Supabase (proyecto en la nube) | ❌ Pendiente — ver `docs/SUPABASE-SETUP.md` |
| Vercel | ❌ Cuando conectes GitHub |
| Mercado Pago | ❌ Fase C |
| Resend (emails) | ❌ Fase C |

**Momento exacto:** Fase B preparada en código. Sin variables Supabase → sigue en mock. Conectar proyecto: `docs/SUPABASE-SETUP.md`.

---

## Cómo probar ahora

```bash
npm run dev
```

| Ruta | PIN | Qué hace |
|------|-----|----------|
| http://localhost:3000 | — | Landing del evento |
| /comprar | — | Formulario de compra |
| /comprar/pago | — | Simular pago (mock) |
| /compra/exito | — | Ver QR después de pagar |
| /admin | `1234` | Dashboard + branding |
| /scanner | `1234` | Escanear QR (cámara) |

**Flujo de prueba:**
1. Comprar → simular pago exitoso → ver QR en /compra/exito
2. Abrir /scanner en el celu (misma red) → escanear QR → verde
3. Escanear de nuevo → amarillo "ya usada"
4. /admin → contadores suben sin F5

---

## Qué es el sistema

Sistema de venta de entradas para eventos (Argentina).

- Web pública: landing → compra sin cuenta → pago → QR único
- Scanner (`/scanner`): PWA, valida ingreso
- Admin (`/admin`): contadores en vivo, listas, branding, bajas/reembolsos

**Stack:** Next.js 14, Supabase (Fase B), Vercel, Mercado Pago, Resend

---

## Modelo de datos

### `ordenes` — estado: pendiente | aprobado | rechazado | reembolsado
### `tickets` — solo existen si orden aprobada. Campos: usado, cancelado
**NO hay `pagado` en tickets.**

---

## Fases

- **A Mock** ✅ — local, simulación completa
- **B Supabase** — DB, Storage, Realtime
- **C MP test + Resend**
- **D Producción**

---

## Fase A — Checklist

- [x] Next.js 14 + TypeScript + Tailwind
- [x] Mock DB + seed evento
- [x] Landing + footer
- [x] /comprar + simulador pago
- [x] QR + /compra/exito
- [x] /scanner + /api/verificar
- [x] /admin: stats, listas, bajas, reembolso, branding
- [ ] Pruebas manuales en celular (usuario)

---

## Cómo continuar en un nuevo chat

1. Leer este archivo
2. `npm run dev` y probar el flujo
3. Si Fase A OK → empezar Fase B (Supabase schema + conexión)
