-- Operational specialty responsibilities are role-scoped, never user overrides.
create or replace function private.specialty_role_can(p_work integer,p_duty text)
returns boolean language sql stable security definer set search_path='' as $$
 select p_duty in ('ejecucion','topografia','calidad') and exists(
  select 1 from public.obras w
  join public.usuarios u on u.empresa=w.empresa and u.auth_user_id=auth.uid()
  join public.roles r on r.empresa=u.empresa and r.nombre=u.rol and not coalesce(r.archivado,false)
  where w.id=p_work and r.permisos->('responsabilidad.especialidad.'||p_duty)='true'::jsonb
  and exists(select 1 from unnest(string_to_array(u.obras,',')) x where lower(trim(x)) in ('todas',lower(trim(w.nombre))))
 );
$$;
revoke all on function private.specialty_role_can(integer,text) from public,anon,authenticated;

create or replace function public.especialidad_responsabilidades_rol(p_empresa text,p_rol integer,p_codigos text[] default null,p_esperados text[] default null)
returns text[] language plpgsql security definer set search_path='' as $$
declare current_codes text[]; requested text[]; permissions jsonb; duty text;
begin
 if auth.uid() is null or not private.obraxis_actor_can_manage_company(p_empresa) then raise exception 'No tienes permiso para configurar roles de esta empresa';end if;
 select coalesce(permisos,'{}') into permissions from public.roles where id=p_rol and empresa=p_empresa and not coalesce(archivado,false) for update;
 if not found then raise exception 'Rol no disponible en esta empresa';end if;
 select coalesce(array_agg(c order by c),'{}') into current_codes from unnest(array['ejecucion','topografia','calidad']) c where permissions->('responsabilidad.especialidad.'||c)='true'::jsonb;
 if p_codigos is null then return current_codes;end if;
 select coalesce(array_agg(distinct c order by c),'{}') into requested from unnest(p_codigos)c;
 if exists(select 1 from unnest(requested)c where c not in ('ejecucion','topografia','calidad')) then raise exception 'Responsabilidad desconocida';end if;
 if current_codes is distinct from (select coalesce(array_agg(distinct c order by c),'{}') from unnest(p_esperados)c) then raise exception 'Otro administrador cambió las responsabilidades. Recarga antes de guardar';end if;
 foreach duty in array array['ejecucion','topografia','calidad'] loop
  permissions:=permissions||jsonb_build_object('responsabilidad.especialidad.'||duty,duty=any(requested));
 end loop;
 update public.roles set permisos=permissions where id=p_rol and empresa=p_empresa;
 return requested;
end $$;
revoke all on function public.especialidad_responsabilidades_rol(text,integer,text[],text[]) from public,anon;
grant execute on function public.especialidad_responsabilidades_rol(text,integer,text[],text[]) to authenticated;

-- Fail closed if the installed API differs; no historical rows are rewritten.
do $migration$
declare definition text; old_text text; new_text text; replacements jsonb;
begin
 select pg_get_functiondef('private.specialty_api(integer,text,jsonb)'::regprocedure) into definition;
 replacements:=jsonb_build_array(
  jsonb_build_array('jsonb_build_object(''datos_fijos'',coalesce(work_defaults,t.datos_fijos))', 'jsonb_build_object(''datos_fijos'',coalesce(work_defaults,t.datos_fijos),''topografia'',case when private.specialty_role_can(p_work,''topografia'') then uid else null end,''calidad'',case when private.specialty_role_can(p_work,''calidad'') then uid else null end,''ejecucion'',case when private.specialty_role_can(p_work,''ejecucion'') then uid else null end)'),
  jsonb_build_array('''can_execute'',coalesce(private.obraxis_permission(w.empresa,''obras.avances.crear''),false)', '''can_execute'',(private.specialty_role_can(p_work,''ejecucion'') and coalesce(private.obraxis_permission(w.empresa,''obras.avances.crear''),false)),''can_topography'',private.specialty_role_can(p_work,''topografia''),''can_quality'',private.specialty_role_can(p_work,''calidad'')'),
  jsonb_build_array('not coalesce(private.obraxis_permission(w.empresa,''obras.avances.crear''),false)', 'not (private.specialty_role_can(p_work,''ejecucion'') and coalesce(private.obraxis_permission(w.empresa,''obras.avances.crear''),false))'),
  jsonb_build_array('uid is not distinct from cfg.calidad', 'private.specialty_role_can(p_work,''calidad'')'),
  jsonb_build_array('uid is distinct from cfg.topografia', 'not private.specialty_role_can(p_work,''topografia'')'),
  jsonb_build_array('uid=cfg.calidad', 'private.specialty_role_can(p_work,''calidad'')'),
  jsonb_build_array('uid=cfg.topografia', 'private.specialty_role_can(p_work,''topografia'')'),
  jsonb_build_array('uid is distinct from cfg.calidad', 'not private.specialty_role_can(p_work,''calidad'')'),
  jsonb_build_array('if p_action=''configure'' then', E'if p_action=''configure'' then\n  if nullif(p_data->>''ejecucion'','''') is not null or nullif(p_data->>''topografia'','''') is not null or nullif(p_data->>''calidad'','''') is not null then raise exception ''Los responsables se configuran por rol, no por persona'';end if;'),
  jsonb_build_array('do update set ejecucion=excluded.ejecucion,topografia=excluded.topografia,calidad=excluded.calidad,activa_desde=', 'do update set activa_desde=')
 );
 for old_text,new_text in select value->>0,value->>1 from jsonb_array_elements(replacements) loop
  if strpos(definition,old_text)=0 then raise exception 'API de especialidades incompatible: falta %',old_text;end if;
  definition:=replace(definition,old_text,new_text);
 end loop;
 execute definition;
end $migration$;
