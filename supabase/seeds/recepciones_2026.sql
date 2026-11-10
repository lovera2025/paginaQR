-- Carga las 9 recepciones de diciembre 2026 (flyers en /public/flyers).
-- Quedan en BORRADOR: revisá precios, hora y cupos en Admin → Entradas
-- y después tocá "Publicar" en cada una.
-- Requiere haber corrido antes supabase/migrations/multi_evento.sql.

WITH data (slug, nombre, dia, lugar, dj, fondo, acento) AS (
  VALUES
    ('pinaroli', 'Escuela Técnica Arq. Francisco Pinaroli', DATE '2026-12-04', 'Predio Costa Surubí', 'Lautaro Gorostegui', '#0f1f0c', '#d4a853'),
    ('la-rotonda', 'Escuela Parroquial "La Rotonda"', DATE '2026-12-06', 'Predio Costa Surubí', 'Tomy Alegre', '#0e1a2b', '#d4a853'),
    ('guemes-de-tejada', 'Colegio Secundario "Magdalena Güemes de Tejada"', DATE '2026-12-07', 'Predio Costa Surubí', 'Tomy Alegre', '#0f1f0c', '#e0953c'),
    ('gregoria-morales', 'Colegio Secundario "Gregoria Morales"', DATE '2026-12-12', 'Predio Costa Surubí', 'Facu Portalea', '#2a0f0b', '#d4a853'),
    ('buena-vista', 'Colegio Secundario de Buena Vista', DATE '2026-12-12', 'Complejo La Conquista', 'Augusto Aguirre', '#0e1a2b', '#c0392b'),
    ('torrent', 'Colegio Secundario "Dr. Juan Eusebio Torrent"', DATE '2026-12-18', 'Predio Costa Surubí', 'Lautaro Pasetto', '#0a0a0a', '#c0392b'),
    ('sagrado-corazon', 'Colegio Secundario Sagrado Corazón de Jesús', DATE '2026-12-19', 'Predio Costa Surubí', 'Facu Portalea', '#2a0f0b', '#d4a853'),
    ('puerto-viejo', 'Colegio Secundario Puerto Viejo', DATE '2026-12-19', 'Predio Negri', 'Cu3rvo', '#0b1a12', '#d4a853'),
    ('mariano-loza', 'Escuela Normal Mariano I. Loza', DATE '2026-12-26', 'Predio Costa Surubí', 'Facu Portalea', '#0e1a2b', '#d4a853')
)
INSERT INTO eventos (
  id, slug, nombre, subtitulo, dj, fecha, precio, capacidad, activo, estado,
  logo_url, flyer_url, color_primario, color_secundario, descripcion, lugar,
  maps_url, contacto_whatsapp, contacto_email, contacto_instagram,
  texto_footer, organizador_nombre, mensaje_postergado
)
SELECT
  'rec-' || slug, slug, nombre, 'Recepción baile · Egresados Promo 2026', dj,
  (dia + TIME '22:00') AT TIME ZONE 'America/Argentina/Buenos_Aires',
  18000, 400, true, 'borrador',
  '', '/flyers/' || slug || '.png', acento, fondo,
  'Recepción de egresados Promo 2026. Apertura 22:00 hs con DJ ' || dj || ' toda la noche. Entrada personal con QR, válida una sola vez.',
  lugar, '', '', '', 'junior_eventos_ok',
  'Entradas personales con QR. Cada QR vale una sola vez.', 'Junior Eventos', ''
FROM data
ON CONFLICT (id) DO NOTHING;

-- Tres tipos por fiesta:
--   Anticipada a la venta hasta 7 días antes;
--   General "Próximamente": abre sola cuando cierra la anticipada (cuenta regresiva);
--   VIP "Próximamente, fecha a confirmar" (se abre desde el admin).
-- Requiere también supabase/migrations/2026_11_modo_prueba_proximamente_anulaciones.sql.
INSERT INTO tipos_entrada (evento_id, nombre, descripcion, beneficios, precio, cupo, venta_desde, venta_hasta, estilo, orden, proximamente)
SELECT e.id, t.nombre, t.descripcion, t.beneficios, t.precio, t.cupo,
       CASE WHEN t.estilo = 'general'
            THEN ((e.fecha AT TIME ZONE 'America/Argentina/Buenos_Aires')::date - 7 + TIME '23:59')
                 AT TIME ZONE 'America/Argentina/Buenos_Aires'
       END,
       CASE WHEN t.estilo = 'anticipada'
            THEN ((e.fecha AT TIME ZONE 'America/Argentina/Buenos_Aires')::date - 7 + TIME '23:59')
                 AT TIME ZONE 'America/Argentina/Buenos_Aires'
       END,
       t.estilo, t.orden, t.proximamente
FROM eventos e
CROSS JOIN (
  VALUES
    ('Anticipada', 'Mismo acceso que la General, a precio promo.', ARRAY[]::TEXT[], 15000, 150, 'anticipada', 0, false),
    ('General', 'Acceso a la fiesta toda la noche.', ARRAY[]::TEXT[], 18000, NULL::INT, 'general', 1, true),
    ('VIP', 'Sector VIP con barra exclusiva.', ARRAY['Sector VIP', 'Barra exclusiva', 'Ingreso preferencial'], 35000, 40, 'vip', 2, true)
) AS t (nombre, descripcion, beneficios, precio, cupo, estilo, orden, proximamente)
WHERE e.id LIKE 'rec-%'
  AND NOT EXISTS (SELECT 1 FROM tipos_entrada x WHERE x.evento_id = e.id);
