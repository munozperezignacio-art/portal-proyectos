create table if not exists public.mandante_integraciones (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.mandante_contratos(id) on delete restrict,
  entrega_id uuid not null references public.mandante_entregas(id) on delete restrict,
  empresa_mandante text not null,
  empresa_origen text not null,
  modulo text not null,
  fuente_tabla text not null,
  fuente_id text not null,
  huella text not null,
  fuente_actualizada_at timestamptz,
  resumen jsonb not null default '{}'::jsonb,
  sincronizado_por text,
  created_at timestamptz not null default now(),
  unique (contrato_id, fuente_tabla, fuente_id, huella)
);
create index if not exists mandante_integraciones_contrato_idx on public.mandante_integraciones (contrato_id, created_at desc);
create index if not exists mandante_integraciones_fuente_idx on public.mandante_integraciones (fuente_tabla, fuente_id);
alter table public.mandante_integraciones enable row level security;
grant select on public.mandante_integraciones to authenticated;
create policy mandante_integraciones_empresas on public.mandante_integraciones
for select to authenticated
using (exists (select 1 from public.mandante_contratos c where c.id=contrato_id and ((select private.usuario_puede_empresa(c.empresa_mandante)) or (c.empresa_obraxis_vinculada is not null and (select private.usuario_puede_empresa(c.empresa_obraxis_vinculada))))));
comment on table public.mandante_integraciones is 'Trazabilidad inmutable de snapshots contractuales sincronizados desde empresas Obraxis vinculadas.';;
