-- Facturación integrada con centros de gestión, obras y Estados de Pago.
-- Los DTE de compra se consumen directamente como gasto real desde
-- facturacion_documentos, evitando duplicar información financiera.

ALTER TABLE public.facturacion_config
  ADD COLUMN IF NOT EXISTS facturacion_habilitada BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS proveedor_integracion TEXT,
  ADD COLUMN IF NOT EXISTS ultima_sincronizacion TIMESTAMPTZ;

ALTER TABLE public.facturacion_centros_gestion
  ADD COLUMN IF NOT EXISTS tipo TEXT NOT NULL DEFAULT 'Obra',
  ADD COLUMN IF NOT EXISTS activo BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE public.obras
  ADD COLUMN IF NOT EXISTS centro_gestion_id INTEGER
  REFERENCES public.facturacion_centros_gestion(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS obras_empresa_centro_gestion_uidx
  ON public.obras (empresa, centro_gestion_id)
  WHERE centro_gestion_id IS NOT NULL;

ALTER TABLE public.facturacion_documentos
  ADD COLUMN IF NOT EXISTS rut_emisor TEXT,
  ADD COLUMN IF NOT EXISTS nombre_emisor TEXT,
  ADD COLUMN IF NOT EXISTS obra_nombre TEXT,
  ADD COLUMN IF NOT EXISTS estado_pago_id BIGINT
    REFERENCES public.estados_pago_obra(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS fecha_recepcion TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS fecha_vencimiento DATE,
  ADD COLUMN IF NOT EXISTS origen TEXT NOT NULL DEFAULT 'Manual',
  ADD COLUMN IF NOT EXISTS estado_pago TEXT NOT NULL DEFAULT 'Pendiente',
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE UNIQUE INDEX IF NOT EXISTS facturacion_documentos_identidad_uidx
  ON public.facturacion_documentos (
    empresa, direccion_flujo, tipo_dte, folio,
    COALESCE(rut_emisor, ''), COALESCE(rut_receptor, '')
  );
CREATE INDEX IF NOT EXISTS facturacion_documentos_obra_idx
  ON public.facturacion_documentos (empresa, obra_nombre, fecha_emision DESC);
CREATE INDEX IF NOT EXISTS facturacion_documentos_centro_idx
  ON public.facturacion_documentos (centro_gestion_id);
CREATE INDEX IF NOT EXISTS facturacion_documentos_estado_pago_idx
  ON public.facturacion_documentos (estado_pago_id)
  WHERE estado_pago_id IS NOT NULL;

ALTER TABLE public.estados_pago_obra
  ADD COLUMN IF NOT EXISTS factura_documento_id INTEGER
  REFERENCES public.facturacion_documentos(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS estados_pago_obra_factura_documento_idx
  ON public.estados_pago_obra (factura_documento_id)
  WHERE factura_documento_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS obras_centro_gestion_idx
  ON public.obras (centro_gestion_id)
  WHERE centro_gestion_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_facturacion_relaciones()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE v_obra TEXT;
BEGIN
  IF NEW.centro_gestion_id IS NOT NULL THEN
    SELECT nombre INTO v_obra
    FROM public.obras
    WHERE empresa = NEW.empresa
      AND centro_gestion_id = NEW.centro_gestion_id
    LIMIT 1;
    NEW.obra_nombre := COALESCE(NEW.obra_nombre, v_obra);
  END IF;
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS facturacion_relaciones_before_write
  ON public.facturacion_documentos;
CREATE TRIGGER facturacion_relaciones_before_write
BEFORE INSERT OR UPDATE ON public.facturacion_documentos
FOR EACH ROW EXECUTE FUNCTION public.sync_facturacion_relaciones();

CREATE OR REPLACE FUNCTION public.sync_factura_estado_pago()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.direccion_flujo = 'Venta' AND NEW.estado_pago_id IS NOT NULL THEN
    UPDATE public.estados_pago_obra
    SET factura_documento_id = NEW.id,
        factura_numero = NEW.folio::TEXT,
        factura_fecha = NEW.fecha_emision,
        factura_monto = NEW.monto_total,
        factura_estado = CASE
          WHEN NEW.estado_pago = 'Pagada' THEN 'Pagada'
          WHEN NEW.estado_sii = 'Rechazado' THEN 'Rechazada'
          WHEN NEW.estado_sii = 'Aceptado' THEN 'Emitida'
          ELSE 'Pendiente de emisión'
        END,
        factura_fecha_pago = CASE
          WHEN NEW.estado_pago = 'Pagada' THEN CURRENT_DATE
          ELSE factura_fecha_pago
        END,
        factura_actualizada_en = NOW()
    WHERE id = NEW.estado_pago_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS factura_estado_pago_after_write
  ON public.facturacion_documentos;
CREATE TRIGGER factura_estado_pago_after_write
AFTER INSERT OR UPDATE ON public.facturacion_documentos
FOR EACH ROW EXECUTE FUNCTION public.sync_factura_estado_pago();

-- Las obras creadas después de habilitar facturación reciben un centro propio.
CREATE OR REPLACE FUNCTION public.ensure_obra_centro_gestion()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_habilitada BOOLEAN;
  v_centro_id INTEGER;
  v_codigo TEXT;
BEGIN
  SELECT COALESCE(facturacion_habilitada, FALSE)
    INTO v_habilitada
  FROM public.facturacion_config
  WHERE empresa = NEW.empresa;

  IF v_habilitada AND NEW.centro_gestion_id IS NULL THEN
    SELECT LPAD((COALESCE(MAX(CASE WHEN codigo ~ '^[0-9]+$' THEN codigo::BIGINT END), 0) + 1)::TEXT, 3, '0')
      INTO v_codigo
    FROM public.facturacion_centros_gestion
    WHERE empresa = NEW.empresa;

    INSERT INTO public.facturacion_centros_gestion
      (empresa, codigo, nombre, descripcion, tipo, activo)
    VALUES
      (NEW.empresa, v_codigo, NEW.nombre, 'Centro creado automáticamente para la obra', 'Obra', TRUE)
    RETURNING id INTO v_centro_id;

    UPDATE public.obras
    SET centro_gestion_id = v_centro_id
    WHERE id = NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS obra_centro_gestion_after_insert ON public.obras;
CREATE TRIGGER obra_centro_gestion_after_insert
AFTER INSERT ON public.obras
FOR EACH ROW EXECUTE FUNCTION public.ensure_obra_centro_gestion();
