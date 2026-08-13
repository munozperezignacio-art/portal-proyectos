-- Last Planner operativo: responsables, compromisos, criticidad y trazabilidad.
alter table public.last_planner_recursos
  add column if not exists fecha_compromiso date,
  add column if not exists criticidad text not null default 'Media',
  add column if not exists liberado_at timestamptz,
  add column if not exists liberado_por text,
  add column if not exists actualizado_por text;

alter table public.last_planner_recursos drop constraint if exists last_planner_recursos_criticidad_check;
alter table public.last_planner_recursos add constraint last_planner_recursos_criticidad_check
  check (criticidad in ('Baja','Media','Alta','Crítica'));

alter table public.last_planner_recursos drop constraint if exists last_planner_recursos_obra_nombre_partida_recurso_clave_key;
create unique index if not exists last_planner_recursos_empresa_obra_partida_clave_uidx
  on public.last_planner_recursos (empresa, obra_nombre, partida, recurso_clave);

drop policy if exists "Allow_All_Operations_Anon_Authenticated" on public.last_planner_recursos;
drop policy if exists "last_planner_empresa_select" on public.last_planner_recursos;
drop policy if exists "last_planner_empresa_insert" on public.last_planner_recursos;
drop policy if exists "last_planner_empresa_update" on public.last_planner_recursos;
drop policy if exists "last_planner_empresa_delete" on public.last_planner_recursos;

create policy "last_planner_empresa_select" on public.last_planner_recursos for select to authenticated
using (exists (select 1 from public.usuarios u where u.auth_user_id = (select auth.uid()) and (u.empresa = last_planner_recursos.empresa or lower(coalesce(u.rol_base,u.rol,'')) = 'superusuario')));
create policy "last_planner_empresa_insert" on public.last_planner_recursos for insert to authenticated
with check (exists (select 1 from public.usuarios u where u.auth_user_id = (select auth.uid()) and (u.empresa = last_planner_recursos.empresa or lower(coalesce(u.rol_base,u.rol,'')) = 'superusuario')));
create policy "last_planner_empresa_update" on public.last_planner_recursos for update to authenticated
using (exists (select 1 from public.usuarios u where u.auth_user_id = (select auth.uid()) and (u.empresa = last_planner_recursos.empresa or lower(coalesce(u.rol_base,u.rol,'')) = 'superusuario')))
with check (exists (select 1 from public.usuarios u where u.auth_user_id = (select auth.uid()) and (u.empresa = last_planner_recursos.empresa or lower(coalesce(u.rol_base,u.rol,'')) = 'superusuario')));
create policy "last_planner_empresa_delete" on public.last_planner_recursos for delete to authenticated
using (exists (select 1 from public.usuarios u where u.auth_user_id = (select auth.uid()) and (u.empresa = last_planner_recursos.empresa or lower(coalesce(u.rol_base,u.rol,'')) = 'superusuario')));

revoke all on public.last_planner_recursos from anon;
grant select, insert, update, delete on public.last_planner_recursos to authenticated;
grant usage, select on sequence public.last_planner_recursos_id_seq to authenticated;
