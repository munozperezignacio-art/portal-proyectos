CREATE INDEX IF NOT EXISTS facturacion_documentos_centro_idx
  ON public.facturacion_documentos (centro_gestion_id);
CREATE INDEX IF NOT EXISTS facturacion_documentos_estado_pago_idx
  ON public.facturacion_documentos (estado_pago_id)
  WHERE estado_pago_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS estados_pago_obra_factura_documento_idx
  ON public.estados_pago_obra (factura_documento_id)
  WHERE factura_documento_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS obras_centro_gestion_idx
  ON public.obras (centro_gestion_id)
  WHERE centro_gestion_id IS NOT NULL;;
