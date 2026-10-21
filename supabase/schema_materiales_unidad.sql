-- No se asigna una unidad ficticia a los movimientos históricos.
alter table public.inventario_materiales add column if not exists unidad text;
comment on column public.inventario_materiales.unidad is 'Unidad de medida del movimiento. NULL en registros históricos sin unidad informada.';
notify pgrst, 'reload schema';
