-- Mensaje editable cuando las ventas están pausadas (landing + /comprar)
ALTER TABLE eventos ADD COLUMN IF NOT EXISTS mensaje_postergado TEXT DEFAULT '';
