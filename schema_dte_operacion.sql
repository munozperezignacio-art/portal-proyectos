-- Operación DTE Obraxis: dominio tributario independiente del módulo legado.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.dte_configuracion (
  empresa TEXT PRIMARY KEY,
  habilitado BOOLEAN NOT NULL DEFAULT FALSE,
  ambiente TEXT NOT NULL DEFAULT 'Certificación' CHECK (ambiente IN ('Certificación','Producción')),
  rut_emisor TEXT, razon_social TEXT, giro TEXT, direccion TEXT, comuna TEXT,
  codigo_actividad TEXT, resolucion_numero TEXT, resolucion_fecha DATE,
  email_intercambio TEXT, proveedor_dte TEXT, modalidad TEXT NOT NULL DEFAULT 'Proveedor certificado',
  certificado_estado TEXT NOT NULL DEFAULT 'No configurado', ultima_sincronizacion TIMESTAMPTZ,
  creado_por TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.dte_documentos_operacion (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), empresa TEXT NOT NULL,
  direccion TEXT NOT NULL CHECK (direccion IN ('Emitido','Recibido')),
  tipo_dte INTEGER NOT NULL, tipo_nombre TEXT NOT NULL, folio BIGINT,
  fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE, fecha_recepcion TIMESTAMPTZ,
  fecha_vencimiento DATE, rut_contraparte TEXT NOT NULL, razon_social_contraparte TEXT NOT NULL,
  giro_contraparte TEXT, direccion_contraparte TEXT, comuna_contraparte TEXT, email_contraparte TEXT,
  monto_neto NUMERIC(16,2) NOT NULL DEFAULT 0, monto_exento NUMERIC(16,2) NOT NULL DEFAULT 0,
  tasa_iva NUMERIC(5,2) NOT NULL DEFAULT 19, monto_iva NUMERIC(16,2) NOT NULL DEFAULT 0,
  monto_total NUMERIC(16,2) NOT NULL DEFAULT 0,
  estado TEXT NOT NULL DEFAULT 'Borrador', estado_sii TEXT NOT NULL DEFAULT 'No enviado',
  estado_comercial TEXT NOT NULL DEFAULT 'Pendiente', estado_pago TEXT NOT NULL DEFAULT 'Pendiente',
  track_id TEXT, centro_gestion_id INTEGER REFERENCES public.facturacion_centros_gestion(id) ON DELETE SET NULL,
  obra_nombre TEXT, estado_pago_id BIGINT REFERENCES public.estados_pago_obra(id) ON DELETE SET NULL,
  documento_origen TEXT, observaciones TEXT, xml_url TEXT, pdf_url TEXT,
  creado_por TEXT, revisado_por TEXT, aprobado_por TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (empresa, direccion, tipo_dte, folio, rut_contraparte)
);

CREATE TABLE IF NOT EXISTS public.dte_documento_items (
  id BIGSERIAL PRIMARY KEY, documento_id UUID NOT NULL REFERENCES public.dte_documentos_operacion(id) ON DELETE CASCADE,
  linea INTEGER NOT NULL, codigo TEXT, descripcion TEXT NOT NULL, cantidad NUMERIC(14,4) NOT NULL DEFAULT 1,
  unidad TEXT, precio_unitario NUMERIC(16,4) NOT NULL DEFAULT 0, descuento NUMERIC(16,2) NOT NULL DEFAULT 0,
  exento BOOLEAN NOT NULL DEFAULT FALSE, total_linea NUMERIC(16,2) NOT NULL DEFAULT 0,
  UNIQUE(documento_id, linea)
);

CREATE TABLE IF NOT EXISTS public.dte_documento_referencias (
  id BIGSERIAL PRIMARY KEY, documento_id UUID NOT NULL REFERENCES public.dte_documentos_operacion(id) ON DELETE CASCADE,
  tipo_documento INTEGER NOT NULL, folio TEXT NOT NULL, fecha DATE, codigo_referencia TEXT, razon TEXT
);

CREATE TABLE IF NOT EXISTS public.dte_folios (
  id BIGSERIAL PRIMARY KEY, empresa TEXT NOT NULL, tipo_dte INTEGER NOT NULL, desde BIGINT NOT NULL, hasta BIGINT NOT NULL,
  siguiente BIGINT NOT NULL, estado TEXT NOT NULL DEFAULT 'Disponible', ambiente TEXT NOT NULL DEFAULT 'Certificación',
  fecha_autorizacion DATE, archivo_nombre TEXT, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (desde <= siguiente AND siguiente <= hasta + 1), UNIQUE(empresa, tipo_dte, desde, hasta)
);

