ALTER TABLE public.estados_pago_obra
  ADD COLUMN IF NOT EXISTS factura_numero TEXT,
  ADD COLUMN IF NOT EXISTS factura_fecha DATE,
  ADD COLUMN IF NOT EXISTS factura_monto NUMERIC,
  ADD COLUMN IF NOT EXISTS factura_archivo_nombre TEXT,
  ADD COLUMN IF NOT EXISTS factura_archivo_base64 TEXT,
  ADD COLUMN IF NOT EXISTS factura_estado TEXT NOT NULL DEFAULT 'Pendiente de emisión',
  ADD COLUMN IF NOT EXISTS factura_fecha_envio DATE,
  ADD COLUMN IF NOT EXISTS factura_fecha_pago DATE,
  ADD COLUMN IF NOT EXISTS factura_observaciones TEXT,
  ADD COLUMN IF NOT EXISTS factura_actualizada_en TIMESTAMPTZ;

ALTER TABLE public.estados_pago_obra
  DROP CONSTRAINT IF EXISTS estados_pago_obra_factura_estado_check;
ALTER TABLE public.estados_pago_obra
  ADD CONSTRAINT estados_pago_obra_factura_estado_check
  CHECK (factura_estado IN ('Pendiente de emisión', 'Emitida', 'Enviada al cliente', 'Recepcionada', 'Pagada', 'Rechazada', 'Anulada'));;
