-- Operational notifications: one event/recipient, authored on the server.
create table if not exists private.obra_notification_events (
 id uuid primary key default gen_random_uuid(), empresa text not null,
 obra_id integer not null references public.obras(id), event_key text not null,
 created_at timestamptz not null default now(), unique(empresa,obra_id,event_key)
);
alter table private.obra_notification_events enable row level security;
revoke all on private.obra_notification_events from public,anon,authenticated;

create or replace function private.emit_work_notification(p_company text,p_work integer,p_key text,p_code text,p_title text,p_payload jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare event_id uuid; work_name text;
begin
 select nombre into strict work_name from public.obras where id=p_work and empresa=p_company;
 insert into private.obra_notification_events(empresa,obra_id,event_key) values(p_company,p_work,p_key)
 on conflict(empresa,obra_id,event_key) do nothing returning id into event_id;
 if event_id is null then return; end if;
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

create or replace function private.notify_progress_report() returns trigger
language plpgsql security definer set search_path='' as $$
declare batch record;
begin
 for batch in select empresa,obra_id,min(id) first_id,array_agg(id order by id) ids,
 string_agg(partida||': '||cantidad::text||' '||coalesce(unidad,''),E'\n' order by id) detail
 from new_reports where obra_id is not null group by empresa,obra_id loop
  perform private.emit_work_notification(batch.empresa,batch.obra_id,'avance:'||batch.first_id,'obra_reporte_avance','Nuevo reporte de avance',
   jsonb_build_object('actor_auth_user_id',auth.uid(),'reporte_ids',to_jsonb(batch.ids),'destination','avance','detalle',batch.detail,'prioridad','normal'));
 end loop;
 return null;
end $$;
revoke all on function private.notify_progress_report() from public,anon,authenticated;
drop trigger if exists work_report_notification on public.avances_produccion_partidas;
create trigger work_report_notification after insert on public.avances_produccion_partidas referencing new table as new_reports for each statement execute function private.notify_progress_report();

create or replace function private.notify_equipment_report() returns trigger
language plpgsql security definer set search_path='' as $$
declare work_id integer;
begin
 select id into work_id from public.obras where empresa=new.empresa and nombre=new.obra_nombre;
 if work_id is not null then
  perform private.emit_work_notification(new.empresa,work_id,'maquinaria:'||new.id,'obra_reporte_maquinaria','Nuevo reporte de maquinaria',
   jsonb_build_object('actor_auth_user_id',auth.uid(),'reporte_id',new.id,'destination','maquinaria','detalle',format('%s · %s · %s horas. %s',coalesce(new.equipo_patente,new.equipo_id),to_char(new.fecha,'DD-MM-YYYY'),new.horas_trabajadas,coalesce(new.observaciones,'')),'prioridad','normal'));
 end if;
 return new;
end $$;
revoke all on function private.notify_equipment_report() from public,anon,authenticated;
drop trigger if exists equipment_report_notification on public.maquinaria_uso_diario;
create trigger equipment_report_notification after insert on public.maquinaria_uso_diario for each row execute function private.notify_equipment_report();

-- Called only with the complete, current global statistics, never historical filters.
create or replace function private.sync_work_alerts(p_company text,p_work integer,p_cutoff date,p_alerts jsonb)
returns void language plpgsql security definer set search_path='' as $$
declare a jsonb; part text; code text; detail text;
begin
 if auth.uid() is null or not coalesce(private.rrhh_partidas_permiso(p_company,p_work,'aprobar'),false) then raise exception 'No autorizado';end if;
 if p_cutoff<>(now() at time zone 'America/Santiago')::date then raise exception 'Solo se notifican alertas del corte actual';end if;
 if jsonb_typeof(p_alerts)<>'array' or jsonb_array_length(p_alerts)>500 then raise exception 'Alertas inválidas';end if;
 for a in select value from jsonb_array_elements(p_alerts) loop
  part:=a->>'partida';code:=a->>'tipo';detail:=a->>'detalle';
  if code not in ('sobrecosto','plazo','sin_avance') or length(part) not between 1 and 500 or length(detail) not between 1 and 2000 then raise exception 'Alerta inválida';end if;
  perform private.emit_work_notification(p_company,p_work,'alerta:'||code||':'||part,'obra_alerta_'||code,'Alerta de obra · '||part,
   jsonb_build_object('partida',part,'destination','estadisticas:costos','detalle',detail,'fecha_corte',p_cutoff,'prioridad',case when code='sobrecosto' then 'alta' else 'media' end));
 end loop;
end $$;
revoke all on function private.sync_work_alerts(text,integer,date,jsonb) from public,anon;
grant execute on function private.sync_work_alerts(text,integer,date,jsonb) to authenticated;
create or replace function public.sync_work_alerts(p_company text,p_work integer,p_cutoff date,p_alerts jsonb)
returns void language sql security invoker set search_path='' as $$select private.sync_work_alerts(p_company,p_work,p_cutoff,p_alerts)$$;
revoke all on function public.sync_work_alerts(text,integer,date,jsonb) from public,anon;
grant execute on function public.sync_work_alerts(text,integer,date,jsonb) to authenticated;
