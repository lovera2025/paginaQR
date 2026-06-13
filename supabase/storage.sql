-- PaginaQR — Supabase Storage (ejecutar en SQL Editor)
-- Bucket público para logo y flyer del evento

INSERT INTO storage.buckets (id, name, public)
VALUES ('eventos', 'eventos', true)
ON CONFLICT (id) DO NOTHING;

-- Lectura pública de imágenes del evento
CREATE POLICY "eventos_public_read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'eventos');

-- Subida solo vía service_role (API server-side con admin PIN)
-- No policy de INSERT para anon/authenticated
