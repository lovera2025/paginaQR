# PaginaQR / Junior Eventos — Contexto del proyecto

> Documento de referencia para continuar el desarrollo en cualquier chat/sesión.
> Última actualización: **9 noviembre 2026 (noche)** — Base real conectada y probada, `junior-eventos` movido a la organización `paginaqr-eventos`, **sin mail: las entradas se entregan en pantalla + PDF**, "Mis entradas" por dispositivo, aviso de mail mal escrito y contador de reserva. Rama `rediseno-recepciones` (sin push, sin deploy). **Objetivo antes de lanzar:** que cualquiera compre → pago aprobado → entradas y PDF disponibles, sin errores. Recién con eso verificado se lanza.
> **Calendario:** 9 nov = día de pruebas. **10 nov = lanzamiento si todo sale bien** (solo con OK del usuario).
> **Para retomar en un chat nuevo:** "leé `docs/CONTEXTO.md` y seguimos con lo pendiente" → ir a **Pendiente para retomar**.
> **Dónde quedamos (cierre 9 nov noche):** todo commiteado en `rediseno-recepciones`, nada pusheado ni desplegado. `npm test` 99/99, lint y tipos OK. `.env.local` ya tiene la `service_role` y la web local usa la base real `junior-eventos` (migraciones al día). **Próximo paso: Mercado Pago de prueba (paso 4) y Vercel (paso 5).**

## Sesión 9 nov (noche) — base real, sin mail, Mis entradas

### Hecho
- **Base real conectada:** la `service_role` está en `.env.local`. El archivo había quedado guardado en UTF-16 (Bloc de notas) y Next no lo leía: se volvió a guardar en UTF-8. Si se edita a mano, guardarlo en **UTF-8**.
- **Supabase:** `junior-eventos` (ref `jllfdxxleszeimsxruva`) se **movió a la organización `paginaqr-eventos`**, junto al proyecto viejo (pausado, sin tocar). URL y claves no cambiaron. El conector de Supabase de Claude ya lo ve. Migración `reservas_y_problemas` aplicada; `npm run verify:supabase` todo ✅.
- **Probado contra la base real** (fiesta Pinaroli, en borrador): compra → reserva descuenta → pago simulado → 2 entradas → PDF → scanner (1ª válida, 2ª "usada") → anular 1 (vuelve el cupo) → estadísticas/compras/actividad; pago sin cupo → aviso → "Ya le devolví la plata" → devuelta. Quedan compras de prueba en Pinaroli: se borran con **Reiniciar ventas** antes de publicar.
- **Sin mail (decisión del usuario):** las entradas se entregan en pantalla + PDF, y el contacto con el organizador es por WhatsApp. Se apagó el envío en `approveOrden` (`lib/db/index.ts`; el código de mail queda en `lib/email/` por si algún día hay dominio) y se sacaron todos los textos que prometían mail. El mail del comprador queda solo como dato de contacto. **Ya no hace falta Resend ni dominio para lanzar.**
- **Mis entradas** (`/mis-entradas`): cada dispositivo (celular o compu) guarda sus compras aprobadas (`lib/entradas/guardadas.ts`, localStorage). La portada muestra "Tenés N compras en este dispositivo"; link en el pie. Desde otro dispositivo: WhatsApp → el organizador baja el PDF en Admin → Compras.
- **Aviso de mail mal escrito:** "¿Quisiste decir …@gmail.com?" al salir del campo y antes de seguir al pago (`sugerirEmail` en `lib/utils.ts`).
- **Contador de reserva** en la pantalla de pago ("Te guardamos tus entradas 09:58"); al llegar a cero, "Se terminó el tiempo" + "Elegir de nuevo".
- **Fallas arregladas:** el scanner tiraba un error (y podía romper la página) al cambiar de fiesta o salir si la cámara no había arrancado (compu sin cámara, permiso negado); las lecturas de Supabase reintentan ante cortes de red momentáneos (el resumen del panel fallaba entero).
- Probado en el navegador a 375 px y a 1280 px: portada, fiesta, compra, pago, éxito, Mis entradas.

