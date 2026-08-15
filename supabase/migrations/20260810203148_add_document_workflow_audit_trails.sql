ALTER TABLE public.libro_obra_digital
  ADD COLUMN IF NOT EXISTS flujo_estado TEXT NOT NULL DEFAULT 'Emitido',
  ADD COLUMN IF NOT EXISTS trazabilidad JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS autorizador_nombre TEXT,
  ADD COLUMN IF NOT EXISTS token_cliente TEXT UNIQUE,
  ADD COLUMN IF NOT EXISTS clave_cliente_hash TEXT;
ALTER TABLE public.libro_obra_digital DROP CONSTRAINT IF EXISTS libro_obra_digital_flujo_estado_check;
ALTER TABLE public.libro_obra_digital ADD CONSTRAINT libro_obra_digital_flujo_estado_check CHECK (flujo_estado IN ('Emitido', 'Autorizado', 'Enviado al cliente', 'Observado por cliente', 'Aceptado por cliente', 'Aceptado con observaciones', 'Cerrado'));

ALTER TABLE public.calidad_rdi ADD COLUMN IF NOT EXISTS trazabilidad JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.calidad_recepciones_partidas ADD COLUMN IF NOT EXISTS trazabilidad JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.estados_pago_obra ADD COLUMN IF NOT EXISTS trazabilidad JSONB NOT NULL DEFAULT '[]'::jsonb;;
