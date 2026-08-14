-- Aislamiento multiempresa para tablas heredadas de presupuesto y avance.
-- Mantiene obra_nombre por compatibilidad, pero obra_id + empresa pasan a ser
-- la identidad estable para nuevas lecturas, escrituras y políticas RLS.

alter table public.partidas_obra
  add column if not exists obra_id integer,
  add column if not exists empresa text;

alter table public.avances_produccion_partidas
  add column if not exists obra_id integer,
  add column if not exists empresa text;

-- Solo se migran coincidencias inequívocas. Los registros sin obra o con un
-- nombre ambiguo se conservan intactos para revisión, sin asignarlos a otro tenant.
with obras_unicas as (
  select min(id) as id, nombre, min(empresa) as empresa
  from public.obras
  where nombre is not null
  group by nombre
  having count(*) = 1
)
update public.partidas_obra p
set obra_id = o.id,
    empresa = o.empresa
from obras_unicas o
where p.obra_nombre = o.nombre
  and (p.obra_id is null or p.empresa is null);

with obras_unicas as (
  select min(id) as id, nombre, min(empresa) as empresa
  from public.obras
  where nombre is not null
  group by nombre
  having count(*) = 1
)
update public.avances_produccion_partidas a
set obra_id = o.id,
    empresa = o.empresa
from obras_unicas o
where a.obra_nombre = o.nombre
  and (a.obra_id is null or a.empresa is null);

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'partidas_obra_obra_id_fkey') then
    alter table public.partidas_obra
      add constraint partidas_obra_obra_id_fkey
      foreign key (obra_id) references public.obras(id) on delete restrict not valid;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'avances_produccion_partidas_obra_id_fkey') then
    alter table public.avances_produccion_partidas
      add constraint avances_produccion_partidas_obra_id_fkey
      foreign key (obra_id) references public.obras(id) on delete restrict not valid;
  end if;
end $$;

alter table public.partidas_obra validate constraint partidas_obra_obra_id_fkey;
alter table public.avances_produccion_partidas validate constraint avances_produccion_partidas_obra_id_fkey;

create index if not exists partidas_obra_empresa_obra_id_idx
  on public.partidas_obra (empresa, obra_id);
create index if not exists partidas_obra_obra_id_idx
  on public.partidas_obra (obra_id);
create index if not exists avances_partidas_empresa_obra_id_fecha_idx
  on public.avances_produccion_partidas (empresa, obra_id, created_at desc);
create index if not exists avances_partidas_obra_id_idx
  on public.avances_produccion_partidas (obra_id);

create or replace function public.sincronizar_alcance_obra_legacy()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  obra_match public.obras%rowtype;
begin
  if new.obra_id is not null then
    select * into obra_match from public.obras where id = new.obra_id;
  elsif new.obra_nombre is not null then
    select o.* into obra_match
    from public.obras o
    where o.nombre = new.obra_nombre
      and (new.empresa is null or o.empresa = new.empresa)
    order by o.id
    limit 1;
  end if;

  if obra_match.id is not null then
    new.obra_id := obra_match.id;
    new.obra_nombre := obra_match.nombre;
    new.empresa := obra_match.empresa;
  end if;
  return new;
end;
$$;

drop trigger if exists partidas_obra_sincronizar_alcance on public.partidas_obra;
create trigger partidas_obra_sincronizar_alcance
before insert or update of obra_id, obra_nombre, empresa
on public.partidas_obra
for each row execute function public.sincronizar_alcance_obra_legacy();

drop trigger if exists avances_partidas_sincronizar_alcance on public.avances_produccion_partidas;
create trigger avances_partidas_sincronizar_alcance
before insert or update of obra_id, obra_nombre, empresa
on public.avances_produccion_partidas
for each row execute function public.sincronizar_alcance_obra_legacy();

comment on column public.partidas_obra.obra_id is 'Identificador estable de la obra; obra_nombre se conserva por compatibilidad.';
comment on column public.avances_produccion_partidas.obra_id is 'Identificador estable de la obra; obra_nombre se conserva por compatibilidad.';
