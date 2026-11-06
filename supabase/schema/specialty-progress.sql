-- Read-only release of the specialty catalog and reconciled history.
-- Compatible with the forthcoming journal writer; no public mutation API is exposed.
create table if not exists private.specialty_settings (
 obra_id integer not null references public.obras(id), partida_id integer not null references public.partidas_obra(id),
 especialidad text not null default 'pilas_grava' check(especialidad='pilas_grava'),
 ejecucion uuid, topografia uuid, calidad uuid, activa_desde date not null,
 datos_fijos jsonb not null default '{}', revision integer not null default 1,
 primary key(obra_id,partida_id)
);
create table if not exists private.specialty_sessions (
 id uuid primary key, obra_id integer not null, partida_id integer not null, fecha date not null,
 responsable uuid, estado text not null default 'abierta' check(estado in ('abierta','cerrada','historica')),
 revision integer not null default 0, datos jsonb not null default '{"pilas":[],"observaciones":""}',
 created_at timestamptz not null default now(), closed_at timestamptz,
 report_ids integer[] not null default '{}', unique(obra_id,partida_id,fecha),
 foreign key(obra_id,partida_id) references private.specialty_settings(obra_id,partida_id)
);
create table if not exists private.specialty_elements (
 id uuid primary key default gen_random_uuid(), obra_id integer not null, partida_id integer not null,
 etapa text not null check(length(etapa) between 1 and 100), numero text not null check(length(numero) between 1 and 100),
 norte numeric not null, este numeric not null, longitud_diseno numeric check(longitud_diseno>0),
 sesion_id uuid references private.specialty_sessions(id),
 topografia jsonb not null default '{}', revision_topografia integer not null default 0,
 unique(obra_id,partida_id,etapa,numero),
 foreign key(obra_id,partida_id) references private.specialty_settings(obra_id,partida_id)
);
create index if not exists specialty_elements_session on private.specialty_elements(sesion_id);
create table if not exists private.specialty_history_imports (
 obra_id integer not null references public.obras(id), source_hash text not null,
 source_name text not null, payload jsonb not null, result jsonb not null, created_at timestamptz not null default now(),
 primary key(obra_id,source_hash)
);
alter table private.specialty_settings enable row level security;
alter table private.specialty_sessions enable row level security;
alter table private.specialty_elements enable row level security;
alter table private.specialty_history_imports enable row level security;
revoke all on private.specialty_settings,private.specialty_sessions,private.specialty_elements,private.specialty_history_imports from public,anon,authenticated;

create or replace function private.specialty_progress_state(p_work integer)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare company text;
begin
 select empresa into company from public.obras where id=p_work;
 if auth.uid() is null or company is null or not coalesce(private.rrhh_partidas_permiso(company,p_work,'ver'),false) then
  raise exception 'No autorizado para esta obra' using errcode='42501';
 end if;
 return jsonb_build_object(
 'elements',coalesce((select jsonb_agg(jsonb_build_object('id',id,'partida_id',partida_id,'numero',numero,'etapa',etapa,'norte',norte,'este',este,'longitud_diseno',longitud_diseno) order by etapa,numero) from private.specialty_elements where obra_id=p_work),'[]'),
 'sessions',coalesce((select jsonb_agg(jsonb_build_object('id',id,'partida_id',partida_id,'fecha',fecha,'estado',estado,'datos',jsonb_build_object('pilas',datos->'pilas'))) from private.specialty_sessions where obra_id=p_work and estado in ('historica','cerrada')),'[]'));
end $$;
revoke all on function private.specialty_progress_state(integer) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.specialty_progress_state(integer) to authenticated;
create or replace function public.specialty_progress_state(p_work integer)
returns jsonb language sql security invoker set search_path='' as $$select private.specialty_progress_state(p_work)$$;
revoke all on function public.specialty_progress_state(integer) from public,anon;
grant execute on function public.specialty_progress_state(integer) to authenticated;

