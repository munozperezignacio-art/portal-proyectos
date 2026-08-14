-- Cumplimiento de Prevención: asignaciones trazables por empresa, usuario y formulario.

alter table public.prevencion_cumplimiento_asignaciones
  add column if not exists empresa text,
  add column if not exists usuario_id integer,
  add column if not exists formulario_id integer,
  add column if not exists activo boolean not null default true;

alter table public.prevencion_cumplimiento_registros
  add column if not exists empresa text;

-- Las filas heredadas se conservan sin alterar. Al carecer de empresa quedan
-- fuera de las políticas multiempresa y no se muestran en la aplicación.

alter table public.prevencion_cumplimiento_asignaciones
  drop constraint if exists prevencion_cumplimiento_asignaciones_usuario_id_fkey,
  add constraint prevencion_cumplimiento_asignaciones_usuario_id_fkey
    foreign key (usuario_id) references public.usuarios(id) on delete restrict,
  drop constraint if exists prevencion_cumplimiento_asignaciones_formulario_id_fkey,
  add constraint prevencion_cumplimiento_asignaciones_formulario_id_fkey
    foreign key (formulario_id) references public.prevencion_formularios(id) on delete restrict,
  drop constraint if exists prevencion_cumplimiento_asignaciones_frecuencia_check,
  add constraint prevencion_cumplimiento_asignaciones_frecuencia_check
    check (frecuencia in ('Diario', 'Semanal', 'Mensual'));

create unique index if not exists prevencion_cumplimiento_asignacion_activa_uq
  on public.prevencion_cumplimiento_asignaciones (empresa, usuario_id, formulario_id, frecuencia)
  where activo = true and empresa is not null and usuario_id is not null and formulario_id is not null;

create index if not exists prevencion_cumplimiento_asignaciones_empresa_idx
  on public.prevencion_cumplimiento_asignaciones (empresa);

create index if not exists prevencion_cumplimiento_registros_empresa_idx
  on public.prevencion_cumplimiento_registros (empresa);

create or replace function public.validar_asignacion_cumplimiento()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_empresa_usuario text;
  v_empresa_formulario text;
begin
  if tg_op = 'UPDATE' and new.empresa is null and new.usuario_id is null and new.formulario_id is null then
    return new;
  end if;

  if new.empresa is null or new.usuario_id is null or new.formulario_id is null then
    raise exception 'La empresa, el usuario y el formulario son obligatorios';
  end if;
  select empresa into v_empresa_usuario from public.usuarios where id = new.usuario_id;
  select empresa into v_empresa_formulario from public.prevencion_formularios where id = new.formulario_id;

  if v_empresa_usuario is null or lower(v_empresa_usuario) <> lower(new.empresa) then
    raise exception 'El usuario seleccionado no pertenece a la empresa de la asignación';
  end if;

  if v_empresa_formulario is null or lower(v_empresa_formulario) <> lower(new.empresa) then
    raise exception 'El formulario seleccionado no pertenece a la empresa de la asignación';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_validar_asignacion_cumplimiento on public.prevencion_cumplimiento_asignaciones;
create trigger trg_validar_asignacion_cumplimiento
before insert or update on public.prevencion_cumplimiento_asignaciones
for each row execute function public.validar_asignacion_cumplimiento();

create or replace function public.completar_empresa_registro_cumplimiento()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_empresa text;
begin
  select empresa into v_empresa
  from public.prevencion_cumplimiento_asignaciones
  where id = new.asignacion_id;

  if v_empresa is null then
    raise exception 'La asignación de cumplimiento no existe';
  end if;

  new.empresa := coalesce(v_empresa, new.empresa);
  return new;
end;
$$;

drop trigger if exists trg_empresa_registro_cumplimiento on public.prevencion_cumplimiento_registros;
create trigger trg_empresa_registro_cumplimiento
before insert or update on public.prevencion_cumplimiento_registros
for each row execute function public.completar_empresa_registro_cumplimiento();

drop policy if exists "Acceso total asignaciones" on public.prevencion_cumplimiento_asignaciones;
drop policy if exists "Allow_All_Operations_Anon_Authenticated" on public.prevencion_cumplimiento_asignaciones;
drop policy if exists "Acceso total registros" on public.prevencion_cumplimiento_registros;
drop policy if exists "Allow_All_Operations_Anon_Authenticated" on public.prevencion_cumplimiento_registros;

alter table public.prevencion_cumplimiento_asignaciones enable row level security;
alter table public.prevencion_cumplimiento_registros enable row level security;

create policy "cumplimiento_asignaciones_empresa"
on public.prevencion_cumplimiento_asignaciones
for all
to authenticated
using (private.obraxis_actor_can_access_company(empresa))
with check (private.obraxis_actor_can_access_company(empresa));

create policy "cumplimiento_registros_empresa"
on public.prevencion_cumplimiento_registros
for all
to authenticated
using (private.obraxis_actor_can_access_company(empresa))
with check (private.obraxis_actor_can_access_company(empresa));

revoke all on public.prevencion_cumplimiento_asignaciones from anon;
revoke all on public.prevencion_cumplimiento_registros from anon;
grant select, insert, update, delete on public.prevencion_cumplimiento_asignaciones to authenticated;
grant select, insert, update, delete on public.prevencion_cumplimiento_registros to authenticated;
