-- RR.HH. reutiliza el maestro transversal de centros de gestión.
-- Un mismo centro agrupa personal, remuneraciones, rendiciones, facturas,
-- bodegas y obras, sin imponer una numeración específica.

ALTER TABLE public.maestro_personal
  ADD COLUMN IF NOT EXISTS centro_gestion_id INTEGER
  REFERENCES public.facturacion_centros_gestion(id) ON DELETE SET NULL;

ALTER TABLE public.rrhh_nomina_items
  ADD COLUMN IF NOT EXISTS centro_gestion_id INTEGER
  REFERENCES public.facturacion_centros_gestion(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS maestro_personal_centro_gestion_idx
  ON public.maestro_personal(centro_gestion_id);

CREATE INDEX IF NOT EXISTS rrhh_nomina_items_centro_gestion_idx
  ON public.rrhh_nomina_items(centro_gestion_id);

-- Trabajadores asignados a una obra heredan su centro de gestión.
UPDATE public.maestro_personal p
SET centro_gestion_id = o.centro_gestion_id
FROM public.obras o
WHERE p.centro_gestion_id IS NULL
  AND o.centro_gestion_id IS NOT NULL
  AND o.empresa = p.empresa
  AND o.nombre = p.obra_nombre;

-- Compatibilidad con centros que antes fueron guardados como texto.
UPDATE public.maestro_personal p
SET centro_gestion_id = c.id
FROM public.facturacion_centros_gestion c
WHERE p.centro_gestion_id IS NULL
  AND c.empresa = p.empresa
  AND lower(btrim(c.nombre)) = lower(btrim(COALESCE(p.centro_trabajo, '')));

NOTIFY pgrst, 'reload schema';
