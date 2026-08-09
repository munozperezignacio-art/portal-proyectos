-- Configuración avanzada: múltiples planes preventivos por equipo.
ALTER TABLE public.inventario_maquinaria
  ADD COLUMN IF NOT EXISTS mantenimiento_intervalo NUMERIC,
  ADD COLUMN IF NOT EXISTS mantenimiento_unidad TEXT DEFAULT 'horas',
  ADD COLUMN IF NOT EXISTS mantenimiento_ultima_lectura NUMERIC,
  ADD COLUMN IF NOT EXISTS mantenimiento_ultima_fecha DATE,
  ADD COLUMN IF NOT EXISTS mantenimiento_descripcion TEXT,
  ADD COLUMN IF NOT EXISTS cuota_mensual NUMERIC,
  ADD COLUMN IF NOT EXISTS cuotas_totales INTEGER,
  ADD COLUMN IF NOT EXISTS cuotas_pagadas INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fecha_inicio_cuota DATE,
  ADD COLUMN IF NOT EXISTS planes_mantencion JSONB NOT NULL DEFAULT '[]'::jsonb;
