-- Work managers may change work email routing, not the company configuration row.
create or replace function private.obraxis_configurar_obra(p_empresa text,p_nombre text)
returns boolean language sql stable security definer set search_path='' as $$
 select private.obraxis_permission(p_empresa,'admin.permisos.configurar') or (
 private.obraxis_permission(p_empresa,'obras.ficha.configurar') and exists(
 select 1 from public.usuarios u, unnest(string_to_array(u.obras,',')) v
 where u.auth_user_id=auth.uid() and u.empresa=p_empresa
 and lower(btrim(v)) in ('todas',lower(p_nombre))))
$$;
revoke all on function private.obraxis_configurar_obra(text,text) from public,anon;
grant execute on function private.obraxis_configurar_obra(text,text) to authenticated;

create or replace function private.obraxis_configurar_responsabilidad(p_empresa text,p_condiciones jsonb)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_nombre text;
begin
 if private.obraxis_permission(p_empresa,'admin.permisos.configurar') then return true; end if;
 if p_condiciones->>'alcance_tipo' is distinct from 'seleccionadas'
 or jsonb_typeof(p_condiciones->'obras_seleccionadas') is distinct from 'array' then return false; end if;
 if jsonb_array_length(p_condiciones->'obras_seleccionadas')=0 then return false; end if;
 for v_nombre in select jsonb_array_elements_text(p_condiciones->'obras_seleccionadas') loop
   if not private.obraxis_configurar_obra(p_empresa,v_nombre) or not exists(
     select 1 from public.obras o where o.empresa=p_empresa and o.nombre=v_nombre) then return false; end if;
 end loop;
 return true;
end $$;
-- Keep a permissive company boundary AND the existing restrictive write policies.
-- Replace the legacy email identity lookup with the stable authenticated user ID.
drop policy if exists notificaciones_reglas_empresa on public.notificaciones_reglas;
create policy responsabilidades_empresa on public.notificaciones_reglas for all to authenticated
using (private.obraxis_actor_can_access_company(empresa))
with check (private.obraxis_actor_can_access_company(empresa));

create or replace function private.guardar_correos_obra(p_empresa text,p_obra integer,p_contextos jsonb,p_version timestamptz)
returns timestamptz language plpgsql security definer set search_path='' as $$
declare cfg public.config_empresa; obra public.obras; k text; contexto jsonb; evento record;
 global_admin boolean; stamp timestamptz; address text; seen text[];
begin
 if auth.uid() is null then raise exception 'Sesión requerida' using errcode='42501'; end if;
 select * into obra from public.obras where empresa=p_empresa and id=p_obra;
 if not found or not private.obraxis_configurar_obra(p_empresa,obra.nombre) then
   raise exception 'Sin permiso para configurar esta obra' using errcode='42501'; end if;
 global_admin:=private.obraxis_permission(p_empresa,'admin.permisos.configurar');
 if jsonb_typeof(p_contextos) is distinct from 'object' then raise exception 'Configuración inválida'; end if;
 select * into cfg from public.config_empresa where empresa=p_empresa for update;
 if not found then raise exception 'Empresa sin configuración'; end if;
 if cfg.updated_at is distinct from p_version then raise exception 'Otra persona modificó la configuración. Vuelve a abrir el menú.' using errcode='40001'; end if;
 for k in select jsonb_object_keys(coalesce(cfg.correos_contextuales,'{}')||p_contextos) loop
   if cfg.correos_contextuales->k is not distinct from p_contextos->k then continue; end if;
   if not global_admin and k not in ('obra:'||p_obra,'avances_obra:'||obra.nombre) then
     raise exception 'Tu rol solo puede modificar los correos de esta obra' using errcode='42501'; end if;
   if k <> 'obras:global' and not exists(select 1 from public.obras o where o.empresa=p_empresa
     and k in ('obra:'||o.id,'avances_obra:'||o.nombre)) then
     raise exception 'Contexto de correo no autorizado' using errcode='42501'; end if;
   contexto:=p_contextos->k;
   if contexto is null then continue; end if;
   if jsonb_typeof(contexto) is distinct from 'object' then raise exception 'Contexto inválido'; end if;
   for evento in select * from jsonb_each(coalesce(contexto->'events','{}')) loop
     if evento.key not in ('avance_registrado','asistencia_registrada','maquinaria_registrada','material_registrado','mantenimiento_registrado','maquinaria_falla_reportada','incidente_accidente') then raise exception 'Tipo de aviso inválido'; end if;
     if jsonb_typeof(evento.value->'emails') is distinct from 'array' or jsonb_typeof(evento.value->'emailsCC') is distinct from 'array'
       or jsonb_typeof(evento.value->'autoNotify') is distinct from 'boolean' then raise exception 'Destinatarios inválidos'; end if;
     seen:=array[]::text[];
     for address in select jsonb_array_elements_text((evento.value->'emails')||(evento.value->'emailsCC')) loop
       if address is null or address !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Correo inválido'; end if;
       if lower(btrim(address))=any(seen) then raise exception 'Correo duplicado'; end if;
       seen:=array_append(seen,lower(btrim(address)));
       if k<>'obras:global' and exists(select 1 from jsonb_array_elements_text(
          coalesce(p_contextos#>array['obras:global','events',evento.key,'emails'],'[]')||
          coalesce(p_contextos#>array['obras:global','events',evento.key,'emailsCC'],'[]')) g
          where lower(btrim(g))=lower(btrim(address))) then
         raise exception 'El correo ya tiene una regla para todas las obras'; end if;
     end loop;
   end loop;
 end loop;
 stamp:=clock_timestamp();
 update public.config_empresa set correos_contextuales=p_contextos,updated_at=stamp where empresa=p_empresa returning updated_at into stamp;
 return stamp;
end $$;
revoke all on function private.guardar_correos_obra(text,integer,jsonb,timestamptz) from public,anon;
grant execute on function private.guardar_correos_obra(text,integer,jsonb,timestamptz) to authenticated;
create or replace function public.guardar_correos_obra(p_empresa text,p_obra integer,p_contextos jsonb,p_version timestamptz)
returns timestamptz language sql security invoker set search_path='' as $$
 select private.guardar_correos_obra(p_empresa,p_obra,p_contextos,p_version)
$$;
revoke all on function public.guardar_correos_obra(text,integer,jsonb,timestamptz) from public,anon;
grant execute on function public.guardar_correos_obra(text,integer,jsonb,timestamptz) to authenticated;
