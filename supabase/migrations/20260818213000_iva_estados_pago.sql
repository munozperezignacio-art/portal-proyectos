alter table public.estados_pago_obra
  add column if not exists iva_pct numeric(5,2) not null default 19,
  add column if not exists iva_monto numeric(18,2) not null default 0,
  add column if not exists monto_total numeric(18,2) not null default 0;

update public.estados_pago_obra
set
  iva_pct = coalesce(iva_pct, 19),
  iva_monto = round(coalesce(monto_neto, 0)::numeric * coalesce(iva_pct, 19)::numeric / 100, 0),
  monto_total = coalesce(monto_neto, 0)::numeric
    + round(coalesce(monto_neto, 0)::numeric * coalesce(iva_pct, 19)::numeric / 100, 0)
where coalesce(monto_total, 0) = 0;

comment on column public.estados_pago_obra.iva_pct is
  'Tasa de IVA aplicada al subtotal neto del Estado de Pago.';
comment on column public.estados_pago_obra.iva_monto is
  'IVA calculado sobre el subtotal neto después de retención y amortización de anticipo.';
comment on column public.estados_pago_obra.monto_total is
  'Total del Estado de Pago en CLP: monto_neto más iva_monto.';
