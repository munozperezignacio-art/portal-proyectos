-- Uses the existing notification-rule editor, delivery ledger and scheduled worker.
create table if not exists private.specialty_notice_claims (
 clave text primary key, created_at timestamptz not null default now()
);
create table if not exists private.specialty_email_outbox (
 id uuid primary key default gen_random_uuid(), clave text not null unique,
 empresa text not null, destinatario text not null, asunto text not null, payload jsonb not null,
 estado text not null default 'pending' check(estado in ('pending','sending','accepted','uncertain','failed')),
 provider_id text, error text, created_at timestamptz not null default now()
);
alter table private.specialty_notice_claims enable row level security;
alter table private.specialty_email_outbox enable row level security;
revoke all on private.specialty_notice_claims,private.specialty_email_outbox from public,anon,authenticated;

create or replace function private.specialty_work_email_config(p_company text,p_work integer,p_name text) returns jsonb language plpgsql security definer set search_path='' as $$
declare c jsonb; ctx jsonb; local_setting jsonb; global_setting jsonb; emails jsonb:='[]'; allow_rules boolean:=false;
begin
 select to_jsonb(t) into c from public.config_empresa t where empresa=p_company limit 1;
 c:=coalesce(c,'{}');ctx:=coalesce(c->'correos_contextuales'->('obra:'||p_work),c->'correos_contextuales'->('avances_obra:'||p_name),'{}');
 local_setting:=ctx->'events'->'avance_registrado';
 if local_setting is null then
  allow_rules:=true;
  if ctx?'autoNotify' then local_setting:=ctx;
  else local_setting:=jsonb_build_object('autoNotify',coalesce((c->>'notificaciones_automaticas')::boolean,true),'emails',to_jsonb(string_to_array(coalesce(c->>'email_notificaciones',''),',')),'emailsCC',to_jsonb(string_to_array(coalesce(c->>'email_notificaciones_cc',''),',')));end if;
 end if;
 allow_rules:=allow_rules and coalesce((local_setting->>'autoNotify')::boolean,false);
 if coalesce((local_setting->>'autoNotify')::boolean,false) then emails:=coalesce(local_setting->'emails','[]')||coalesce(local_setting->'emailsCC','[]');end if;
 global_setting:=c->'correos_contextuales'->'obras:global'->'events'->'avance_registrado';
 if coalesce((global_setting->>'autoNotify')::boolean,false) then emails:=emails||coalesce(global_setting->'emails','[]')||coalesce(global_setting->'emailsCC','[]');end if;
 return jsonb_build_object('emails',emails,'allow_rules',allow_rules);
end $$;
revoke all on function private.specialty_work_email_config(text,integer,text) from public,anon,authenticated;

