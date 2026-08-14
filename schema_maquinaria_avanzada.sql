-- Configuración avanzada: múltiples planes preventivos y costo operacional por equipo.
ALTER TABLE public.inventario_maquinaria
  ADD COLUMN IF NOT EXISTS mantenimiento_intervalo NUMERIC,
  ADD COLUMN IF NOT EXISTS mantenimiento_unidad TEXT DEFAULT 'horas',
  ADD COLUMN IF NOT EXISTS mantenimiento_ultima_lectura NUMERIC,
  ADD COLUMN IF NOT EXISTS mantenimiento_ultima_fecha DATE,
  ADD COLUMN IF NOT EXISTS mantenimiento_descripcion TEXT,
  ADD COLUMN IF NOT EXISTS planes_mantencion JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS costo_interno NUMERIC NOT NULL DEFAULT 0 CHECK (costo_interno >= 0),
  ADD COLUMN IF NOT EXISTS unidad_costo_interno TEXT NOT NULL DEFAULT '$/día',
  ADD COLUMN IF NOT EXISTS tipo_condicion_minima TEXT NOT NULL DEFAULT 'sin_minimo',
  ADD COLUMN IF NOT EXISTS cantidad_minima NUMERIC NOT NULL DEFAULT 0 CHECK (cantidad_minima >= 0),
  ADD COLUMN IF NOT EXISTS modalidad_dias TEXT NOT NULL DEFAULT 'laborales';
