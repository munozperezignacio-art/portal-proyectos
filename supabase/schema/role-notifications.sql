create table if not exists public.role_notifications(
 empresa text not null,role_id integer not null references public.roles(id) on delete cascade,
 settings jsonb not null default '{}',updated_at timestamptz not null default now(),primary key(empresa,role_id));
alter table public.role_notifications enable row level security;
create policy role_notifications_read on public.role_notifications for select to authenticated using(private.obraxis_actor_can_access_company(empresa));
create policy role_notifications_write on public.role_notifications for all to authenticated using(private.obraxis_actor_can_manage_company(empresa)) with check(private.obraxis_actor_can_manage_company(empresa));
grant select,insert,update,delete on public.role_notifications to authenticated;
revoke all on public.role_notifications from anon;
alter table public.notificaciones_entregas add column if not exists role_route_key text;
create unique index if not exists notification_role_route_key on public.notificaciones_entregas(role_route_key) where role_route_key is not null;

create or replace function public.save_role_notifications(p_company text,p_role integer,p_settings jsonb,p_expected jsonb)
returns void language plpgsql security invoker set search_path=public,pg_temp as $$
declare prior jsonb; item record; x text; name text; scheduled text; source_id uuid; targets jsonb;
begin
 if auth.uid() is null or not coalesce(private.obraxis_actor_can_manage_company(p_company),false) then raise exception 'No autorizado para configurar notificaciones';end if;
 select nombre into name from public.roles where id=p_role and empresa=p_company and not coalesce(archivado,false);
 if name is null then raise exception 'Rol no disponible';end if;
 perform pg_advisory_xact_lock(hashtextextended('role-notifications:'||p_company,0));
 select settings into prior from public.role_notifications where empresa=p_company and role_id=p_role;
 if coalesce(prior,'{}') is distinct from coalesce(p_expected,'{}') then raise exception 'La configuración cambió. Recarga antes de guardar';end if;
 if jsonb_typeof(p_settings)<>'object' then raise exception 'Configuración inválida';end if;
 for item in select * from jsonb_each(p_settings) loop
  if item.key not in ('asistencia_registrada','material_registrado','mantenimiento_registrado','maquinaria_falla_reportada','solicitudes_actualizacion','obra_reporte_avance','obra_reporte_maquinaria','obra_alerta_plazo','obra_alerta_sobrecosto','obra_alerta_sin_avance','avance_reporte_pendiente','maquinaria_reporte_pendiente','reportes_diarios_pendientes','especialidad_jornada_abierta','maquinaria_termino_obra','gastos_imputacion_pendiente','rrhh_imputacion_pendiente','maquinaria_imputacion_pendiente','prevencion_registro_recibido','prevencion_cumplimiento_pendiente','enex_pendiente','ep_subcontrato_documentos_pendientes','ep_subcontrato_documento_observado','ep_subcontrato_expediente_aprobado') then raise exception 'Acción no disponible';end if;
  if jsonb_typeof(item.value)<>'object' or item.value->>'works' not in ('all','assigned') or item.value->>'forms' not in ('all','selected') or item.value->>'equipment' not in ('all','selected') then raise exception 'Alcance inválido';end if;
  foreach x in array array['email','mobile','web'] loop
   if jsonb_typeof(item.value->x) is distinct from 'boolean' then raise exception 'Canal inválido';end if;
  end loop;
  if jsonb_typeof(item.value->'form_ids') is distinct from 'array' or jsonb_typeof(item.value->'equipment_ids') is distinct from 'array' then raise exception 'Selección inválida';end if;
  if item.value->>'forms'='selected' and jsonb_array_length(item.value->'form_ids')=0 then raise exception 'Selecciona al menos un formulario';end if;
  if item.value->>'equipment'='selected' and jsonb_array_length(item.value->'equipment_ids')=0 then raise exception 'Selecciona al menos un equipo';end if;
  if exists(select 1 from jsonb_array_elements_text(item.value->'form_ids') selected_id(value) where not exists(select 1 from public.prevencion_formularios f where f.empresa=p_company and f.id::text=selected_id.value)) then raise exception 'Formulario ajeno a la empresa';end if;
  if exists(select 1 from jsonb_array_elements_text(item.value->'equipment_ids') selected_id(value) where not exists(select 1 from public.inventario_maquinaria e where e.empresa=p_company and e.id::text=selected_id.value)) then raise exception 'Equipo ajeno a la empresa';end if;
 end loop;
 insert into public.role_notifications(empresa,role_id,settings) values(p_company,p_role,p_settings)
 on conflict(empresa,role_id) do update set settings=excluded.settings,updated_at=now();
 -- Existing scheduled detectors produce source events; the router owns the channels.
 foreach scheduled in array array['avance_reporte_pendiente','maquinaria_reporte_pendiente','reportes_diarios_pendientes','especialidad_jornada_abierta','gastos_imputacion_pendiente','rrhh_imputacion_pendiente','maquinaria_imputacion_pendiente','prevencion_cumplimiento_pendiente'] loop
  select coalesce(jsonb_agg(r.nombre),'[]') into targets from public.role_notifications n join public.roles r on r.id=n.role_id and r.empresa=n.empresa where n.empresa=p_company and not coalesce(r.archivado,false)
  and (coalesce((n.settings->scheduled->>'email')::boolean,false) or coalesce((n.settings->scheduled->>'mobile')::boolean,false) or coalesce((n.settings->scheduled->>'web')::boolean,false));
  select id into source_id from public.notificaciones_reglas where empresa=p_company and evento_codigo=scheduled and condiciones->>'origen'='notificaciones_rol_fuente' limit 1;
  if scheduled='prevencion_cumplimiento_pendiente' and source_id is null and exists(select 1 from public.notificaciones_reglas where empresa=p_company and evento_codigo=scheduled) then
   if jsonb_array_length(targets)>0 then update public.notificaciones_reglas set activa=true where empresa=p_company and evento_codigo=scheduled;end if;
   continue;
  end if;
  if source_id is null and jsonb_array_length(targets)>0 then
   insert into public.notificaciones_reglas(empresa,nombre,evento_codigo,modulo,destinatarios_roles,canal_email,canal_plataforma,canal_push,activa,frecuencia,hora_envio,condiciones)
   values(p_company,'Notificaciones por rol · '||scheduled,scheduled,'Roles',targets,false,true,false,true,'Diaria',case when scheduled='especialidad_jornada_abierta' then '20:00'::time else '18:00'::time end,'{"origen":"notificaciones_rol_fuente","alcance_tipo":"todas"}');
  elsif source_id is not null then update public.notificaciones_reglas set destinatarios_roles=targets,activa=jsonb_array_length(targets)>0 where id=source_id;end if;
 end loop;
