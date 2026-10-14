-- Aplicado en Supabase como moneda_precio_unitario_partidas.
alter table public.partidas_obra
  add column if not exists moneda_pu text not null default 'CLP' check (moneda_pu in ('CLP','UF','USD')),
  add column if not exists pu_original numeric,
  add column if not exists cambio_pu_clp numeric check (cambio_pu_clp > 0);
