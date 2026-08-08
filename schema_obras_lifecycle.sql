-- Ciclo de vida y cierre trazable de obras.
-- No elimina obras: las terminadas quedan disponibles mediante el filtro de historial.
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS estado TEXT;
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS fecha_termino_real DATE;
ALTER TABLE public.obras ADD COLUMN IF NOT EXISTS motivo_cierre TEXT;

UPDATE public.obras
SET estado = 'Activa'
WHERE estado IS NULL OR btrim(estado) = '';

ALTER TABLE public.obras DROP CONSTRAINT IF EXISTS obras_estado_check;
ALTER TABLE public.obras ADD CONSTRAINT obras_estado_check
  CHECK (estado IN ('Activa', 'En pausa', 'En cierre', 'Terminada', 'Archivada'));

CREATE INDEX IF NOT EXISTS obras_empresa_estado_idx ON public.obras (empresa, estado);
