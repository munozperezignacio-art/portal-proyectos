ALTER TABLE public.obra_presupuestos ADD COLUMN IF NOT EXISTS flujo_caja_ajustes JSONB NOT NULL DEFAULT '[]'::jsonb;;
