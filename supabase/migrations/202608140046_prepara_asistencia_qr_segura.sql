-- Prepara la marcación pública por QR sin exponer obras, personal ni asistencias.
alter table public.obras
  add column if not exists asistencia_token text;

update public.obras
set asistencia_token = encode(gen_random_bytes(24), 'hex')
where asistencia_token is null or btrim(asistencia_token) = '';

alter table public.obras
  alter column asistencia_token set default encode(gen_random_bytes(24), 'hex'),
  alter column asistencia_token set not null;

create unique index if not exists obras_asistencia_token_uidx
  on public.obras (asistencia_token);

alter table public.asistencia_personal
  add column if not exists empresa text,
  add column if not exists obra_id integer,
  add column if not exists rut_normalizado text,
  add column if not exists fecha_marcacion date;

update public.asistencia_personal asistencia
set obra_id = obra.id,
    empresa = obra.empresa
from public.obras obra
where asistencia.obra_id is null
  and lower(btrim(asistencia.obra_nombre)) = lower(btrim(obra.nombre));

with persona_unica as (
  select
    upper(regexp_replace(coalesce(rut, ''), '[^0-9kK]', '', 'g')) as rut_normalizado,
    min(empresa) as empresa
  from public.maestro_personal
  where rut is not null and btrim(rut) <> ''
  group by upper(regexp_replace(coalesce(rut, ''), '[^0-9kK]', '', 'g'))
  having count(distinct empresa) = 1
)
update public.asistencia_personal asistencia
set empresa = persona.empresa
from persona_unica persona
where asistencia.empresa is null
  and upper(regexp_replace(coalesce(asistencia.rut, ''), '[^0-9kK]', '', 'g')) = persona.rut_normalizado;

update public.asistencia_personal
set empresa = 'Obraxis'
where empresa is null or btrim(empresa) = '';

update public.asistencia_personal
set rut_normalizado = upper(regexp_replace(coalesce(rut, ''), '[^0-9kK]', '', 'g'))
where rut_normalizado is null;

update public.asistencia_personal
set fecha_marcacion = timezone('America/Santiago', created_at)::date
where fecha_marcacion is null;

alter table public.asistencia_personal
  alter column empresa set not null,
  alter column fecha_marcacion set default (timezone('America/Santiago', now())::date),
  alter column fecha_marcacion set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'asistencia_personal_obra_id_fkey'
  ) then
    alter table public.asistencia_personal
      add constraint asistencia_personal_obra_id_fkey
      foreign key (obra_id) references public.obras(id) on delete restrict;
  end if;
end $$;

create index if not exists asistencia_personal_empresa_idx
  on public.asistencia_personal (empresa);
create index if not exists asistencia_personal_obra_rut_fecha_idx
  on public.asistencia_personal (obra_id, rut_normalizado, fecha_marcacion, created_at desc);
