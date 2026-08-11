-- Bodega empresarial integrada con centros de gestión.

CREATE TABLE IF NOT EXISTS public.bodega_bodegas (
  id BIGSERIAL PRIMARY KEY,
  empresa TEXT NOT NULL,
  codigo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  centro_gestion_id INTEGER NOT NULL REFERENCES public.facturacion_centros_gestion(id) ON DELETE RESTRICT,
  obra_nombre TEXT,
  tipo TEXT NOT NULL DEFAULT 'Central' CHECK (tipo IN ('Central', 'Obra', 'Temporal')),
  responsable TEXT,
  ubicacion TEXT,
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (empresa, codigo)
);

CREATE TABLE IF NOT EXISTS public.bodega_productos (
  id BIGSERIAL PRIMARY KEY,
  empresa TEXT NOT NULL,
  codigo TEXT NOT NULL,
  nombre TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Material',
  unidad TEXT NOT NULL DEFAULT 'UN',
  stock_minimo NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (stock_minimo >= 0),
  costo_referencia NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (costo_referencia >= 0),
  activo BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (empresa, codigo)
);

CREATE TABLE IF NOT EXISTS public.bodega_movimientos (
  id BIGSERIAL PRIMARY KEY,
  empresa TEXT NOT NULL,
  bodega_id BIGINT NOT NULL REFERENCES public.bodega_bodegas(id) ON DELETE RESTRICT,
  producto_id BIGINT NOT NULL REFERENCES public.bodega_productos(id) ON DELETE RESTRICT,
  tipo TEXT NOT NULL CHECK (tipo IN ('Entrada', 'Salida', 'Ajuste +', 'Ajuste -', 'Transferencia entrada', 'Transferencia salida')),
  cantidad NUMERIC(18,4) NOT NULL CHECK (cantidad > 0),
  costo_unitario NUMERIC(18,4) NOT NULL DEFAULT 0 CHECK (costo_unitario >= 0),
  documento TEXT,
  contraparte TEXT,
  obra_nombre TEXT,
  centro_gestion_id INTEGER REFERENCES public.facturacion_centros_gestion(id) ON DELETE SET NULL,
  transferencia_id UUID,
  responsable TEXT,
  observaciones TEXT,
  fecha TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS bodega_bodegas_empresa_centro_idx ON public.bodega_bodegas (empresa, centro_gestion_id);
CREATE INDEX IF NOT EXISTS bodega_bodegas_centro_idx ON public.bodega_bodegas (centro_gestion_id);
CREATE INDEX IF NOT EXISTS bodega_productos_empresa_nombre_idx ON public.bodega_productos (empresa, nombre);
CREATE INDEX IF NOT EXISTS bodega_movimientos_stock_idx ON public.bodega_movimientos (empresa, bodega_id, producto_id, fecha DESC);
CREATE INDEX IF NOT EXISTS bodega_movimientos_bodega_idx ON public.bodega_movimientos (bodega_id);
CREATE INDEX IF NOT EXISTS bodega_movimientos_producto_idx ON public.bodega_movimientos (producto_id);
CREATE INDEX IF NOT EXISTS bodega_movimientos_centro_idx ON public.bodega_movimientos (centro_gestion_id) WHERE centro_gestion_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS bodega_movimientos_transferencia_idx ON public.bodega_movimientos (transferencia_id) WHERE transferencia_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validar_movimiento_bodega()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_empresa_bodega TEXT;
  v_empresa_producto TEXT;
  v_centro INTEGER;
  v_obra TEXT;
  v_stock NUMERIC;
BEGIN
  SELECT empresa, centro_gestion_id, obra_nombre
    INTO v_empresa_bodega, v_centro, v_obra
  FROM public.bodega_bodegas WHERE id = NEW.bodega_id;
  SELECT empresa INTO v_empresa_producto
  FROM public.bodega_productos WHERE id = NEW.producto_id;

  IF v_empresa_bodega IS NULL OR v_empresa_producto IS NULL
     OR NEW.empresa <> v_empresa_bodega OR NEW.empresa <> v_empresa_producto THEN
    RAISE EXCEPTION 'La bodega, el producto y el movimiento deben pertenecer a la misma empresa';
  END IF;

  NEW.centro_gestion_id := v_centro;
  NEW.obra_nombre := COALESCE(NEW.obra_nombre, v_obra);

  IF NEW.tipo IN ('Salida', 'Ajuste -', 'Transferencia salida') THEN
    SELECT COALESCE(SUM(CASE
      WHEN tipo IN ('Entrada', 'Ajuste +', 'Transferencia entrada') THEN cantidad
      ELSE -cantidad END), 0)
    INTO v_stock
    FROM public.bodega_movimientos
    WHERE empresa = NEW.empresa AND bodega_id = NEW.bodega_id AND producto_id = NEW.producto_id;

    IF v_stock < NEW.cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente. Disponible: %, solicitado: %', v_stock, NEW.cantidad;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validar_bodega_movimiento_before_write ON public.bodega_movimientos;
CREATE TRIGGER validar_bodega_movimiento_before_write
BEFORE INSERT OR UPDATE ON public.bodega_movimientos
FOR EACH ROW EXECUTE FUNCTION public.validar_movimiento_bodega();

ALTER TABLE public.bodega_bodegas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bodega_productos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bodega_movimientos ENABLE ROW LEVEL SECURITY;

-- Aislamiento multiempresa: sólo perfiles autenticados de la empresa correspondiente.
-- Los administradores corporativos Obraxis conservan el selector global de empresas.
DROP POLICY IF EXISTS bodega_bodegas_app_access ON public.bodega_bodegas;
CREATE POLICY bodega_bodegas_app_access ON public.bodega_bodegas FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE LOWER(u.correo) = LOWER((SELECT auth.jwt()) ->> 'email') AND (u.empresa = bodega_bodegas.empresa OR (LOWER(u.empresa) = 'obraxis' AND LOWER(COALESCE(u.rol, '')) LIKE '%admin%'))))
WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE LOWER(u.correo) = LOWER((SELECT auth.jwt()) ->> 'email') AND (u.empresa = bodega_bodegas.empresa OR (LOWER(u.empresa) = 'obraxis' AND LOWER(COALESCE(u.rol, '')) LIKE '%admin%'))));
DROP POLICY IF EXISTS bodega_productos_app_access ON public.bodega_productos;
CREATE POLICY bodega_productos_app_access ON public.bodega_productos FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE LOWER(u.correo) = LOWER((SELECT auth.jwt()) ->> 'email') AND (u.empresa = bodega_productos.empresa OR (LOWER(u.empresa) = 'obraxis' AND LOWER(COALESCE(u.rol, '')) LIKE '%admin%'))))
WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE LOWER(u.correo) = LOWER((SELECT auth.jwt()) ->> 'email') AND (u.empresa = bodega_productos.empresa OR (LOWER(u.empresa) = 'obraxis' AND LOWER(COALESCE(u.rol, '')) LIKE '%admin%'))));
DROP POLICY IF EXISTS bodega_movimientos_app_access ON public.bodega_movimientos;
CREATE POLICY bodega_movimientos_app_access ON public.bodega_movimientos FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.usuarios u WHERE LOWER(u.correo) = LOWER((SELECT auth.jwt()) ->> 'email') AND (u.empresa = bodega_movimientos.empresa OR (LOWER(u.empresa) = 'obraxis' AND LOWER(COALESCE(u.rol, '')) LIKE '%admin%'))))
WITH CHECK (EXISTS (SELECT 1 FROM public.usuarios u WHERE LOWER(u.correo) = LOWER((SELECT auth.jwt()) ->> 'email') AND (u.empresa = bodega_movimientos.empresa OR (LOWER(u.empresa) = 'obraxis' AND LOWER(COALESCE(u.rol, '')) LIKE '%admin%'))));

REVOKE ALL ON public.bodega_bodegas, public.bodega_productos, public.bodega_movimientos FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bodega_bodegas, public.bodega_productos, public.bodega_movimientos TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.bodega_bodegas_id_seq, public.bodega_productos_id_seq, public.bodega_movimientos_id_seq TO authenticated;
