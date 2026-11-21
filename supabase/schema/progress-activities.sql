-- One work-day journal shared by web/mobile. Private storage; checked RPC only.
create table if not exists private.progress_activity_days (
 obra_id integer not null references public.obras(id), fecha date not null,
 revision integer not null default 0, updated_by uuid not null, updated_at timestamptz not null default now(),
 primary key(obra_id,fecha)
);
create table if not exists private.progress_activity_catalog (
 id bigint generated always as identity primary key, obra_id integer not null references public.obras(id),
 nombre text not null check(length(btrim(nombre)) between 1 and 300)
);
create unique index if not exists progress_activity_catalog_name on private.progress_activity_catalog(obra_id,lower(btrim(nombre)));
create table if not exists private.progress_activity_entries (
 obra_id integer not null, fecha date not null, posicion integer not null,
 inicio integer not null check(inicio between 0 and 1439), termino integer not null check(termino between 1 and 1440),
 minutos integer generated always as (termino-inicio) stored,
 actividad text not null check(length(btrim(actividad)) between 1 and 300),
 partida_id integer references public.partidas_obra(id),
 primary key(obra_id,fecha,posicion), foreign key(obra_id,fecha) references private.progress_activity_days(obra_id,fecha),
 check(termino>inicio)
);
create table if not exists private.progress_activity_audit (
 id bigint generated always as identity primary key, obra_id integer not null, fecha date not null,
 revision integer not null, actor uuid not null, entries jsonb not null, created_at timestamptz not null default now()
);
alter table private.progress_activity_days enable row level security;
alter table private.progress_activity_catalog enable row level security;
alter table private.progress_activity_entries enable row level security;
alter table private.progress_activity_audit enable row level security;
revoke all on private.progress_activity_days,private.progress_activity_catalog,private.progress_activity_entries,private.progress_activity_audit from public,anon,authenticated;

create or replace function private.progress_activities(p_work integer,p_date date,p_entries jsonb default null,p_revision integer default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare w public.obras%rowtype; rev integer; x jsonb; a integer; b integer; last_end integer:=-1; pos integer:=0; pid integer; label text; editable boolean;
begin
 select * into w from public.obras where id=p_work;
 if auth.uid() is null or w.id is null or p_date is null
 or not coalesce(private.rrhh_partidas_permiso(w.empresa,w.id,'ver'),false)
 or not coalesce(private.obraxis_permission(w.empresa,'obras.avances.ver'),false) then raise exception 'No autorizado para esta obra';end if;
 if p_entries is not null then perform pg_advisory_xact_lock(78235,p_work);end if;
 select revision into rev from private.progress_activity_days where obra_id=p_work and fecha=p_date;
 editable:=coalesce(private.obraxis_permission(w.empresa,case when rev is null then 'obras.avances.crear' else 'obras.avances.editar' end),false);
 if p_entries is not null then
  if not editable then raise exception 'Sin permiso para guardar este registro de actividades';end if;
  if p_revision is distinct from coalesce(rev,0) then raise exception 'Otro usuario modificó las actividades. Recarga antes de guardar; no se sobrescribió su registro';end if;
  if jsonb_typeof(p_entries)<>'array' then raise exception 'Registro de actividades inválido';end if;
  insert into private.progress_activity_days(obra_id,fecha,revision,updated_by) values(p_work,p_date,1,auth.uid())
  on conflict(obra_id,fecha) do update set revision=private.progress_activity_days.revision+1,updated_by=auth.uid(),updated_at=now();
  delete from private.progress_activity_entries where obra_id=p_work and fecha=p_date;
  for x in select value from jsonb_array_elements(p_entries) order by value->>'inicio' loop
   if coalesce(x->>'inicio','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(x->>'termino','')!~'^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$' then raise exception 'Indica inicio y término en formato HH:MM';end if;
   a:=split_part(x->>'inicio',':',1)::integer*60+split_part(x->>'inicio',':',2)::integer;
   b:=split_part(x->>'termino',':',1)::integer*60+split_part(x->>'termino',':',2)::integer;
   if b<=a or a<last_end then raise exception 'Revisa los horarios: término posterior al inicio y sin superponer actividades';end if;
   last_end:=b;pos:=pos+1;pid:=nullif(x->>'partida_id','')::integer;
   label:=btrim(x->>'actividad');
   if pid is not null then
    select partida into label from public.partidas_obra where id=pid and obra_id=p_work and empresa=w.empresa and not coalesce(es_titulo,false) and coalesce(unidad,'') not in ('TITULO','GRUPO');
    if not found then raise exception 'La partida no pertenece a esta obra';end if;
   end if;
   if label is null or length(label) not between 1 and 300 then raise exception 'Completa el nombre de cada actividad (máximo 300 caracteres)';end if;
   insert into private.progress_activity_entries(obra_id,fecha,posicion,inicio,termino,actividad,partida_id) values(p_work,p_date,pos,a,b,label,pid);
   if pid is null then insert into private.progress_activity_catalog(obra_id,nombre) values(p_work,label) on conflict do nothing;end if;
  end loop;
  select revision into rev from private.progress_activity_days where obra_id=p_work and fecha=p_date;
  insert into private.progress_activity_audit(obra_id,fecha,revision,actor,entries) values(p_work,p_date,rev,auth.uid(),coalesce((select jsonb_agg(to_jsonb(e) order by posicion) from private.progress_activity_entries e where obra_id=p_work and fecha=p_date),'[]'));
  editable:=coalesce(private.obraxis_permission(w.empresa,'obras.avances.editar'),false);
 end if;
 return jsonb_build_object('revision',coalesce(rev,0),'can_write',editable,
 'entries',coalesce((select jsonb_agg(jsonb_build_object('inicio',lpad((inicio/60)::text,2,'0')||':'||lpad((inicio%60)::text,2,'0'),'termino',lpad((termino/60)::text,2,'0')||':'||lpad((termino%60)::text,2,'0'),'actividad',actividad,'partida_id',partida_id,'minutos',minutos) order by posicion) from private.progress_activity_entries where obra_id=p_work and fecha=p_date),'[]'),
 'catalog',coalesce((select jsonb_agg(jsonb_build_object('nombre',nombre) order by nombre) from private.progress_activity_catalog where obra_id=p_work),'[]'),
 'parts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'partida',partida) order by partida) from public.partidas_obra where obra_id=p_work and empresa=w.empresa and not coalesce(es_titulo,false) and coalesce(unidad,'') not in ('TITULO','GRUPO')),'[]'));
end $$;
revoke all on function private.progress_activities(integer,date,jsonb,integer) from public,anon;
grant execute on function private.progress_activities(integer,date,jsonb,integer) to authenticated;
create or replace function public.progress_activities(p_work integer,p_date date,p_entries jsonb default null,p_revision integer default null)
returns jsonb language sql security invoker set search_path='' as $$select private.progress_activities(p_work,p_date,p_entries,p_revision)$$;
revoke all on function public.progress_activities(integer,date,jsonb,integer) from public,anon;
grant execute on function public.progress_activities(integer,date,jsonb,integer) to authenticated;