-- Administrative migration only. Invoker rights, no exposed/public wrapper, no client grants.
create or replace function private.import_pile_history(p_work integer,p_company text,p_work_name text,p_mapping jsonb,p_source jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare w public.obras%rowtype; part public.partidas_obra%rowtype; existing_element private.specialty_elements%rowtype;
 s private.specialty_sessions%rowtype; previous private.specialty_history_imports%rowtype;
 x jsonb; g record; pid integer; ids integer[]; n numeric; sid uuid; rows_json jsonb; rid integer;
 added integer:=0; linked integer:=0; result jsonb; payload jsonb:=jsonb_build_object('mapping',p_mapping,'source',p_source);
begin
 perform pg_advisory_xact_lock(78231,p_work);
 select * into w from public.obras where id=p_work and empresa=p_company and nombre=p_work_name;
 if w.id is null then raise exception 'Obra o empresa no coincide';end if;
 if coalesce(p_source->>'sha256','') !~ '^[a-f0-9]{64}$' then raise exception 'Huella del archivo inválida';end if;
 select * into previous from private.specialty_history_imports where obra_id=p_work and source_hash=p_source->>'sha256';
 if previous.obra_id is not null then
  if previous.payload<>payload then raise exception 'El archivo ya fue importado con otros datos';end if;
  return previous.result||jsonb_build_object('repeated',true,'new_reports_this_call',0);
 end if;
 if jsonb_typeof(p_source->'catalog') is distinct from 'array' or jsonb_typeof(p_source->'history') is distinct from 'array' then raise exception 'Archivo inválido';end if;
 if jsonb_array_length(p_source->'catalog')=0 or jsonb_array_length(p_source->'catalog')>10000 or jsonb_array_length(p_source->'history')>10000 then raise exception 'Tamaño de archivo inválido';end if;
 if exists(select 1 from jsonb_array_elements(p_source->'catalog') a group by a->>'etapa',a->>'numero' having count(*)>1)
 or exists(select 1 from jsonb_array_elements(p_source->'history') a group by a->>'etapa',a->>'numero' having count(*)>1) then raise exception 'Pila repetida en archivo';end if;
 -- Prevent a concurrent legacy insertion between reconciliation and missing-day insertion.
 lock table public.avances_produccion_partidas in share row exclusive mode;
 for x in select value from jsonb_array_elements(p_source->'catalog') loop
  pid:=(p_mapping->>(x->>'etapa'))::integer;
  select * into part from public.partidas_obra where id=pid and obra_id=p_work and empresa=p_company and upper(unidad) in ('UND','UN','UNIDAD','UNIDADES');
  if part.id is null then raise exception 'Partida/etapa no válida';end if;
  if x->>'norte' is null or x->>'este' is null or x->>'norte' in ('NaN','Infinity','-Infinity') or x->>'este' in ('NaN','Infinity','-Infinity') then raise exception 'Coordenadas no válidas';end if;
  insert into private.specialty_settings(obra_id,partida_id,activa_desde) values(p_work,pid,(select max((a->>'fecha')::date)+1 from jsonb_array_elements(p_source->'history') a)) on conflict do nothing;
  select * into existing_element from private.specialty_elements where obra_id=p_work and partida_id=pid and etapa=x->>'etapa' and numero=x->>'numero';
  if existing_element.id is not null and (existing_element.norte is distinct from (x->>'norte')::numeric or existing_element.este is distinct from (x->>'este')::numeric or existing_element.longitud_diseno is distinct from (x->>'longitud_diseno')::numeric) then raise exception 'Coordenadas o diseño difieren para pila %',existing_element.numero;end if;
  if existing_element.id is null then
   insert into private.specialty_elements(obra_id,partida_id,etapa,numero,norte,este,longitud_diseno) values(p_work,pid,x->>'etapa',x->>'numero',(x->>'norte')::numeric,(x->>'este')::numeric,(x->>'longitud_diseno')::numeric);
  end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(p_source->'history') a where not exists(select 1 from private.specialty_elements e where e.obra_id=p_work and e.partida_id=(p_mapping->>(a->>'etapa'))::integer and e.etapa=a->>'etapa' and e.numero=a->>'numero')) then raise exception 'Ejecución fuera del catálogo';end if;
 for g in select (a->>'fecha')::date fecha,(p_mapping->>(a->>'etapa'))::integer partida_id,count(*) qty from jsonb_array_elements(p_source->'history') a group by 1,2 order by 1,2 loop
  if g.fecha is null or g.fecha>(now() at time zone 'America/Santiago')::date then raise exception 'Fecha inválida';end if;
  select * into part from public.partidas_obra where id=g.partida_id;
  select * into s from private.specialty_sessions where obra_id=p_work and partida_id=g.partida_id and fecha=g.fecha;
  sid:=coalesce(s.id,gen_random_uuid());
  select jsonb_agg(a||jsonb_build_object('element_id',e.id,'terminada',true,'origen','excel_historico') order by e.numero) into rows_json
   from jsonb_array_elements(p_source->'history') a join private.specialty_elements e on e.obra_id=p_work and e.partida_id=g.partida_id and e.etapa=a->>'etapa' and e.numero=a->>'numero'
   where (a->>'fecha')::date=g.fecha and (p_mapping->>(a->>'etapa'))::integer=g.partida_id;
  if exists(select 1 from private.specialty_elements e where e.id in(select (a->>'element_id')::uuid from jsonb_array_elements(rows_json) a) and e.sesion_id is not null and e.sesion_id<>sid) then raise exception 'Pila ya ejecutada en otra jornada';end if;
  if s.id is not null and (s.estado<>'historica' or s.datos->'pilas'<>rows_json) then raise exception 'Jornada histórica difiere; revisión requerida';end if;
  select array_agg(id order by id),sum(cantidad) into ids,n from public.avances_produccion_partidas where obra_id=p_work and empresa=p_company and (partida_id=g.partida_id or (partida_id is null and lower(trim(partida))=lower(trim(part.partida)))) and (created_at at time zone 'America/Santiago')::date=g.fecha;
  if ids is not null and n is distinct from g.qty::numeric then raise exception 'Avance distinto en %: reportes %, Excel %',g.fecha,n,g.qty;end if;
  if ids is null then
   insert into public.avances_produccion_partidas(empresa,obra_id,obra_nombre,supervisor,partida_id,partida,unidad,cantidad,observaciones,created_at)
   values(p_company,p_work,w.nombre,'Histórico Excel · responsable no informado',g.partida_id,part.partida,part.unidad,g.qty,'Migración conciliada desde '||(p_source->>'source')||'. Sin asignación de responsable de terreno.',(g.fecha+time '12:00') at time zone 'America/Santiago') returning id into rid;
   ids:=array[rid];added:=added+1;
  else linked:=linked+cardinality(ids);end if;
  if exists(select 1 from private.specialty_sessions t where t.id<>sid and t.report_ids && ids) then raise exception 'Reporte ya conciliado en otra jornada';end if;
  insert into private.specialty_sessions(id,obra_id,partida_id,fecha,responsable,estado,revision,datos,closed_at,report_ids)
   values(sid,p_work,g.partida_id,g.fecha,null,'historica',1,jsonb_build_object('pilas',rows_json,'source_hash',p_source->>'sha256','observaciones','Conciliación histórica; responsable por designar'),now(),ids)
   on conflict(id) do nothing;
  update private.specialty_elements set sesion_id=sid where id in(select (a->>'element_id')::uuid from jsonb_array_elements(rows_json) a);
 end loop;
 result:=jsonb_build_object('catalog',jsonb_array_length(p_source->'catalog'),'history',jsonb_array_length(p_source->'history'),'linked_reports',linked,'new_reports',added,'new_reports_this_call',added,'repeated',false);
 insert into private.specialty_history_imports(obra_id,source_hash,source_name,payload,result) values(p_work,p_source->>'sha256',p_source->>'source',payload,result);
 return result;
end $$;
revoke all on function private.import_pile_history(integer,text,text,jsonb,jsonb) from public,anon,authenticated;

create or replace function private.guard_reconciled_pile_history()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from private.specialty_sessions where estado='historica' and old.id=any(report_ids)) then
  if tg_op='DELETE' then raise exception 'Reporte conciliado con pilas: requiere corregir también el detalle histórico';end if;
  if new.cantidad is distinct from old.cantidad or new.partida_id is distinct from old.partida_id or new.partida is distinct from old.partida or new.obra_id is distinct from old.obra_id or new.empresa is distinct from old.empresa or (new.created_at at time zone 'America/Santiago')::date is distinct from (old.created_at at time zone 'America/Santiago')::date then
   raise exception 'Reporte conciliado con pilas: requiere corregir también el detalle histórico';
  end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end $$;
revoke all on function private.guard_reconciled_pile_history() from public,anon,authenticated;
drop trigger if exists guard_reconciled_pile_history on public.avances_produccion_partidas;
create trigger guard_reconciled_pile_history before update or delete on public.avances_produccion_partidas for each row execute function private.guard_reconciled_pile_history();
