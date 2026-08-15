-- Conciliación documental de compras y validación humana de inventario.
CREATE EXTENSION IF NOT EXISTS pgcrypto;
ALTER TABLE public.bodega_movimientos
  ADD COLUMN IF NOT EXISTS estado_validacion TEXT NOT NULL DEFAULT 'Validado' CHECK (estado_validacion IN ('Pendiente','Validado','Rechazado')),
  ADD COLUMN IF NOT EXISTS validado_por TEXT,
  ADD COLUMN IF NOT EXISTS validado_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS bodega_movimientos_validacion_idx ON public.bodega_movimientos (empresa, estado_validacion, fecha DESC);
CREATE TABLE IF NOT EXISTS public.compras_conciliaciones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), empresa TEXT NOT NULL, numero_oc TEXT, proveedor_rut TEXT, proveedor_nombre TEXT,
  obra_nombre TEXT, centro_gestion_id INTEGER REFERENCES public.facturacion_centros_gestion(id) ON DELETE SET NULL,
  guia_id UUID REFERENCES public.dte_documentos_operacion(id) ON DELETE SET NULL,
  factura_id UUID REFERENCES public.dte_documentos_operacion(id) ON DELETE SET NULL,
  nota_credito_id UUID REFERENCES public.dte_documentos_operacion(id) ON DELETE SET NULL,
  monto_oc NUMERIC(16,2) NOT NULL DEFAULT 0, monto_recepcion NUMERIC(16,2) NOT NULL DEFAULT 0,
  monto_factura NUMERIC(16,2) NOT NULL DEFAULT 0, monto_nota_credito NUMERIC(16,2) NOT NULL DEFAULT 0,
  diferencia_monto NUMERIC(16,2) NOT NULL DEFAULT 0, diferencia_cantidad NUMERIC(16,4) NOT NULL DEFAULT 0,
  alertas JSONB NOT NULL DEFAULT '[]'::jsonb,
  estado TEXT NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente','Con diferencias','Conciliado','Rechazado')),
  revisado_por TEXT, revisado_at TIMESTAMPTZ, observaciones TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS compras_conciliaciones_empresa_idx ON public.compras_conciliaciones (empresa, estado, created_at DESC);
ALTER TABLE public.compras_conciliaciones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS compras_conciliaciones_empresa ON public.compras_conciliaciones;
CREATE POLICY compras_conciliaciones_empresa ON public.compras_conciliaciones FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE lower(u.correo)=lower(auth.jwt()->>'email') AND u.empresa=compras_conciliaciones.empresa))
WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE lower(u.correo)=lower(auth.jwt()->>'email') AND u.empresa=compras_conciliaciones.empresa));
REVOKE ALL ON public.compras_conciliaciones FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compras_conciliaciones TO authenticated;
COMMENT ON TABLE public.compras_conciliaciones IS 'Expediente de conciliación OC, guía, recepción física, factura y nota de crédito.';
COMMENT ON COLUMN public.bodega_movimientos.estado_validacion IS 'Los movimientos Pendientes no forman parte del stock hasta validación humana.';
CREATE OR REPLACE FUNCTION public.validar_movimiento_bodega()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_empresa_bodega TEXT; v_empresa_producto TEXT; v_centro INTEGER; v_obra TEXT; v_stock NUMERIC;
BEGIN
  SELECT empresa, centro_gestion_id, obra_nombre INTO v_empresa_bodega, v_centro, v_obra FROM public.bodega_bodegas WHERE id = NEW.bodega_id;
  SELECT empresa INTO v_empresa_producto FROM public.bodega_productos WHERE id = NEW.producto_id;
  IF v_empresa_bodega IS NULL OR v_empresa_producto IS NULL OR NEW.empresa <> v_empresa_bodega OR NEW.empresa <> v_empresa_producto THEN
    RAISE EXCEPTION 'La bodega, el producto y el movimiento deben pertenecer a la misma empresa';
  END IF;
  NEW.centro_gestion_id := v_centro; NEW.obra_nombre := COALESCE(NEW.obra_nombre, v_obra);
  IF NEW.tipo IN ('Salida','Ajuste -','Transferencia salida') AND NEW.estado_validacion = 'Validado' THEN
    SELECT COALESCE(SUM(CASE WHEN tipo IN ('Entrada','Ajuste +','Transferencia entrada') THEN cantidad ELSE -cantidad END),0)
      INTO v_stock FROM public.bodega_movimientos
      WHERE empresa=NEW.empresa AND bodega_id=NEW.bodega_id AND producto_id=NEW.producto_id
        AND estado_validacion='Validado' AND id IS DISTINCT FROM NEW.id;
    IF v_stock < NEW.cantidad THEN RAISE EXCEPTION 'Stock insuficiente. Disponible: %, solicitado: %',v_stock,NEW.cantidad; END IF;
  END IF;
  RETURN NEW;
END; $$;;