### Ojo antes de lanzar
- **El WhatsApp de contacto está vacío en la base real** (Admin → Apariencia / cada fiesta). Sin eso no aparecen los botones de anular, "pago sin cupo", "no encuentro mi entrada" ni el de la portada. Es parte del paso 7 (datos del jefe).

## Sesión 9 nov (tarde) — riesgos de plata, visual y segunda pasada

### Hecho
- **Reservas de 15 minutos:** una compra sin pagar guarda sus entradas 15 min (cuentan contra cupo y aforo en la web y en el checkout). Constantes en `lib/entradas/tipos.ts` (`RESERVA_MINUTOS`, `LINK_PAGO_MINUTOS`). La fiesta muestra "Agotado" mientras las últimas están reservadas.
- **Link de Mercado Pago que vence** a los 10 min de la compra, en modo binario (aprobado o rechazado al instante) y sin efectivo (Rapipago/PagoFácil). Pasados 10 min, "Pagar" dice que la reserva venció. `lib/mercadopago/preferences.ts`.
- **Pago sin cupo:** si igual entra un pago y ya no quedan entradas (ej. transferencia tardía), no se emiten: la compra queda `problema = pago_sin_cupo`, el comprador ve "Se agotaron mientras pagabas, te devolvemos la plata" con su código, y Admin → Compras muestra un aviso rojo + chip "PAGO SIN CUPO · DEVOLVER" + botón "Ya le devolví la plata" (la deja como devuelta). Queda en Actividad.
- **Conteos completos:** Supabase cortaba en 1000 filas sin avisar (con 9 fiestas se pasaba rápido y contaba de menos). Ahora trae todo de a páginas (`lib/supabase/paginar.ts`) y, para contar cupos, pide solo 4 columnas por entrada.
- **Tope de compras por IP:** 15 compras iniciadas cada 10 min (`lib/limite.ts`, también lo usa el login).
- **Tarjeta rechazada ya no cierra la compra** (falla que venía de antes): si la persona prueba con otra tarjeta en el mismo checkout y paga, se emiten las entradas. Antes ese pago se ignoraba → cobrado sin entradas. Un pago aprobado o transferencia que llega para una compra rechazada/vencida la reabre.
- **Avisos de MP y Talo con reintento:** si falla algo momentáneo (base, red) responden error para que MP/Talo los reintenten. Antes respondían OK y la compra quedaba pendiente con la plata cobrada.
- **Admin → Compras → "Revisar pago":** consulta MP/Talo para una compra pendiente ("pagué y no me llegó"); si estaba paga, emite y manda el mail.
- **PIN en producción:** con la base nueva (`app_pins` vacía) y sin `ADMIN_PIN` en Vercel, el PIN de jefe era `1234`. Ahora en producción un PIN débil (1234 o menos de 6) nunca abre sesión: **hay que cargar `ADMIN_PIN` y `SCANNER_PIN` en Vercel** (ver paso 5).
- **Visual:** portada del celular con abanico de 3 flyers; imagen para compartir el link (portada y una por fiesta con flyer, nombre, fecha y lugar, letra Righteous: `app/opengraph-image.tsx`, `app/fiesta/[slug]/opengraph-image.tsx`); la web muestra solo los medios de pago activos (antes siempre decía "Mercado Pago o Transferencia"); textos chicos a 12 px y más contraste; páginas de error y "no existe" con la marca; "Pago no realizado" deja probar de nuevo con la misma reserva; la pantalla de pago manda a las entradas si ya está paga.
- Otros: cerrar la fiesta no borra los "pago sin cupo"; el mail se reintenta aunque el envío tire excepción; `/api/talo/sync` no da error sin Talo; tests nuevos (reservas, pago sin cupo, reintentos, PDF/mail con emojis y HTML, login en producción).
- **Migración nueva:** `supabase/migrations/2026_11_reservas_y_problemas.sql` (columna `ordenes.problema` + índice). `npm run verify:supabase` avisa si falta.

