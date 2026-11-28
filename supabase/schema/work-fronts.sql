-- Shared work fronts. Existing reports and piles are never rewritten by import.
create table if not exists private.work_fronts (
 obra_id integer not null references public.obras(id),
 nombre text not null check(length(nombre) between 1 and 120),
 clave text not null,
 creado_por uuid not null,
 created_at timestamptz not null default now(),
 primary key(obra_id,clave)
);
alter table private.work_fronts enable row level security;
revoke all on private.work_fronts from public,anon,authenticated;

create or replace function private.work_front_key(v text) returns text
language sql immutable set search_path='' as $$
 select lower(translate(regexp_replace(trim(v),'\s+',' ','g'),'ÁÉÍÓÚÜÑáéíóúüñ','AEIOUUNaeiouun'))
$$;
create or replace function private.work_front_names(w integer) returns table(nombre text)
language sql stable set search_path='' as $$
 select distinct on (private.work_front_key(n)) n from (
 select nombre n,0 priority from private.work_fronts where obra_id=w
 union all select trim(frente),1 from public.avances_produccion_partidas where obra_id=w and nullif(trim(frente),'') is not null
 union all select frente,2 from private.specialty_elements where obra_id=w and nullif(trim(frente),'') is not null
 union all select 'Frente Principal',3
 ) f order by private.work_front_key(n),priority,n
$$;
create or replace function private.work_fronts_api(p_work integer,p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare w public.obras%rowtype; uid uuid:=auth.uid(); n text; existing text; r public.avances_produccion_partidas%rowtype; x jsonb; total integer:=0;
begin
 select * into w from public.obras where id=p_work;
 if uid is null or w.id is null or not coalesce(private.rrhh_partidas_permiso(w.empresa,w.id,'ver'),false) then raise exception 'No autorizado para esta obra';end if;
 if p_action='list' then
  return jsonb_build_object('fronts',(select jsonb_agg(nombre order by nombre) from private.work_front_names(p_work)), 'can_edit',coalesce(private.obraxis_permission(w.empresa,'obras.avances.editar'),false));
 end if;
 perform pg_advisory_xact_lock(78231,p_work);
 if p_action='create' then
  if not (coalesce(private.obraxis_permission(w.empresa,'obras.especialidad.importar'),false) or coalesce(private.obraxis_permission(w.empresa,'obras.avances.crear'),false)) then raise exception 'Falta permiso para crear frentes';end if;
  n:=regexp_replace(trim(p_data->>'nombre'),'\s+',' ','g');
  if n is null or length(n) not between 1 and 120 then raise exception 'Indica un frente de entre 1 y 120 caracteres';end if;
  select nombre into existing from private.work_front_names(p_work) where private.work_front_key(nombre)=private.work_front_key(n);
  if existing is not null then return jsonb_build_object('nombre',existing,'created',false);end if;
  insert into private.work_fronts(obra_id,nombre,clave,creado_por) values(p_work,n,private.work_front_key(n),uid);
  insert into private.specialty_audit(obra_id,actor,accion,referencia) values(p_work,uid,'create_front',n);
  return jsonb_build_object('nombre',n,'created',true);
 end if;
 if not coalesce(private.obraxis_permission(w.empresa,'obras.avances.editar'),false) then raise exception 'Falta permiso para editar reportes de avance';end if;
 if p_action='reports' then
  return coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'fecha',(a.created_at at time zone 'America/Santiago')::date,'frente',a.frente,'cantidad',a.cantidad,'unidad',a.unidad,'blocked',a.specialty_session_id is not null or exists(select 1 from private.specialty_sessions s where a.id=any(s.report_ids))) order by a.created_at,a.id) from public.avances_produccion_partidas a where a.obra_id=p_work and a.empresa=w.empresa and a.partida_id=(p_data->>'partida_id')::integer),'[]');
 elsif p_action='correct_reports' then
  select nombre into n from private.work_front_names(p_work) where nombre=p_data->>'frente';
  if n is null then raise exception 'Selecciona un frente de esta obra';end if;
  if jsonb_typeof(p_data->'reports') is distinct from 'array' or jsonb_array_length(p_data->'reports') not between 1 and 500 then raise exception 'Selecciona entre 1 y 500 reportes';end if;
  if exists(select 1 from jsonb_array_elements(p_data->'reports') e group by e->>'id' having count(*)>1) then raise exception 'Reporte repetido';end if;
  for x in select value from jsonb_array_elements(p_data->'reports') loop
   select * into r from public.avances_produccion_partidas where id=(x->>'id')::integer and obra_id=p_work and empresa=w.empresa and partida_id=(p_data->>'partida_id')::integer for update;
   if not found then raise exception 'Reporte fuera de la obra o partida seleccionada';end if;
   if r.frente is distinct from x->>'frente' then raise exception 'El frente del reporte % cambió. Actualiza antes de corregir',r.id;end if;
   if r.specialty_session_id is not null or exists(select 1 from private.specialty_sessions s where r.id=any(s.report_ids)) then raise exception 'El reporte % está vinculado a pilas. Revisa su conciliación antes de cambiar el frente',r.id;end if;
   if r.frente is distinct from n then
    update public.avances_produccion_partidas set frente=n where id=r.id;
    insert into private.specialty_audit(obra_id,actor,accion,referencia) values(p_work,uid,'correct_report_front',jsonb_build_object('report_id',r.id,'antes',r.frente,'despues',n)::text);
    total:=total+1;
   end if;
  end loop;
  return jsonb_build_object('updated',total);
 end if;
 raise exception 'Acción no admitida';
end $$;
create or replace function public.work_fronts_api(p_work integer,p_action text,p_data jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$select private.work_fronts_api(p_work,p_action,p_data)$$;
revoke all on function private.work_front_key(text),private.work_front_names(integer),private.work_fronts_api(integer,text,jsonb),public.work_fronts_api(integer,text,jsonb) from public,anon;
grant execute on function private.work_fronts_api(integer,text,jsonb),public.work_fronts_api(integer,text,jsonb) to authenticated;

-- Patch only the catalog validation in the current native API, preserving all other production fixes.
do $patch$
declare src text; needle text:= E'    exists(select 1 from public.avances_produccion_partidas where obra_id=p_work and trim(frente)=front_name)';
begin
 select pg_get_functiondef('private.specialty_api(integer,text,jsonb)'::regprocedure) into src;
 if position('work_fronts where obra_id=p_work and nombre=front_name' in src)=0 then
  if position(needle in src)=0 then raise exception 'La validación de frentes cambió; revisar antes de aplicar';end if;
  src:=replace(src,needle,E'    exists(select 1 from private.work_fronts where obra_id=p_work and nombre=front_name)\n    or exists(select 1 from public.avances_produccion_partidas where obra_id=p_work and trim(frente)=front_name)');
  execute src;
 end if;
end $patch$;
