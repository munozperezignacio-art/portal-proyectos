alter table public.partidas_obra
  add column if not exists orden integer not null default 0,
  add column if not exists es_titulo boolean not null default false,
  add column if not exists predecesora text,
  add column if not exists tipo_relacion text not null default 'FS',
  add column if not exists desfase_dias integer not null default 0;
with ranked as (
  select id, row_number() over (partition by empresa, obra_id order by created_at, id) - 1 as rn
  from public.partidas_obra
)
update public.partidas_obra p set orden = r.rn from ranked r where p.id = r.id and p.orden = 0;
create index if not exists partidas_obra_empresa_obra_orden_idx on public.partidas_obra (empresa, obra_id, orden);;