### Para después (no hecho, anotado)
- **Compra:** aviso de mail mal escrito ("¿quisiste decir gmail.com?"), página `/mis-entradas` para reenviar por mail, contador "te guardamos tus entradas 09:58" en la pantalla de pago.
- **Puerta:** pantalla siempre encendida en el scanner y en la entrada, contador real "ingresaron X de Y", ingreso manual por nombre.
- **Menores:** si alguien paga dos veces la misma compra no se avisa; las reservas se podrían abusar (15 compras × 10 entradas por IP); nombres en alfabetos no latinos salen vacíos en el PDF; aprobación atómica en Postgres; partir `AdminDashboard.tsx`.

## Estado al 9 nov 2026 (mañana)

### Hecho
- **Login/Staff**: el acceso al staff se llama así en el header de la portada, en el pie y en la pantalla del PIN.
- **Modo prueba**: si los pagos son simulados o de prueba, la web muestra una barra "MODO SIMULACIÓN / MODO PRUEBA" (portada, fiesta, pago y éxito). Cada compra guarda `modo_pago` (`simulado` / `sandbox` / `produccion`): chip SIMULADA/PRUEBA en Compras y Emitidas, "ENTRADA DE PRUEBA" en el scanner y asunto `[PRUEBA]` en el mail. Admin → Pagos: estado de cada medio (Producción / Prueba / Apagado), guía para probar Mercado Pago con cuentas y tarjetas de prueba, checklist antes de lanzar, y "Probar" avisa si el token es de prueba o de producción y si no coincide con el ambiente. Publicar con pagos de prueba pide confirmación. Los avisos de Mercado Pago/Talo quedan en Actividad.
- **Próximamente** (por tipo y por fiesta): en Admin → Entradas y precios, "Estado de venta" = A la venta / Próximamente con fecha (cuenta regresiva, abre sola) / Próximamente fecha a confirmar, y "Mostrar el precio antes de abrir". En Admin → Fiesta, bloque "Venta de la fiesta" igual. En la web: tarjetas PRÓXIMAMENTE sin precio ni cantidad (el precio tampoco viaja en la API), "Avisame cuando abra" por WhatsApp, badge "ANTICIPADAS A LA VENTA". Datos de ejemplo: Anticipada a la venta, General abre sola cuando cierra la anticipada, VIP a confirmar.
- **Anulaciones a mano** (el comprador escribe por WhatsApp; plazo de ~4 horas, texto editable en Admin → Marca → "Política de anulación"): Admin → Compras → "Anular…" → elegir entradas, motivo y "Ya le devolví la plata". La entrada da rojo "Entrada anulada" en la puerta, desaparece del PDF, el cupo vuelve y queda en Actividad. Una entrada que ya ingresó no se puede anular. Sin API de reembolso de Mercado Pago (la plata la devuelve el jefe). Recaudado se muestra neto de lo devuelto.
- **Marca Junior Eventos**: isotipo y nombre oficiales (desde `Desktop\plan\icons`, preparados con `node scripts/preparar-marca.mjs <carpeta>` en `public/marca/`), títulos en **Righteous** (parecida a las letras del logo), dorado se mantiene, magenta solo en el logo. Íconos de la app y favicon con el isotipo (`node scripts/make-icons.mjs --from public/marca/isotipo-claro.png`). Logo en la cabecera del PDF y del mail.
- **Tests automáticos**: `npm test` (vitest, 45 pruebas, base en memoria): entradas solo con pago aprobado, cupos, precio congelado, Próximamente, avisos de MP/Talo (aprobado, rechazado, duplicado, monto menor), puerta, anulaciones, sesión firmada.
- **Seguridad (arreglado)**:
  - La sesión del staff era una cookie sin firmar (`admin:1`): cualquiera podía falsificarla y entrar al panel. Ahora está firmada (HMAC) y vence a las 12 h. Clave: `AUTH_SECRET` o, si no está, la `SUPABASE_SERVICE_ROLE_KEY`.
  - Límite de 8 intentos fallidos de PIN cada 10 minutos por IP.
  - `app_pins` y `app_payments` no tenían RLS: la clave pública (que va en el navegador) podía leer los PINs y el token de Mercado Pago. Ahora tienen RLS. **El proyecto de junio `paginaqr-eventos` sí existe (pausado) y mientras estuvo activo tenía ese problema: para lanzar, cargar un token de Mercado Pago de producción NUEVO (regenerado en el panel de MP), no el de junio.**
  - Sin `APP_MODE` en el deploy de producción de Vercel la app caía en "simulación" (entradas gratis). Ahora en producción nunca se simula; si no hay medios de pago, no deja comprar.
  - El pago de MP se aprueba solo si el monto pagado cubre la compra.
  - El precio viejo de la fiesta (`eventos.precio`) ya no se publica.