end $$;
revoke all on function public.save_role_notifications(text,integer,jsonb,jsonb) from public,anon;
grant execute on function public.save_role_notifications(text,integer,jsonb,jsonb) to authenticated;

-- Server-only fanout. Each event/user/channel is reserved once; it never sends mail inline.
create or replace function private.route_role_notification(company text,code text,work text,title text,data jsonb,event_key text,owner text default null)
returns void language plpgsql security definer set search_path='' as $$
declare target record; setting jsonb; channels jsonb; safe_payload jsonb; channel text;
begin
 for target in select u.id,u.usuario,u.correo,u.rol,u.obras,n.role_id,n.settings->code config
 from public.role_notifications n join public.roles r on r.id=n.role_id and r.empresa=n.empresa and not coalesce(r.archivado,false)
 join public.usuarios u on u.empresa=r.empresa and u.rol=r.nombre
 where n.empresa=company and n.settings ? code loop
  setting:=target.config;
  if code in ('enex_pendiente','solicitudes_actualizacion') then
   if owner is null or owner not in (target.id::text,target.usuario,target.correo) then continue;end if;
  elsif setting->>'works'='assigned' and (nullif(work,'') is null or not exists(select 1 from unnest(string_to_array(coalesce(target.obras,''),',')) w where lower(trim(w)) in ('todas',lower(trim(work))))) then continue;end if;
  if setting->>'forms'='selected' and not coalesce(setting->'form_ids' ? (data->>'formulario_id'),false) then continue;end if;
  if setting->>'equipment'='selected' and not coalesce(setting->'equipment_ids' ? (data->>'equipo_id'),false) then continue;end if;
  channels:=jsonb_build_object('email',setting->'email','mobile',setting->'mobile','web',setting->'web');
  safe_payload:=jsonb_build_object('event_id',event_key,'role_notification',true,'role_id',target.role_id,'role_name',target.rol,'channels',channels,'push_enabled',setting->'mobile','works_scope',setting->>'works','formulario_id',data->'formulario_id','equipo_id',data->'equipo_id','destination',data->'destination','detalle','Tienes un nuevo aviso. Consulta el registro con tus permisos habituales.');
  foreach channel in array array['Plataforma','Correo'] loop
   if channel='Correo' and (not coalesce((setting->>'email')::boolean,false) or nullif(target.correo,'') is null) then continue;end if;
   if channel='Plataforma' and not (coalesce((setting->>'web')::boolean,false) or coalesce((setting->>'mobile')::boolean,false)) then continue;end if;
   insert into public.notificaciones_entregas(empresa,evento_codigo,obra_nombre,canal,destinatario,asunto,estado,payload,enviada_at,role_route_key)
   values(company,code,work,channel,case when channel='Correo' then target.correo else target.id::text end,title,case when channel='Correo' then 'Pendiente' else 'Enviada' end,safe_payload,case when channel='Plataforma' then now() end,md5(company||':'||code||':'||event_key||':'||target.id||':'||channel))
   on conflict(role_route_key) where role_route_key is not null do nothing;
  end loop;
 end loop;
