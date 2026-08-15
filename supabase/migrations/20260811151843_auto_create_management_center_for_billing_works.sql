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
FOR EACH ROW EXECUTE FUNCTION public.ensure_obra_centro_gestion();;
