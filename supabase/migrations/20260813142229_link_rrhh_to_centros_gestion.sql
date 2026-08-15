ALTER TABLE public.maestro_personal
  ADD COLUMN IF NOT EXISTS centro_gestion_id INTEGER REFERENCES public.facturacion_centros_gestion(id) ON DELETE SET NULL;
ALTER TABLE public.rrhh_nomina_items
  ADD COLUMN IF NOT EXISTS centro_gestion_id INTEGER REFERENCES public.facturacion_centros_gestion(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS maestro_personal_centro_gestion_idx ON public.maestro_personal(centro_gestion_id);
CREATE INDEX IF NOT EXISTS rrhh_nomina_items_centro_gestion_idx ON public.rrhh_nomina_items(centro_gestion_id);

UPDATE public.maestro_personal p
SET centro_gestion_id = o.centro_gestion_id
FROM public.obras o
WHERE p.centro_gestion_id IS NULL
  AND o.centro_gestion_id IS NOT NULL
  AND o.empresa = p.empresa
  AND o.nombre = p.obra_nombre;

UPDATE public.maestro_personal p
SET centro_gestion_id = c.id
FROM public.facturacion_centros_gestion c
WHERE p.centro_gestion_id IS NULL
  AND c.empresa = p.empresa
  AND lower(btrim(c.nombre)) = lower(btrim(COALESCE(p.centro_trabajo, '')));

NOTIFY pgrst, 'reload schema';;
