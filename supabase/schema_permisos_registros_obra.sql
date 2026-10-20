-- Las acciones explícitas del rol prevalecen sobre su nombre/nivel.
create or replace function private.obraxis_permission(p_empresa text,p_key text)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare actor record; permisos jsonb; base text; accion text:=split_part(p_key,'.',3);
begin
  if auth.uid() is null or not private.obraxis_actor_can_access_company(p_empresa) then return false; end if;
  select u.*,r.permisos as permisos_rol,r.archivado as rol_archivado,r.rol_base as base_rol
    into actor from public.usuarios u left join public.roles r on r.empresa=u.empresa and r.nombre=u.rol
    where u.auth_user_id=auth.uid() limit 1;
  if not found or coalesce(actor.rol_archivado,false) then return false; end if;
  base:=lower(coalesce(nullif(actor.rol_base,''),actor.base_rol,actor.rol,''));
  if base like '%superusuario%' or base like '%superadmin%' or (actor.empresa='Obraxis' and base like '%admin%') then return true; end if;
  if actor.empresa<>p_empresa then return false; end if;
  permisos:=coalesce(actor.permisos_rol,'{}'::jsonb)||coalesce(actor.permisos,'{}'::jsonb);
  if permisos ? p_key then return permisos->p_key='true'::jsonb; end if;
  if base like '%admin%' or base like '%gerencia%' then return true; end if;
  if base like '%jefe%' or base like '%profesional%' or base like '%creador%' then return accion not in ('aprobar','configurar'); end if;
  if base like '%supervisor%' or base like '%revisor%' then return accion in ('ver','revisar','aprobar','descargar'); end if;
  return accion in ('ver','crear');
end; $$;
revoke all on function private.obraxis_permission(text,text) from public,anon;
grant execute on function private.obraxis_permission(text,text) to authenticated;

-- Conserva el aislamiento de empresa existente y exige además el permiso de la acción.
drop policy if exists avances_permiso_insert on public.avances_produccion_partidas;
create policy avances_permiso_insert on public.avances_produccion_partidas as restrictive for insert to authenticated
with check(private.obraxis_permission(empresa,'obras.avances.crear'));
drop policy if exists avances_permiso_update on public.avances_produccion_partidas;
create policy avances_permiso_update on public.avances_produccion_partidas as restrictive for update to authenticated
using(private.obraxis_permission(empresa,'obras.avances.editar'))
with check(private.obraxis_permission(empresa,'obras.avances.editar'));
drop policy if exists avances_permiso_delete on public.avances_produccion_partidas;
create policy avances_permiso_delete on public.avances_produccion_partidas as restrictive for delete to authenticated
using(private.obraxis_permission(empresa,'obras.avances.eliminar'));

create or replace function private.obraxis_configurar_responsabilidad(p_empresa text,p_condiciones jsonb)
returns boolean language sql stable security definer set search_path='' as $$
  select private.obraxis_permission(p_empresa,'admin.permisos.configurar') or (
    private.obraxis_permission(p_empresa,'obras.ficha.configurar')
    and p_condiciones->>'alcance_tipo'='seleccionadas'
    and jsonb_typeof(p_condiciones->'obras_seleccionadas')='array'
    and jsonb_array_length(p_condiciones->'obras_seleccionadas')>0
    and not exists(select 1 from jsonb_array_elements_text(p_condiciones->'obras_seleccionadas') nombre
      where not exists(select 1 from public.obras o where o.empresa=p_empresa and o.nombre=nombre))
  );
$$;
revoke all on function private.obraxis_configurar_responsabilidad(text,jsonb) from public,anon;
grant execute on function private.obraxis_configurar_responsabilidad(text,jsonb) to authenticated;
drop policy if exists responsabilidades_insert on public.notificaciones_reglas;
create policy responsabilidades_insert on public.notificaciones_reglas as restrictive for insert to authenticated
with check(private.obraxis_configurar_responsabilidad(empresa,condiciones));
drop policy if exists responsabilidades_update on public.notificaciones_reglas;
create policy responsabilidades_update on public.notificaciones_reglas as restrictive for update to authenticated
using(private.obraxis_configurar_responsabilidad(empresa,condiciones))
with check(private.obraxis_configurar_responsabilidad(empresa,condiciones));
drop policy if exists responsabilidades_delete on public.notificaciones_reglas;
create policy responsabilidades_delete on public.notificaciones_reglas as restrictive for delete to authenticated
using(private.obraxis_configurar_responsabilidad(empresa,condiciones));
notify pgrst,'reload schema';