- **Supabase nuevo**: proyecto `junior-eventos` (ref `jllfdxxleszeimsxruva`, São Paulo, plan gratis) en la org `lovera2025's Org`. Ya tiene `schema.sql`, `storage.sql`, la migración `2026_11_modo_prueba_proximamente_anulaciones.sql` y el seed de las 9 fiestas (en borrador). URL y clave pública ya están en `.env.local`.
  - **Decisión (9 nov): se lanza con `junior-eventos`.** El de junio `paginaqr-eventos` (otra cuenta/org, ref `vzstuqpbqaunuhcuitix`) queda **pausado** con los PINs y ventas de junio. Supabase permite 2 proyectos gratis activos por dueño: `lovera2025` tiene ArguelloApp + junior-eventos. **ArguelloApp no se pausa nunca.**

### Acceso y cuentas (para probar)
- **No hay registro ni usuarios.** Los compradores compran sin cuenta (nombre + mail). El staff entra solo con PIN en **Login/Staff**: un PIN de jefe (panel + scanner) y uno de puerta (solo scanner).
- **PIN local de prueba:** el que está en `.env.local` (`ADMIN_PIN` / `SCANNER_PIN`). Hoy los dos son el de prueba `1234`, así que entra como jefe. Con la base real, mientras `app_pins` esté vacía, se usan esos mismos.
- Para probar la puerta aparte: Admin → Seguridad → Cambiar PINs (6+ dígitos, distintos). **Antes de lanzar hay que cambiarlos sí o sí.**
- Los PINs de junio quedaron en el proyecto pausado `paginaqr-eventos`; no se traen (decisión 9 nov).

### Cómo probar hoy
- **Sin la service role**, la app usa la base en memoria: lo que compres se borra al reiniciar el servidor. Con la clave pegada queda guardado en Supabase.
- **En la compu:** `npm run dev` → http://localhost:3000. **En el celular (misma WiFi):** http://IP-de-la-PC:3000 sirve para comprar, pero la **cámara del scanner necesita https**: probarla en la versión de Vercel o con la webcam de la compu en localhost.
- **Pagos:** sin Mercado Pago configurado, el pago se aprueba/rechaza con los botones de simulación (barra "MODO SIMULACIÓN"). Para tarjetas de prueba de MP hace falta el Access Token del vendedor de prueba (paso 4).

### Conector de Supabase de Claude (importante)
- El 9 nov el conector se cambió a la cuenta/org vieja **`paginaqr-eventos`** para buscar lo de junio. **Hoy Claude solo ve el proyecto pausado de junio, no `junior-eventos`.**
- Para que Claude pueda volver a trabajar sobre `junior-eventos`: Claude → Configuración → Conectores → Supabase → Desconectar → Conectar → elegir la organización **`lovera2025's Org`**. (La app en sí no depende del conector: usa las claves de `.env.local` / Vercel.)
- No se pudo reactivar `paginaqr-eventos`: límite de 2 proyectos gratis activos por dueño (ArguelloApp + junior-eventos). **ArguelloApp no se pausa nunca.**

