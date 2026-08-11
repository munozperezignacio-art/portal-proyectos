-- Rendiciones de gastos integradas con centros de gestión e imágenes privadas.
CREATE TABLE IF NOT EXISTS public.gastos_rendiciones (
  id BIGSERIAL PRIMARY KEY,
  empresa TEXT NOT NULL,
  codigo TEXT UNIQUE,
  titulo TEXT NOT NULL,
  tipo TEXT NOT NULL DEFAULT 'Reembolso' CHECK (tipo IN ('Reembolso','Caja chica','Viático')),
  centro_gestion_id INTEGER REFERENCES public.facturacion_centros_gestion(id) ON DELETE RESTRICT,
  rendidor_nombre TEXT NOT NULL,
  rendidor_email TEXT,
  rendidor_rut TEXT,
  estado TEXT NOT NULL DEFAULT 'Borrador' CHECK (estado IN ('Borrador','En revisión','Observado','Aprobado','Rechazado','Pagado')),
  total NUMERIC(18,2) NOT NULL DEFAULT 0,
  observaciones TEXT,
  revisor_nombre TEXT,
  revisor_email TEXT,
  revisado_en TIMESTAMPTZ,
  fecha_desde DATE,
  fecha_hasta DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.gastos_rendicion_items (
  id BIGSERIAL PRIMARY KEY,
  empresa TEXT NOT NULL,
  rendicion_id BIGINT NOT NULL REFERENCES public.gastos_rendiciones(id) ON DELETE CASCADE,
  centro_gestion_id INTEGER NOT NULL REFERENCES public.facturacion_centros_gestion(id) ON DELETE RESTRICT,
  obra_nombre TEXT,
  fecha_documento DATE NOT NULL,
  tipo_documento TEXT NOT NULL DEFAULT 'Boleta',
  folio TEXT,
  proveedor TEXT NOT NULL,
  rut_proveedor TEXT,
  categoria TEXT NOT NULL DEFAULT 'Otros',
  descripcion TEXT,
  monto_neto NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (monto_neto >= 0),
  monto_iva NUMERIC(18,2) NOT NULL DEFAULT 0 CHECK (monto_iva >= 0),
  monto_total NUMERIC(18,2) NOT NULL CHECK (monto_total > 0),
  imagen_path TEXT,
  lectura_ia JSONB,
  confianza_ia NUMERIC(5,2),
  confirmado BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.gastos_rendicion_acciones (
  id BIGSERIAL PRIMARY KEY,
  empresa TEXT NOT NULL,
  rendicion_id BIGINT NOT NULL REFERENCES public.gastos_rendiciones(id) ON DELETE CASCADE,
  accion TEXT NOT NULL,
  estado_resultante TEXT NOT NULL,
  actor_nombre TEXT NOT NULL,
  actor_email TEXT,
  comentario TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS gastos_rendiciones_empresa_estado_idx ON public.gastos_rendiciones (empresa, estado, created_at DESC);
CREATE INDEX IF NOT EXISTS gastos_rendiciones_centro_idx ON public.gastos_rendiciones (centro_gestion_id) WHERE centro_gestion_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS gastos_items_rendicion_idx ON public.gastos_rendicion_items (rendicion_id);
CREATE INDEX IF NOT EXISTS gastos_items_centro_idx ON public.gastos_rendicion_items (centro_gestion_id);
CREATE INDEX IF NOT EXISTS gastos_acciones_rendicion_idx ON public.gastos_rendicion_acciones (rendicion_id, created_at);

CREATE OR REPLACE FUNCTION public.sync_rendicion_gasto()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v_rendicion BIGINT; v_empresa TEXT; v_obra TEXT;
BEGIN
  IF TG_TABLE_NAME = 'gastos_rendicion_items' THEN
    v_rendicion := COALESCE(NEW.rendicion_id, OLD.rendicion_id);
    IF TG_OP <> 'DELETE' THEN
      SELECT empresa INTO v_empresa FROM public.gastos_rendiciones WHERE id=NEW.rendicion_id;
      IF v_empresa IS NULL OR v_empresa <> NEW.empresa THEN RAISE EXCEPTION 'El gasto debe pertenecer a la empresa de la rendición'; END IF;
      SELECT o.nombre INTO v_obra FROM public.obras o WHERE o.empresa=NEW.empresa AND o.centro_gestion_id=NEW.centro_gestion_id LIMIT 1;
      NEW.obra_nombre := v_obra;
      RETURN NEW;
    END IF;
  END IF;
  RETURN COALESCE(NEW,OLD);
END $$;

DROP TRIGGER IF EXISTS gasto_item_validate_before ON public.gastos_rendicion_items;
CREATE TRIGGER gasto_item_validate_before BEFORE INSERT OR UPDATE ON public.gastos_rendicion_items FOR EACH ROW EXECUTE FUNCTION public.sync_rendicion_gasto();

CREATE OR REPLACE FUNCTION public.recalcular_total_rendicion()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path=public AS $$
DECLARE v_id BIGINT;
BEGIN
  v_id := COALESCE(NEW.rendicion_id,OLD.rendicion_id);
  UPDATE public.gastos_rendiciones SET total=(SELECT COALESCE(SUM(monto_total),0) FROM public.gastos_rendicion_items WHERE rendicion_id=v_id), updated_at=NOW() WHERE id=v_id;
  RETURN COALESCE(NEW,OLD);
END $$;
DROP TRIGGER IF EXISTS gasto_item_total_after ON public.gastos_rendicion_items;
CREATE TRIGGER gasto_item_total_after AFTER INSERT OR UPDATE OR DELETE ON public.gastos_rendicion_items FOR EACH ROW EXECUTE FUNCTION public.recalcular_total_rendicion();

ALTER TABLE public.gastos_rendiciones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos_rendicion_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gastos_rendicion_acciones ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gastos_rendiciones_empresa ON public.gastos_rendiciones;
CREATE POLICY gastos_rendiciones_empresa ON public.gastos_rendiciones FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE LOWER(u.correo)=LOWER((SELECT auth.jwt())->>'email') AND (u.empresa=gastos_rendiciones.empresa OR (LOWER(u.empresa)='obraxis' AND LOWER(COALESCE(u.rol,'')) LIKE '%admin%'))))
WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE LOWER(u.correo)=LOWER((SELECT auth.jwt())->>'email') AND (u.empresa=gastos_rendiciones.empresa OR (LOWER(u.empresa)='obraxis' AND LOWER(COALESCE(u.rol,'')) LIKE '%admin%'))));
DROP POLICY IF EXISTS gastos_items_empresa ON public.gastos_rendicion_items;
CREATE POLICY gastos_items_empresa ON public.gastos_rendicion_items FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE LOWER(u.correo)=LOWER((SELECT auth.jwt())->>'email') AND (u.empresa=gastos_rendicion_items.empresa OR (LOWER(u.empresa)='obraxis' AND LOWER(COALESCE(u.rol,'')) LIKE '%admin%'))))
WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE LOWER(u.correo)=LOWER((SELECT auth.jwt())->>'email') AND (u.empresa=gastos_rendicion_items.empresa OR (LOWER(u.empresa)='obraxis' AND LOWER(COALESCE(u.rol,'')) LIKE '%admin%'))));
DROP POLICY IF EXISTS gastos_acciones_empresa ON public.gastos_rendicion_acciones;
CREATE POLICY gastos_acciones_empresa ON public.gastos_rendicion_acciones FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE LOWER(u.correo)=LOWER((SELECT auth.jwt())->>'email') AND (u.empresa=gastos_rendicion_acciones.empresa OR (LOWER(u.empresa)='obraxis' AND LOWER(COALESCE(u.rol,'')) LIKE '%admin%'))))
WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE LOWER(u.correo)=LOWER((SELECT auth.jwt())->>'email') AND (u.empresa=gastos_rendicion_acciones.empresa OR (LOWER(u.empresa)='obraxis' AND LOWER(COALESCE(u.rol,'')) LIKE '%admin%'))));

