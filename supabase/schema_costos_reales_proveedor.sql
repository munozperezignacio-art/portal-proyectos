-- Conserva los costos históricos y no modifica monto, factura ni imputaciones.
alter table public.costos_reales_obra
  add column proveedor_rut text,
  add column proveedor_nombre text;
comment on column public.costos_reales_obra.proveedor_rut is 'RUT del proveedor asociado al costo real.';
comment on column public.costos_reales_obra.proveedor_nombre is 'Nombre o razón social del proveedor al registrar el costo.';
