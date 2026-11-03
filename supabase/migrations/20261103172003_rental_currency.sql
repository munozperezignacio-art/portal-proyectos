alter table public.arriendos_maquinaria
  add column if not exists moneda_costo text not null default 'CLP',
  add column if not exists costo_original numeric,
  add column if not exists cambio_costo_clp numeric;
comment on column public.arriendos_maquinaria.costo is 'Tarifa equivalente en CLP para los cálculos de costos. La tarifa original y la conversión se conservan por separado.';