### Probado (9 nov, local)
- Portada, fiesta, pago simulado, éxito, PDF (3 páginas con logo), admin (Compras, Anular, Entradas y precios, Pagos), /staff en 375 px sin scroll horizontal.
- Por API: General próximamente → checkout 400; email inválido → 400; antes de aprobar entradas/PDF → 409; puerta válida → ya usada → otra fiesta; anular entrada usada → error; anular con devolución → rojo en la puerta, PDF individual 410, cupo +1, recaudado neto; cookie falsificada → 401.
- `npm test` (45/45), `npm run lint` y `npm run build` sin errores.
- **No probado todavía**: Supabase real desde la app (falta la service role), Mercado Pago de prueba, mail real, cámara del scanner, deploy.

## Sesión anterior (7 nov 2026)

### Hecho
- **Varias fiestas a la vez.** Ya no existe "el evento activo": la portada muestra todas las fiestas en `venta` o `pausado`. Cada una tiene su página `/fiesta/<slug>` con flyer, cuenta regresiva, selector de entradas y compra.
- **Tipos de entrada por fiesta** (tabla `tipos_entrada`): nombre, precio, cupo, venta desde/hasta, diseño (`anticipada`, `general`, `vip`, `custom`), beneficios, activo, orden. Se editan en **Admin → Entradas y precios**, con vista previa en vivo.
  - El precio se **congela en la compra** (`ordenes.precio_unitario`); cambiarlo después no toca lo vendido.
  - Al aprobar el pago se revalida cupo del tipo **y** aforo de la fiesta.
  - Cada entrada guarda `tipo_nombre` y `estilo` (si renombrás o borrás el tipo, lo emitido no cambia). Un tipo con ventas no se borra: se desactiva.
- **Entrada digital** con 3 diseños (Anticipada con cinta naranja, General con color de la fiesta, VIP negro y dorado). Mismo diseño en pantalla (`components/entradas/EntradaCard.tsx`), PDF (`lib/pdf/ticket.ts`, pdf-lib, A6) y mail. Colores en `lib/entradas/estilos.ts`.
- **Solo se libera con pago confirmado**: `/api/ordenes/[id]/tickets` y los PDF devuelven 409 si la orden no está `aprobado`.
- **Descargas**: `/api/ordenes/[id]/pdf` (todas) y `/api/entradas/[ticketId]/pdf` (una). Botones en la pantalla de éxito y en el mail.
- **Mail reactivado** (`lib/email/notify.ts`): se manda una sola vez al aprobar (reserva con `email_sent_at`). Si falla, la compra igual se ve en pantalla.
- **Puerta**: `verifyTicket(ticketId, eventoId)` con avisos por color en el scanner: verde válido (badge VIP dorado), amarillo "ya ingresó HH:MM", rojo cancelada, naranja "es de otra fiesta" (no gasta la entrada), gris "QR no reconocido". Sonido y vibración. El scanner elige la fiesta arriba (se recuerda en el teléfono).
- **Staff sin escribir URLs**: `/staff` con teclado de PIN. El PIN decide el rol (admin → Panel + Scanner; scanner → solo Scanner). `/admin` y `/scanner` sin sesión redirigen a `/staff`. Candado discreto en el footer. PWA "JE Staff" (`public/manifest.json`, íconos generados con `node scripts/make-icons.mjs`).
- **Admin**: selector de fiesta arriba, botón "+ Nueva fiesta" (crea en borrador con un tipo General), pestañas nuevas **Entradas y precios**, **Marca** (nombre, logo, contacto globales) y en Resumen **Ventas de todas las fiestas** (vendidas/aforo, desglose por tipo, recaudado, ingresaron). Compras y Emitidas muestran el tipo; Emitidas filtra por tipo.
- **Diseño**: negro + dorado, Montserrat + Inter + Great Vibes, partículas, marquee de fechas, tarjetas con tilt (framer-motion). Mockups en Claude Design: https://claude.ai/artifact/JTqQ3y25KbpoxKcrFW9QR8
- **Datos**: los 9 flyers están en `public/flyers/<slug>.png` (copia en `imagen/flyers/`). En modo local (mock) se cargan solas las 9 fiestas con Anticipada $15.000 (cupo 150, hasta 7 días antes), General $18.000 y VIP $35.000 (cupo 40). **Precios, hora (22:00) y aforo (400) son de ejemplo.**

