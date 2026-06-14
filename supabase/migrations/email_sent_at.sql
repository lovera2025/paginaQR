-- Migración: idempotencia de email de confirmación
-- Ejecutar en Supabase SQL Editor si el proyecto ya existía antes de jun 2026

ALTER TABLE ordenes ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;