CREATE TABLE IF NOT EXISTS public.dte_eventos (
  id BIGSERIAL PRIMARY KEY, documento_id UUID NOT NULL REFERENCES public.dte_documentos_operacion(id) ON DELETE CASCADE,
  empresa TEXT NOT NULL, accion TEXT NOT NULL, estado_origen TEXT, estado_destino TEXT,
  actor TEXT, detalle TEXT, metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dte_operacion_empresa_idx ON public.dte_documentos_operacion(empresa, direccion, fecha_emision DESC);
CREATE INDEX IF NOT EXISTS dte_operacion_estado_idx ON public.dte_documentos_operacion(empresa, estado, estado_sii);
CREATE INDEX IF NOT EXISTS dte_operacion_centro_idx ON public.dte_documentos_operacion(centro_gestion_id);
CREATE INDEX IF NOT EXISTS dte_operacion_ep_idx ON public.dte_documentos_operacion(estado_pago_id) WHERE estado_pago_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS dte_items_documento_idx ON public.dte_documento_items(documento_id);
CREATE INDEX IF NOT EXISTS dte_referencias_documento_idx ON public.dte_documento_referencias(documento_id);
CREATE INDEX IF NOT EXISTS dte_eventos_documento_idx ON public.dte_eventos(documento_id, created_at DESC);

ALTER TABLE public.dte_configuracion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dte_documentos_operacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dte_documento_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dte_documento_referencias ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dte_folios ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dte_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS dte_config_empresa ON public.dte_configuracion;
CREATE POLICY dte_config_empresa ON public.dte_configuracion FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE lower(u.correo)=lower(auth.jwt()->>'email') AND u.empresa=dte_configuracion.empresa))
WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE lower(u.correo)=lower(auth.jwt()->>'email') AND u.empresa=dte_configuracion.empresa));
DROP POLICY IF EXISTS dte_documentos_empresa ON public.dte_documentos_operacion;
CREATE POLICY dte_documentos_empresa ON public.dte_documentos_operacion FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE lower(u.correo)=lower(auth.jwt()->>'email') AND u.empresa=dte_documentos_operacion.empresa))
WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE lower(u.correo)=lower(auth.jwt()->>'email') AND u.empresa=dte_documentos_operacion.empresa));
DROP POLICY IF EXISTS dte_items_empresa ON public.dte_documento_items;
CREATE POLICY dte_items_empresa ON public.dte_documento_items FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.dte_documentos_operacion d JOIN public.usuarios u ON u.empresa=d.empresa WHERE d.id=dte_documento_items.documento_id AND lower(u.correo)=lower(auth.jwt()->>'email')))
WITH CHECK (EXISTS (SELECT 1 FROM public.dte_documentos_operacion d JOIN public.usuarios u ON u.empresa=d.empresa WHERE d.id=dte_documento_items.documento_id AND lower(u.correo)=lower(auth.jwt()->>'email')));
DROP POLICY IF EXISTS dte_referencias_empresa ON public.dte_documento_referencias;
CREATE POLICY dte_referencias_empresa ON public.dte_documento_referencias FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.dte_documentos_operacion d JOIN public.usuarios u ON u.empresa=d.empresa WHERE d.id=dte_documento_referencias.documento_id AND lower(u.correo)=lower(auth.jwt()->>'email')))
WITH CHECK (EXISTS (SELECT 1 FROM public.dte_documentos_operacion d JOIN public.usuarios u ON u.empresa=d.empresa WHERE d.id=dte_documento_referencias.documento_id AND lower(u.correo)=lower(auth.jwt()->>'email')));
DROP POLICY IF EXISTS dte_folios_empresa ON public.dte_folios;
CREATE POLICY dte_folios_empresa ON public.dte_folios FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE lower(u.correo)=lower(auth.jwt()->>'email') AND u.empresa=dte_folios.empresa))
WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE lower(u.correo)=lower(auth.jwt()->>'email') AND u.empresa=dte_folios.empresa));
DROP POLICY IF EXISTS dte_eventos_empresa ON public.dte_eventos;
CREATE POLICY dte_eventos_empresa ON public.dte_eventos FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE lower(u.correo)=lower(auth.jwt()->>'email') AND u.empresa=dte_eventos.empresa))
WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE lower(u.correo)=lower(auth.jwt()->>'email') AND u.empresa=dte_eventos.empresa));

GRANT SELECT,INSERT,UPDATE,DELETE ON public.dte_configuracion, public.dte_documentos_operacion, public.dte_documento_items, public.dte_documento_referencias, public.dte_folios, public.dte_eventos TO authenticated;
GRANT USAGE,SELECT ON SEQUENCE public.dte_documento_items_id_seq, public.dte_documento_referencias_id_seq, public.dte_folios_id_seq, public.dte_eventos_id_seq TO authenticated;
REVOKE ALL ON public.dte_configuracion, public.dte_documentos_operacion, public.dte_documento_items, public.dte_documento_referencias, public.dte_folios, public.dte_eventos FROM anon;

CREATE OR REPLACE FUNCTION public.asignar_folio_dte(p_documento UUID)
RETURNS BIGINT LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_empresa TEXT; v_tipo INTEGER; v_actual BIGINT; v_rango BIGINT; v_folio BIGINT;
BEGIN
  SELECT empresa,tipo_dte,folio INTO v_empresa,v_tipo,v_actual FROM public.dte_documentos_operacion WHERE id=p_documento AND direccion='Emitido' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Documento emitido no encontrado'; END IF;
  IF v_actual IS NOT NULL THEN RETURN v_actual; END IF;
  SELECT id,siguiente INTO v_rango,v_folio FROM public.dte_folios WHERE empresa=v_empresa AND tipo_dte=v_tipo AND estado='Disponible' AND siguiente<=hasta ORDER BY desde FOR UPDATE SKIP LOCKED LIMIT 1;
  IF v_rango IS NULL THEN RAISE EXCEPTION 'No existen folios disponibles para el tipo DTE %',v_tipo; END IF;
  UPDATE public.dte_folios SET siguiente=v_folio+1,estado=CASE WHEN v_folio+1>hasta THEN 'Agotado' ELSE 'Disponible' END WHERE id=v_rango;
  UPDATE public.dte_documentos_operacion SET folio=v_folio,updated_at=NOW() WHERE id=p_documento;
  RETURN v_folio;
END; $$;
REVOKE ALL ON FUNCTION public.asignar_folio_dte(UUID) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.asignar_folio_dte(UUID) TO authenticated;
