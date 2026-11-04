alter table public.costos_reales_obra
  add column if not exists monto_iva numeric,
  add column if not exists monto_total numeric;
-- A purchase order is one expense, also when a later invoice is attached.
-- Existing rows and assignments are not rewritten.
create unique index costos_reales_empresa_oc_unique
  on public.costos_reales_obra (empresa, upper(regexp_replace(num_oc, '\s', '', 'g')))
  where nullif(trim(num_oc), '') is not null;