create or replace function private.specialty_collect_notifications(p_now timestamptz default now()) returns jsonb language plpgsql security definer set search_path='' as $$
declare s record; r public.notificaciones_reglas%rowtype; u record; target text; k text; claim text;
payload jsonb; title text; mail_config jsonb; stamp timestamp:=(p_now at time zone 'America/Santiago'); day date:=stamp::date; result jsonb;
begin
 for s in select j.*,o.empresa,o.nombre,p.partida from private.specialty_sessions j join public.obras o on o.id=j.obra_id join public.partidas_obra p on p.id=j.partida_id where j.estado in ('abierta','cerrada') loop
  if s.estado='cerrada' then
   insert into private.specialty_notice_claims(clave) values('closed:'||s.id) on conflict do nothing returning clave into claim;
   if claim is null then continue;end if;
   mail_config:=private.specialty_work_email_config(s.empresa,s.obra_id,s.nombre);
   title:='Reporte de pilas de grava · '||s.nombre;
   payload:=jsonb_build_object('sesion_id',s.id,'obra_id',s.obra_id,'obra',s.nombre,'empresa',s.empresa,'partida',s.partida,'fecha',s.fecha,'destination','avance','operational_event',true,'detalle','Jornada cerrada; avance consolidado. Calidad continúa por separado.','datos',s.datos,'actor_auth_user_id',s.responsable,'elements',(select coalesce(jsonb_agg(to_jsonb(e)),'[]') from private.specialty_elements e where e.obra_id=s.obra_id and e.partida_id=s.partida_id));
   for target in select lower(trim(value)) from jsonb_array_elements_text(mail_config->'emails') loop
    if target ~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$' and not exists(select 1 from public.usuarios sender where sender.empresa=s.empresa and sender.auth_user_id=s.responsable and lower(trim(sender.correo))=target) then
     insert into private.specialty_email_outbox(clave,empresa,destinatario,asunto,payload) values('mail:'||s.id||':close:'||target,s.empresa,target,title,payload) on conflict do nothing;
    end if;
   end loop;
  end if;
  for r in select * from public.notificaciones_reglas where empresa=s.empresa and activa and evento_codigo=case when s.estado='abierta' then 'especialidad_jornada_abierta' else 'avance_registrado' end loop
   if coalesce(r.condiciones->>'alcance_tipo',case when r.obra_nombre is null then 'todas' else 'seleccionadas' end)='seleccionadas'
    and r.obra_nombre is distinct from s.nombre and not coalesce(r.condiciones->'obras_seleccionadas','[]'::jsonb)?s.nombre then continue;end if;
   if s.estado='abierta' and (extract(isodow from day)>5 or stamp::time<coalesce(r.hora_envio,time '20:00') or s.fecha>day or coalesce(r.condiciones->'dias_no_laborales','[]'::jsonb)?day::text) then continue;end if;
   title:=case when s.estado='abierta' then 'Jornada de especialidad sin cerrar' else 'Reporte de pilas de grava' end||' · '||s.nombre;
   payload:=jsonb_build_object('sesion_id',s.id,'obra_id',s.obra_id,'obra',s.nombre,'empresa',s.empresa,'partida',s.partida,'fecha',s.fecha,'destination','avance','operational_event',true,'detalle',case when s.estado='abierta' then 'La jornada sigue abierta. Si la cerraste sin conexión, sincroniza el dispositivo.' else 'Jornada cerrada; el avance fue consolidado. Calidad continúa por separado.' end);
   if s.estado='cerrada' then
    payload:=payload||jsonb_build_object('datos',s.datos,'elements',(select coalesce(jsonb_agg(to_jsonb(e)),'[]') from private.specialty_elements e where e.obra_id=s.obra_id and e.partida_id=s.partida_id),'actor_auth_user_id',s.responsable);
   end if;
   for u in select recipient.id,recipient.correo,recipient.auth_user_id from public.usuarios recipient where recipient.empresa=s.empresa
    and exists(select 1 from unnest(string_to_array(recipient.obras,',')) a where lower(trim(a)) in ('todas',lower(s.nombre)))
    and ((s.estado='abierta' and recipient.auth_user_id=s.responsable) or coalesce(r.destinatarios_usuarios,'[]'::jsonb)?recipient.id::text or coalesce(r.destinatarios_roles,'[]'::jsonb)?recipient.rol)
    and (s.estado='abierta' or recipient.auth_user_id is distinct from s.responsable) loop
    k:=s.id||':'||case when s.estado='abierta' then day::text else 'close' end||':'||u.id;
    if (coalesce(r.canal_plataforma,false) or coalesce(r.canal_push,false)) and not (s.estado='cerrada' and exists(select 1 from public.notificaciones_entregas n where n.empresa=s.empresa and n.destinatario=u.id::text and n.evento_codigo='obra_reporte_avance' and (n.payload->'reporte_ids') @> to_jsonb(s.report_ids))) then
     insert into private.specialty_notice_claims(clave) values('platform:'||k) on conflict do nothing returning clave into claim;
     if claim is not null then insert into public.notificaciones_entregas(regla_id,empresa,evento_codigo,obra_nombre,canal,destinatario,asunto,estado,payload,enviada_at)
      values(r.id,s.empresa,r.evento_codigo,s.nombre,'Plataforma',u.id::text,title,'Enviada',payload,now());end if;
    end if;
    if r.canal_email and (s.estado='abierta' or coalesce((mail_config->>'allow_rules')::boolean,false)) and nullif(u.correo,'') is not null then
     insert into private.specialty_email_outbox(clave,empresa,destinatario,asunto,payload) values('mail:'||s.id||':'||case when s.estado='abierta' then day::text else 'close' end||':'||lower(u.correo),s.empresa,u.correo,title,payload) on conflict do nothing;
    end if;
   end loop;
   if r.canal_email and (s.estado='abierta' or coalesce((mail_config->>'allow_rules')::boolean,false)) and coalesce(r.condiciones->>'alcance_tipo','todas')<>'asignadas' then
    for target in select lower(trim(value)) from jsonb_array_elements_text(coalesce(r.correos_adicionales,'[]'::jsonb)) loop
     if position('@' in target)>1 and (s.estado='abierta' or not exists(select 1 from public.usuarios sender where sender.empresa=s.empresa and sender.auth_user_id=s.responsable and lower(trim(sender.correo))=target)) then insert into private.specialty_email_outbox(clave,empresa,destinatario,asunto,payload) values('mail:'||s.id||':'||case when s.estado='abierta' then day::text else 'close' end||':'||target,s.empresa,target,title,payload) on conflict do nothing;end if;
    end loop;
   end if;
  end loop;
 end loop;
 -- Reserve before network I/O. Never automatically retry sending/uncertain rows.
 with claimed as (update private.specialty_email_outbox set estado='sending' where id in (select id from private.specialty_email_outbox where estado='pending' order by created_at for update skip locked limit 30) returning *) select coalesce(jsonb_agg(to_jsonb(claimed)),'[]') into result from claimed;
 return result;
end $$;
revoke all on function private.specialty_collect_notifications(timestamptz) from public,anon,authenticated;
grant execute on function private.specialty_collect_notifications(timestamptz) to service_role;
create or replace function public.specialty_collect_notifications() returns jsonb language sql security invoker set search_path='' as $$select private.specialty_collect_notifications()$$;
revoke all on function public.specialty_collect_notifications() from public,anon,authenticated;
grant execute on function public.specialty_collect_notifications() to service_role;

create or replace function private.specialty_email_result(p_id uuid,p_status text,p_provider text default null,p_error text default null) returns void language plpgsql security definer set search_path='' as $$
begin
 if p_status not in ('accepted','uncertain','failed') then raise exception 'Estado inválido';end if;
 update private.specialty_email_outbox set estado=p_status,provider_id=p_provider,error=p_error where id=p_id and estado='sending';
end $$;
revoke all on function private.specialty_email_result(uuid,text,text,text) from public,anon,authenticated;
grant execute on function private.specialty_email_result(uuid,text,text,text) to service_role;
create or replace function public.specialty_email_result(p_id uuid,p_status text,p_provider text default null,p_error text default null) returns void language sql security invoker set search_path='' as $$select private.specialty_email_result(p_id,p_status,p_provider,p_error)$$;
revoke all on function public.specialty_email_result(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.specialty_email_result(uuid,text,text,text) to service_role;