end $$;
revoke all on function private.route_role_notification(text,text,text,text,jsonb,text,text) from public,anon,authenticated;

create or replace function private.route_existing_notification()
returns trigger language plpgsql security definer set search_path='' as $$
declare k text; origin text;
begin
 if pg_trigger_depth()>1 and new.role_route_key is not null then return new;end if;
 -- A client cannot forge routing flags.
 new.role_route_key:=null;new.payload:=coalesce(new.payload,'{}')-'role_notification'-'channels'-'role_id'-'role_name';
 select condiciones->>'origen' into origin from public.notificaciones_reglas where id=new.regla_id;
 k:=coalesce(new.payload->>'event_id',md5(coalesce(new.obra_nombre,'')||new.asunto||new.payload::text||((now() at time zone 'America/Santiago')::date)::text));
 perform private.route_role_notification(new.empresa,new.evento_codigo,new.obra_nombre,new.asunto,new.payload,k,new.destinatario);
 if origin='notificaciones_rol_fuente' then return null;end if;
 if exists(select 1 from public.usuarios u join public.roles r on r.empresa=u.empresa and r.nombre=u.rol join public.role_notifications n on n.empresa=u.empresa and n.role_id=r.id
 where u.empresa=new.empresa and new.destinatario in (u.id::text,u.usuario,u.correo) and n.settings ? new.evento_codigo) then return null;end if;
 return new;
end $$;
revoke all on function private.route_existing_notification() from public,anon,authenticated;
create trigger a_role_notification_router before insert on public.notificaciones_entregas for each row execute function private.route_existing_notification();

-- A received form has an authoritative company through its template.
create or replace function private.notify_role_form_response()
returns trigger language plpgsql security definer set search_path='' as $$
declare company text; work text;
begin
 select empresa into company from public.prevencion_formularios where id=new.formulario_id;
 select nombre into work from public.obras where id=new.obra_id and empresa=company;
 perform private.route_role_notification(company,'prevencion_registro_recibido',work,'Nuevo formulario recibido',
 jsonb_build_object('formulario_id',new.formulario_id,'destination','prevencion'), 'form:'||new.id);
 return new;
