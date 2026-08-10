-- Flujo de caja por obra
-- Los ajustes manuales se almacenan junto al presupuesto asociado a la obra.
-- Cada elemento del JSON contiene: periodo (YYYY-MM), tipo (ingreso/egreso),
-- monto, descripción, creador y fecha de creación.
ALTER TABLE obra_presupuestos
  ADD COLUMN IF NOT EXISTS flujo_caja_ajustes JSONB NOT NULL DEFAULT '[]'::jsonb;
