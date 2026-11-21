-- Each journal belongs to an actual report, never just to a work/date.
create table if not exists private.progress_report_activities (
 report_id integer primary key references public.avances_produccion_partidas(id) on delete cascade,
 entries jsonb not null default '[]', revision integer not null default 1,
 updated_by uuid not null, updated_at timestamptz not null default now()
);
alter table private.progress_report_activities enable row level security;
revoke all on private.progress_report_activities from public,anon,authenticated;
alter table private.progress_activity_audit add column if not exists report_id integer;
create index if not exists progress_activity_audit_report on private.progress_activity_audit(report_id);
create or replace function private.report_progress_activities(p_report integer,p_entries jsonb default null,p_revision integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.avances_produccion_partidas%rowtype; rev integer; x jsonb; a integer; b integer; last_end integer:=-1; pid integer; label text; result jsonb:='[]'; editable boolean;
begin
 select * into r from public.avances_produccion_partidas where id=p_report;
 if auth.uid() is null or r.id is null
 or not coalesce(private.rrhh_partidas_permiso(r.empresa,r.obra_id,'ver'),false)
 or not coalesce(private.obraxis_permission(r.empresa,'obras.avances.ver'),false) then raise exception 'No autorizado para este reporte';end if;
 editable:=coalesce(private.obraxis_permission(r.empresa,'obras.avances.editar'),false);
 if p_entries is not null then perform pg_advisory_xact_lock(78236,p_report);end if;
 select revision,entries into rev,result from private.progress_report_activities where report_id=p_report;
 if p_entries is not null then
  if not editable then raise exception 'Sin permiso para editar este reporte';end if;
  if p_revision is distinct from coalesce(rev,0) then raise exception 'Otro usuario modificó las actividades. Recarga antes de guardar';end if;
  if jsonb_typeof(p_entries)<>'array' then raise exception 'Registro inválido';end if;
  result:='[]';
  for x in select value from jsonb_array_elements(p_entries) order by value->>'inicio' loop
   if coalesce(x->>'inicio','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(x->>'termino','')!~'^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$' then raise exception 'Indica inicio y término en formato HH:MM';end if;
   a:=split_part(x->>'inicio',':',1)::integer*60+split_part(x->>'inicio',':',2)::integer;
   b:=split_part(x->>'termino',':',1)::integer*60+split_part(x->>'termino',':',2)::integer;
   if b<=a or a<last_end then raise exception 'Revisa los horarios: término posterior al inicio y sin superponer actividades';end if;
   last_end:=b;pid:=nullif(x->>'partida_id','')::integer;label:=btrim(x->>'actividad');
   if pid is not null then
    select partida into label from public.partidas_obra where id=pid and obra_id=r.obra_id and empresa=r.empresa and not coalesce(es_titulo,false) and coalesce(unidad,'') not in ('TITULO','GRUPO');
    if not found then raise exception 'La partida no pertenece a esta obra';end if;
   end if;
   if label is null or length(label) not between 1 and 300 then raise exception 'Completa el nombre de cada actividad';end if;
   result:=result||jsonb_build_array(jsonb_build_object('inicio',x->>'inicio','termino',x->>'termino','actividad',label,'partida_id',pid,'minutos',b-a));
   if pid is null then insert into private.progress_activity_catalog(obra_id,nombre) values(r.obra_id,label) on conflict do nothing;end if;
  end loop;
  insert into private.progress_report_activities(report_id,entries,revision,updated_by) values(p_report,result,1,auth.uid())
  on conflict(report_id) do update set entries=excluded.entries,revision=private.progress_report_activities.revision+1,updated_by=auth.uid(),updated_at=now() returning revision into rev;
  insert into private.progress_activity_audit(obra_id,fecha,revision,actor,entries,report_id) values(r.obra_id,(r.created_at at time zone 'America/Santiago')::date,rev,auth.uid(),result,p_report);
 end if;
 return jsonb_build_object('revision',coalesce(rev,0),'can_write',editable,'entries',coalesce(result,'[]'),
 'catalog',coalesce((select jsonb_agg(jsonb_build_object('nombre',nombre) order by nombre) from private.progress_activity_catalog where obra_id=r.obra_id),'[]'),
 'parts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'partida',partida) order by partida) from public.partidas_obra where obra_id=r.obra_id and empresa=r.empresa and not coalesce(es_titulo,false) and coalesce(unidad,'') not in ('TITULO','GRUPO')),'[]'));
end $$;
revoke all on function private.report_progress_activities(integer,jsonb,integer) from public,anon;
grant execute on function private.report_progress_activities(integer,jsonb,integer) to authenticated;
create or replace function public.report_progress_activities(p_report integer,p_entries jsonb default null,p_revision integer default null)
returns jsonb language sql security invoker set search_path='' as $$select private.report_progress_activities(p_report,p_entries,p_revision)$$;
revoke all on function public.report_progress_activities(integer,jsonb,integer) from public,anon;
grant execute on function public.report_progress_activities(integer,jsonb,integer) to authenticated;