end $$;
revoke all on function private.notify_role_form_response() from public,anon,authenticated;
create trigger role_form_response after insert on public.prevencion_respuestas for each row execute function private.notify_role_form_response();
create or replace function private.emit_work_notification(p_company text,p_work integer,p_key text,p_code text,p_title text,p_payload jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare event_id uuid; work_name text;
begin
 if p_code='obra_reporte_maquinaria' and p_payload ? 'reporte_id' then p_payload:=p_payload||jsonb_build_object('equipo_id',(select equipo_id from public.maquinaria_uso_diario where id::text=p_payload->>'reporte_id' and empresa=p_company));end if;
 select nombre into strict work_name from public.obras where id=p_work and empresa=p_company;
 insert into private.obra_notification_events(empresa,obra_id,event_key) values(p_company,p_work,p_key)
 on conflict(empresa,obra_id,event_key) do nothing returning id into event_id;
 if event_id is null then return; end if;
 perform private.route_role_notification(p_company,p_code,work_name,p_title,p_payload,event_id::text);
 insert into public.notificaciones_entregas(empresa,obra_nombre,evento_codigo,canal,destinatario,asunto,estado,payload,enviada_at)
 select p_company,work_name,p_code,'Plataforma',u.id::text,p_title,'Enviada',
 p_payload||jsonb_build_object('event_id',event_id,'obra_id',p_work,'operational_event',true,'push_enabled',true),now()
 from public.usuarios u left join public.roles r on r.empresa=u.empresa and r.nombre=u.rol
 where u.empresa=p_company and not coalesce(r.archivado,false)
 and u.auth_user_id is distinct from nullif(p_payload->>'actor_auth_user_id','')::uuid
 and lower(coalesce(u.rol_base,r.rol_base,u.rol,'')) in ('administrador de empresa','administrador empresa','administrador de contratos','administrador de contrato','administrador contratos','administrador contrato')
 and exists(select 1 from unnest(string_to_array(coalesce(u.obras,''),',')) v where lower(trim(v)) in ('todas',lower(work_name)));
end $$;
revoke all on function private.emit_work_notification(text,integer,text,text,text,jsonb) from public,anon,authenticated;
-- Authoritative record events, without exposing salaries, answers, signatures or GPS.
create or replace function private.notify_role_work_record()
returns trigger language plpgsql security definer set search_path='' as $$
declare data jsonb:=to_jsonb(new); code text:=tg_argv[0]; title text:=tg_argv[1];
begin
 if nullif(data->>'empresa','') is null then return new;end if;
 perform private.route_role_notification(data->>'empresa',code,data->>'obra_nombre',title,
 jsonb_build_object('equipo_id',data->'equipo_id','destination',tg_argv[2]),
 tg_table_name||':'||(data->>'id'));
 return new;
end $$;
revoke all on function private.notify_role_work_record() from public,anon,authenticated;
create trigger role_maintenance after insert on public.maquinaria_mantenciones for each row execute function private.notify_role_work_record('mantenimiento_registrado','Mantención registrada','maquinaria');
create trigger role_equipment_failure after insert on public.maquinaria_fallas for each row execute function private.notify_role_work_record('maquinaria_falla_reportada','Falla de equipo reportada','maquinaria');
create trigger role_material after insert on public.inventario_materiales for each row execute function private.notify_role_work_record('material_registrado','Movimiento de materiales registrado','gestion');
create trigger role_attendance after insert on public.asistencia_personal for each row execute function private.notify_role_work_record('asistencia_registrada','Asistencia registrada','personal');

-- Explicit legacy recipients outside the platform are preserved. A configured platform role
-- is delivered exclusively by the role router, avoiding duplicate emails and bypasses.
create or replace function public.filter_legacy_notification_emails(p_company text,p_code text,p_emails text[])
returns text[] language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if current_user not in ('postgres','service_role') and (auth.uid() is null or not coalesce(private.obraxis_actor_can_access_company(p_company),false)) then raise exception 'No autorizado';end if;
 return array(select distinct lower(trim(email)) from unnest(coalesce(p_emails,'{}')) email where not exists(
 select 1 from public.usuarios u join public.roles r on r.empresa=u.empresa and r.nombre=u.rol join public.role_notifications n on n.role_id=r.id and n.empresa=u.empresa
 where u.empresa=p_company and lower(trim(u.correo))=lower(trim(email)) and n.settings ? p_code));
end $$;
revoke all on function public.filter_legacy_notification_emails(text,text,text[]) from public,anon;
grant execute on function public.filter_legacy_notification_emails(text,text,text[]) to authenticated,service_role;
create or replace function private.notify_role_attendance_batch()
returns trigger language plpgsql security definer set search_path='' as $$
declare batch record;
begin
 for batch in select empresa,obra_nombre,min(id) first_id,count(*) quantity from role_attendance_rows where empresa is not null group by empresa,obra_nombre loop
  perform private.route_role_notification(batch.empresa,'asistencia_registrada',batch.obra_nombre,'Asistencia registrada',
   jsonb_build_object('destination','personal'),'attendance-batch:'||batch.first_id);
 end loop;
 return null;
end $$;
revoke all on function private.notify_role_attendance_batch() from public,anon,authenticated;
drop trigger if exists role_attendance on public.asistencia_personal;
create trigger role_attendance after insert on public.asistencia_personal referencing new table as role_attendance_rows for each statement execute function private.notify_role_attendance_batch();


