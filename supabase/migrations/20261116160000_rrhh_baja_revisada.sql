-- Retain the worker identity referenced by approved labor costs.
alter table public.maestro_personal add column if not exists estado text default 'Activo';
create or replace function private.rrhh_validar_baja_revisada() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if lower(new.estado)='inactivo' and lower(coalesce(old.estado,''))<>'inactivo' and not exists(
   select 1 from public.usuarios u left join public.roles r on r.empresa=u.empresa and r.nombre=u.rol and not coalesce(r.archivado,false)
   where u.auth_user_id=auth.uid() and u.empresa=old.empresa and coalesce(
     u.permisos->'rrhh.personal.eliminar',r.permisos->'rrhh.personal.eliminar',
     to_jsonb(private.obraxis_actor_can_manage_company(old.empresa)))='true'::jsonb
 ) then raise exception 'Sin permiso para dar de baja al trabajador'; end if;
 if lower(new.estado)='inactivo' and lower(coalesce(old.estado,''))<>'inactivo' and exists (
   select 1 from public.rrhh_imputaciones_diarias d where d.empresa=old.empresa and d.trabajador_id=old.id and d.estado='Pendiente'
 ) then raise exception 'Todavía hay imputaciones pendientes. Actualiza la revisión antes de confirmar la baja.'; end if;
 return new;
end $$;
revoke all on function private.rrhh_validar_baja_revisada() from public,anon,authenticated;
create trigger rrhh_baja_revisada before update of estado on public.maestro_personal
for each row execute function private.rrhh_validar_baja_revisada();

-- Serialize generation of new daily charges with the reviewed exit. Existing
-- approved charges stay in place, even if the monthly generator runs again.
create function private.rrhh_omitir_cargo_inactivo() returns trigger
language plpgsql security definer set search_path='' as $$
declare worker_state text;
begin
 select p.estado into worker_state from public.maestro_personal p
 where p.id=new.trabajador_id and p.empresa=new.empresa for share;
 if lower(worker_state)='inactivo' then return null; end if;
 return new;
end $$;
revoke all on function private.rrhh_omitir_cargo_inactivo() from public,anon,authenticated;
create trigger rrhh_omitir_cargo_inactivo before insert on public.rrhh_imputaciones_diarias
for each row execute function private.rrhh_omitir_cargo_inactivo();