### Probado (modo local, navegador integrado)
- Compra 3 × VIP → con pago pendiente las entradas y el PDF dan 409 → simular pago → aparecen las 3 con QR y diseño VIP.
- PDF de VIP, Anticipada y General renderizado y revisado (3 diseños distintos).
- Puerta por API: válida → ya usada (con hora) → otra fiesta (no la gasta) → QR inválido.
- Anticipada cerrada → checkout rechazado. VIP con cupo 1 → segunda compra rechazada. Borrar tipo con ventas → bloqueado. Cambiar precio VIP → lo recaudado no cambia.
- Login `/staff` → redirige a `/admin`. Sin scroll horizontal en 375 px.
- `npm run build` y `npm run lint` sin errores.
- **No probado**: cámara del scanner (el navegador integrado no tiene cámara), Mercado Pago/Talo reales, Supabase real, envío real de mails.

## Pendiente para retomar (en este orden)

**Hoy 9 nov — pruebas**
1. ~~Service role~~ ✅ (9 nov noche). 1b. ~~Migración~~ ✅. 2. ~~Conector de Supabase~~ ✅ (`junior-eventos` ahora está en la org `paginaqr-eventos`, que es la que ve el conector).
3. ~~Primera vuelta con la base real~~ ✅ (por API y navegador). Falta: **cambiar los PINs en Admin → Seguridad** y probar la **cámara del scanner en un celular**.
4. **Mercado Pago de prueba (vos + Claude):** developers.mercadopago.com → tu app → Cuentas de prueba: crear Vendedor y Comprador (Argentina). Pegar el Access Token del Vendedor en Admin → Pagos con ambiente "Prueba" → "Probar" debe decir token de PRUEBA. Comprar en incógnito logueado como Comprador de prueba: tarjeta con titular `APRO` (aprobada) y otra con `OTHE` (rechazada). **Probar también: primero `OTHE` y, en el mismo checkout, después `APRO` → tienen que salir las entradas.** Guía y tarjetas en Admin → Pagos. Usar el checklist de Admin → Pagos.
5. **Vercel:** autorizar el equipo `maximiliano-loveras-projects` para el conector de Claude (o cargar a mano en el dashboard): `SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` de `junior-eventos`, `AUTH_SECRET` (texto largo al azar), `APP_MODE=production`, `NEXT_PUBLIC_APP_URL` (ya no hace falta `RESEND_*`: sin mail), **`ADMIN_PIN` y `SCANNER_PIN` (6+ dígitos, distintos: sin esto no se puede entrar al panel en producción)**. **Borrar `MP_ACCESS_TOKEN` de Vercel** (token productivo de junio): si queda, se usa cuando la tabla de pagos está vacía y las pruebas cobrarían de verdad. Hoy la web de junio (https://jreventos-entradas.vercel.app) apunta al proyecto pausado y muestra "No hay evento activo". Ver `docs/VERCEL-DEPLOY.md`.

**Mañana 10 nov — lanzamiento (solo si todo lo de arriba anduvo y el usuario da el OK)**
6. **Deploy y webhook real:** push de `rediseno-recepciones`, PR y merge a `main` (Vercel despliega solo). En MP → Webhooks: `https://<dominio>/api/webhook-mp`, evento Pagos. En la URL pública repetir una compra de prueba (MP sandbox) y ver en Actividad "MP … → aprobado" y la cámara del scanner en el celular.
7. **Datos reales del jefe:** precios, hora, aforo, cierre de anticipadas, **WhatsApp de contacto (hoy vacío en la base real: sin él no aparecen los botones de anular, pago sin cupo, "no encuentro mi entrada" ni el de la portada)**, texto de la política de anulación.
8. **Salir a producción:** token de MP de producción **nuevo** con ambiente Producción → "Probar" dice PRODUCCIÓN → Reiniciar ventas en cada fiesta (borra las compras de prueba; solo en borrador) → PINs fuertes → Publicar cada fiesta. El aviso MODO PRUEBA desaparece solo.
9. ~~Mail real~~: descartado (9 nov). Las entradas se entregan en pantalla + PDF.

**Después**
10. Puerta: pantalla siempre encendida en el scanner, contador real "ingresaron X de Y", ingreso manual por nombre si falla la cámara. Exportar ventas a Excel, compra mixta de tipos.

### Archivos clave del rediseño
| Tema | Archivos |
|------|----------|
| Reglas de tipos y disponibilidad | `lib/entradas/tipos.ts` |
| Diseños de entrada | `lib/entradas/estilos.ts`, `components/entradas/EntradaCard.tsx`, `lib/pdf/ticket.ts` |
| Datos (mock / Supabase) | `lib/db/index.ts`, `lib/mock/db.ts`, `lib/mock/seed.ts`, `lib/supabase/queries.ts` |
| Público | `app/page.tsx`, `app/fiesta/[slug]/page.tsx`, `components/publico/*` |
| Mis entradas (por dispositivo) | `app/mis-entradas/page.tsx`, `components/publico/MisEntradasLista.tsx`, `lib/entradas/guardadas.ts` |
| Pago y éxito | `app/comprar/pago/page.tsx`, `app/compra/exito/page.tsx`, `components/comprar/TicketQrPanel.tsx` |
| Staff | `app/staff/page.tsx`, `components/auth/PinGate.tsx`, `components/scanner/QRScanner.tsx` |
| Admin | `components/admin/AdminDashboard.tsx`, `TiposEntradaPanel.tsx`, `BrandingForm.tsx`, `VentasGenerales.tsx` |
| SQL | `supabase/schema.sql`, `supabase/migrations/2026_11_modo_prueba_proximamente_anulaciones.sql`, `supabase/seeds/recepciones_2026.sql` |
| Modo prueba | `lib/payments/modo.ts`, `lib/payments/methods.ts`, `components/publico/AvisoModoPrueba.tsx`, `components/admin/ChecklistPruebas.tsx` |
| Próximamente | `lib/entradas/tipos.ts` (`fiestaEnProximamente`, `tipoEnProximamente`, `tipoParaPublico`), `components/publico/CompraEntradas.tsx` |
| Anulaciones | `lib/entradas/anulaciones.ts`, `components/admin/AnularModal.tsx`, `app/api/admin/ordenes/[id]/anular/route.ts` |
| Sesión staff | `lib/auth/session.ts`, `lib/auth/cookies.ts`, `app/api/auth/pin/route.ts` |
| Marca | `public/marca/`, `components/publico/Marca.tsx`, `scripts/preparar-marca.mjs`, `scripts/make-icons.mjs` |
| Reservas y pago sin cupo | `lib/entradas/tipos.ts` (`reservasVigentes`), `lib/payments/reserva.ts`, `lib/payments/problemas.ts`, `app/api/admin/ordenes/[id]/devuelta`, `.../revisar` |
| Supabase de a páginas / tope por IP | `lib/supabase/paginar.ts`, `lib/limite.ts` |
| Imagen para compartir | `app/opengraph-image.tsx`, `app/fiesta/[slug]/opengraph-image.tsx`, `lib/og.ts` |
| Tests | `tests/*.test.ts`, `vitest.config.mts` |

---

# Historial anterior (junio 2026)

## Meta de junio

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
