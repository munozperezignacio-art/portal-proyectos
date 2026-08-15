ALTER TABLE public.inventario_maquinaria
  ADD COLUMN IF NOT EXISTS color_calendario TEXT;

UPDATE public.inventario_maquinaria
SET color_calendario = (ARRAY['#2563EB','#7C3AED','#DC2626','#EA580C','#059669','#0891B2','#DB2777','#4F46E5','#65A30D','#D97706'])[(((id - 1) % 10) + 1)::integer]
WHERE color_calendario IS NULL OR color_calendario = '';

ALTER TABLE public.inventario_maquinaria
  ALTER COLUMN color_calendario SET DEFAULT '#2563EB',
  ALTER COLUMN color_calendario SET NOT NULL;

ALTER TABLE public.inventario_maquinaria
  DROP CONSTRAINT IF EXISTS inventario_maquinaria_color_calendario_formato;

ALTER TABLE public.inventario_maquinaria
  ADD CONSTRAINT inventario_maquinaria_color_calendario_formato
  CHECK (color_calendario ~ '^#[0-9A-Fa-f]{6}$');;
