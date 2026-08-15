CREATE INDEX IF NOT EXISTS compras_conciliaciones_centro_idx ON public.compras_conciliaciones (centro_gestion_id) WHERE centro_gestion_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS compras_conciliaciones_guia_idx ON public.compras_conciliaciones (guia_id) WHERE guia_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS compras_conciliaciones_factura_idx ON public.compras_conciliaciones (factura_id) WHERE factura_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS compras_conciliaciones_nc_idx ON public.compras_conciliaciones (nota_credito_id) WHERE nota_credito_id IS NOT NULL;
CREATE OR REPLACE FUNCTION public.validar_movimiento_bodega()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE v_empresa_bodega TEXT; v_empresa_producto TEXT; v_centro INTEGER; v_obra TEXT; v_stock NUMERIC;
BEGIN
  SELECT empresa, centro_gestion_id, obra_nombre INTO v_empresa_bodega, v_centro, v_obra FROM public.bodega_bodegas WHERE id = NEW.bodega_id;
  SELECT empresa INTO v_empresa_producto FROM public.bodega_productos WHERE id = NEW.producto_id;
  IF v_empresa_bodega IS NULL OR v_empresa_producto IS NULL OR NEW.empresa <> v_empresa_bodega OR NEW.empresa <> v_empresa_producto THEN RAISE EXCEPTION 'La bodega, el producto y el movimiento deben pertenecer a la misma empresa'; END IF;
  NEW.centro_gestion_id := v_centro; NEW.obra_nombre := COALESCE(NEW.obra_nombre, v_obra);
  IF TG_OP = 'UPDATE' AND OLD.estado_validacion = 'Pendiente' AND NEW.estado_validacion IN ('Validado','Rechazado') THEN
    NEW.validado_por := COALESCE((auth.jwt()->>'email'), NEW.validado_por); NEW.validado_at := NOW();
  END IF;
  IF NEW.tipo IN ('Salida','Ajuste -','Transferencia salida') AND NEW.estado_validacion = 'Validado' THEN
    SELECT COALESCE(SUM(CASE WHEN tipo IN ('Entrada','Ajuste +','Transferencia entrada') THEN cantidad ELSE -cantidad END),0) INTO v_stock
    FROM public.bodega_movimientos WHERE empresa=NEW.empresa AND bodega_id=NEW.bodega_id AND producto_id=NEW.producto_id AND estado_validacion='Validado' AND id IS DISTINCT FROM NEW.id;
    IF v_stock < NEW.cantidad THEN RAISE EXCEPTION 'Stock insuficiente. Disponible: %, solicitado: %',v_stock,NEW.cantidad; END IF;
  END IF;
  RETURN NEW;
END; $$;;