GRANT SELECT,INSERT,UPDATE,DELETE ON public.gastos_rendiciones,public.gastos_rendicion_items,public.gastos_rendicion_acciones TO authenticated;
GRANT USAGE,SELECT ON SEQUENCE public.gastos_rendiciones_id_seq,public.gastos_rendicion_items_id_seq,public.gastos_rendicion_acciones_id_seq TO authenticated;

INSERT INTO storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
VALUES ('rendiciones','rendiciones',FALSE,10485760,ARRAY['image/jpeg','image/png','image/webp','application/pdf'])
ON CONFLICT (id) DO UPDATE SET public=FALSE,file_size_limit=10485760,allowed_mime_types=EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS rendiciones_storage_select ON storage.objects;
CREATE POLICY rendiciones_storage_select ON storage.objects FOR SELECT TO authenticated USING (bucket_id='rendiciones' AND EXISTS (SELECT 1 FROM public.usuarios u WHERE LOWER(u.correo)=LOWER((SELECT auth.jwt())->>'email') AND (u.empresa=(storage.foldername(name))[1] OR (LOWER(u.empresa)='obraxis' AND LOWER(COALESCE(u.rol,'')) LIKE '%admin%'))));
DROP POLICY IF EXISTS rendiciones_storage_insert ON storage.objects;
CREATE POLICY rendiciones_storage_insert ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id='rendiciones' AND EXISTS (SELECT 1 FROM public.usuarios u WHERE LOWER(u.correo)=LOWER((SELECT auth.jwt())->>'email') AND (u.empresa=(storage.foldername(name))[1] OR (LOWER(u.empresa)='obraxis' AND LOWER(COALESCE(u.rol,'')) LIKE '%admin%'))));
DROP POLICY IF EXISTS rendiciones_storage_delete ON storage.objects;
CREATE POLICY rendiciones_storage_delete ON storage.objects FOR DELETE TO authenticated USING (bucket_id='rendiciones' AND EXISTS (SELECT 1 FROM public.usuarios u WHERE LOWER(u.correo)=LOWER((SELECT auth.jwt())->>'email') AND (u.empresa=(storage.foldername(name))[1] OR (LOWER(u.empresa)='obraxis' AND LOWER(COALESCE(u.rol,'')) LIKE '%admin%'))));
