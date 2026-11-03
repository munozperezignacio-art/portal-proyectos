-- Independent purchase-order reference; existing costs and permissions are unchanged.
alter table public.costos_reales_obra add column if not exists num_oc text;
comment on column public.costos_reales_obra.num_oc is 'Número de orden de compra asociada al costo, independiente de la factura o guía.';
