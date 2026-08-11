-- Datos corporativos mínimos requeridos por documentos, correos y flujos de Obraxis.
ALTER TABLE public.config_empresa
  ADD COLUMN IF NOT EXISTS giro TEXT,
  ADD COLUMN IF NOT EXISTS comuna TEXT,
  ADD COLUMN IF NOT EXISTS telefono TEXT,
  ADD COLUMN IF NOT EXISTS pais TEXT NOT NULL DEFAULT 'Chile',
  ADD COLUMN IF NOT EXISTS zona_horaria TEXT NOT NULL DEFAULT 'America/Santiago',
  ADD COLUMN IF NOT EXISTS moneda TEXT NOT NULL DEFAULT 'CLP',
  ADD COLUMN IF NOT EXISTS configuracion_completa BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

UPDATE public.config_empresa
SET configuracion_completa =
  NULLIF(BTRIM(razon_social), '') IS NOT NULL
  AND NULLIF(BTRIM(rut), '') IS NOT NULL
  AND NULLIF(BTRIM(direccion), '') IS NOT NULL
  AND NULLIF(BTRIM(administrador), '') IS NOT NULL
  AND NULLIF(BTRIM(correo_administrador), '') IS NOT NULL
  AND NULLIF(BTRIM(modulos_activos), '') IS NOT NULL,
  updated_at = NOW();

