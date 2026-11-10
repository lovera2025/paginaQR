-- Texto que ve el público mientras la fiesta está en "Próximamente" (vacío = texto estándar).
-- Se edita en Admin → Fiesta → Venta de la fiesta.
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS mensaje_proximamente TEXT DEFAULT '';
