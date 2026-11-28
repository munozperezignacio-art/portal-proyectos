-- Additional quality specialties. Existing pile tables, snapshots and APIs are untouched.
create table if not exists private.quality_specialties (
 id uuid primary key default gen_random_uuid(), obra_id integer not null references public.obras(id),
 nombre text not null check(length(trim(nombre)) between 1 and 120),
 revision integer not null default 1, created_at timestamptz not null default now()
);
create unique index if not exists quality_specialties_name on private.quality_specialties(obra_id,lower(trim(nombre)));
create table if not exists private.quality_specialty_parts (
 especialidad_id uuid not null references private.quality_specialties(id),
 partida_id integer not null references public.partidas_obra(id), primary key(especialidad_id,partida_id)
);
create index if not exists quality_specialty_parts_part on private.quality_specialty_parts(partida_id);
create table if not exists private.quality_protocol_types (
 id uuid primary key default gen_random_uuid(), especialidad_id uuid not null references private.quality_specialties(id),
 nombre text not null check(length(trim(nombre)) between 1 and 120), controles jsonb not null,
 revision integer not null default 1, check(jsonb_typeof(controles)='array')
);
create unique index if not exists quality_protocol_types_name on private.quality_protocol_types(especialidad_id,lower(trim(nombre)));
create table if not exists private.quality_specialty_protocols (
 id uuid primary key, obra_id integer not null references public.obras(id),
 especialidad_id uuid not null references private.quality_specialties(id),
 partida_id integer not null references public.partidas_obra(id), tipo_id uuid not null references private.quality_protocol_types(id),
 fecha date not null, correlativo integer not null, estado text not null check(estado in ('borrador','aprobado')),
 snapshot jsonb not null, revision integer not null default 1, autor uuid not null,
 updated_at timestamptz not null default now(), unique(obra_id,especialidad_id,partida_id,tipo_id,correlativo)
);
create index if not exists quality_specialty_protocols_type on private.quality_specialty_protocols(tipo_id);
create index if not exists quality_specialty_protocols_part on private.quality_specialty_protocols(partida_id);
alter table private.quality_specialties enable row level security;
alter table private.quality_specialty_parts enable row level security;
alter table private.quality_protocol_types enable row level security;
alter table private.quality_specialty_protocols enable row level security;
revoke all on private.quality_specialties,private.quality_specialty_parts,private.quality_protocol_types,private.quality_specialty_protocols from public,anon,authenticated;

create or replace function private.quality_specialties_api(p_work integer,p_action text,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 w public.obras; sp private.quality_specialties; typ private.quality_protocol_types;
 rec private.quality_specialty_protocols; part public.partidas_obra;
 sid uuid; tid uuid; rid uuid; pid integer; num integer; x jsonb; controls jsonb; snap jsonb;
 configure boolean; allowed boolean; actor_name text;
begin
 select * into w from public.obras where id=p_work;
 if auth.uid() is null or w.id is null or not coalesce(private.rrhh_partidas_permiso(w.empresa,w.id,'ver'),false)
 or not coalesce(private.obraxis_permission(w.empresa,'obras.calidad.ver'),false) then raise exception 'Sin acceso a Calidad de esta obra';end if;
 configure:=coalesce(private.obraxis_permission(w.empresa,'obras.especialidad.configurar'),false);
 if p_action='state' then
  return jsonb_build_object(
   'specialties',coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('part_ids',coalesce((select jsonb_agg(partida_id) from private.quality_specialty_parts where especialidad_id=s.id),'[]')) order by s.nombre) from private.quality_specialties s where obra_id=p_work),'[]'),
   'types',coalesce((select jsonb_agg(t order by t.nombre) from private.quality_protocol_types t join private.quality_specialties s on s.id=t.especialidad_id where s.obra_id=p_work),'[]'),
   'protocols',coalesce((select jsonb_agg(p order by p.fecha desc,p.correlativo desc) from private.quality_specialty_protocols p where obra_id=p_work),'[]'),
   'can_configure',configure,'can_create',coalesce(private.obraxis_permission(w.empresa,'obras.calidad.crear'),false),
   'can_edit',coalesce(private.obraxis_permission(w.empresa,'obras.calidad.editar'),false),
   'can_approve',coalesce(private.obraxis_permission(w.empresa,'obras.calidad.aprobar'),false),
   'can_download',coalesce(private.obraxis_permission(w.empresa,'obras.calidad.descargar'),false));
 end if;
 if p_action='specialty' then
  if not configure then raise exception 'Falta el permiso Configurar especialidades de obra';end if;
  if nullif(trim(p_data->>'nombre'),'') is null or lower(trim(p_data->>'nombre'))='pilas de grava' then raise exception 'Indica otra especialidad; Pilas de grava conserva su configuración existente';end if;
  if jsonb_typeof(p_data->'part_ids') is distinct from 'array' or jsonb_array_length(p_data->'part_ids')=0 then raise exception 'Selecciona al menos una partida';end if;
  for x in select value from jsonb_array_elements(p_data->'part_ids') loop
   if not exists(select 1 from public.partidas_obra where id=(x::text)::integer and obra_id=p_work and empresa=w.empresa and not coalesce(es_titulo,false)) then raise exception 'Partida ajena a esta obra';end if;
  end loop;
  sid:=coalesce(nullif(p_data->>'id','')::uuid,gen_random_uuid());
  select * into sp from private.quality_specialties where id=sid for update;
  if sp.id is not null and (sp.obra_id<>p_work or sp.revision<>coalesce((p_data->>'revision')::integer,0)) then raise exception 'Configuración modificada o ajena; actualiza';end if;
  -- Do not orphan protocols when a link is removed.
  if exists(select 1 from private.quality_specialty_protocols p where p.especialidad_id=sid and not p_data->'part_ids' @> jsonb_build_array(p.partida_id)) then raise exception 'No puedes desvincular una partida que tiene protocolos';end if;
  insert into private.quality_specialties(id,obra_id,nombre) values(sid,p_work,trim(p_data->>'nombre'))
   on conflict(id) do update set nombre=excluded.nombre,revision=private.quality_specialties.revision+1;
  delete from private.quality_specialty_parts where especialidad_id=sid;
  insert into private.quality_specialty_parts select sid,value::integer from jsonb_array_elements_text(p_data->'part_ids') on conflict do nothing;
  return jsonb_build_object('id',sid);
 end if;
 sid:=(p_data->>'especialidad_id')::uuid;
 select * into sp from private.quality_specialties where id=sid and obra_id=p_work;
 if sp.id is null then raise exception 'Especialidad ajena a esta obra';end if;
 if p_action='type' then
  if not configure then raise exception 'Falta el permiso Configurar especialidades de obra';end if;
  if nullif(trim(p_data->>'nombre'),'') is null then raise exception 'Indica el nombre del protocolo';end if;
  controls:=p_data->'controles';
  if jsonb_typeof(controls) is distinct from 'array' or jsonb_array_length(controls) not between 1 and 100 then raise exception 'Agrega entre 1 y 100 controles al formato';end if;
  if exists(select 1 from jsonb_array_elements(controls) c where jsonb_typeof(c)<>'string' or length(trim(c #>> '{}')) not between 1 and 500) then raise exception 'Control inválido';end if;
  tid:=coalesce(nullif(p_data->>'id','')::uuid,gen_random_uuid());
  select * into typ from private.quality_protocol_types where id=tid for update;
  if typ.id is not null and (typ.especialidad_id<>sid or typ.revision<>coalesce((p_data->>'revision')::integer,0)) then raise exception 'Formato modificado o ajeno; actualiza';end if;
  insert into private.quality_protocol_types(id,especialidad_id,nombre,controles) values(tid,sid,trim(p_data->>'nombre'),controls)
   on conflict(id) do update set nombre=excluded.nombre,controles=excluded.controles,revision=private.quality_protocol_types.revision+1;
  return jsonb_build_object('id',tid);
 end if;
 if p_action<>'protocol' then raise exception 'Acción no admitida';end if;
 rid:=(p_data->>'id')::uuid;pid:=(p_data->>'partida_id')::integer;tid:=(p_data->>'tipo_id')::uuid;
 -- Serialize numbering and retries within this work, without locking pile records.
 perform pg_advisory_xact_lock(82731,p_work);
 select * into rec from private.quality_specialty_protocols where id=rid for update;
 allowed:=coalesce(private.obraxis_permission(w.empresa,case when rec.id is null then 'obras.calidad.crear' else 'obras.calidad.editar' end),false);
 if not allowed then raise exception 'Falta permiso para crear o editar protocolos de Calidad';end if;
 if p_data->>'estado' not in ('borrador','aprobado') then raise exception 'Estado inválido';end if;
 if p_data->>'estado'='aprobado' and not coalesce(private.obraxis_permission(w.empresa,'obras.calidad.aprobar'),false) then raise exception 'Falta permiso para aprobar protocolos';end if;
 if rec.id is not null and (rec.obra_id<>p_work or rec.especialidad_id<>sid or rec.partida_id<>pid or rec.tipo_id<>tid or rec.estado='aprobado' or rec.revision<>coalesce((p_data->>'revision')::integer,0)) then raise exception 'Protocolo aprobado, ajeno o modificado; no se sobrescribió';end if;
 if not exists(select 1 from private.quality_specialty_parts where especialidad_id=sid and partida_id=pid) then raise exception 'Partida no vinculada a esta especialidad';end if;
 select * into part from public.partidas_obra where id=pid and obra_id=p_work and empresa=w.empresa;
 select * into typ from private.quality_protocol_types where id=tid and especialidad_id=sid;
 if part.id is null or typ.id is null then raise exception 'Partida o tipo de protocolo incorrecto';end if;
 if nullif(p_data->>'fecha','') is null then raise exception 'Selecciona la fecha';end if;
 controls:=coalesce(rec.snapshot->'controles_base',typ.controles);
 if jsonb_typeof(p_data->'resultados') is distinct from 'array' or jsonb_array_length(p_data->'resultados')<>jsonb_array_length(controls) then raise exception 'El formato cambió; actualiza antes de guardar';end if;
 if rec.id is null and typ.revision<>coalesce((p_data->>'tipo_revision')::integer,0) then raise exception 'El formato cambió; actualiza antes de guardar';end if;
 if exists(select 1 from jsonb_array_elements(p_data->'resultados') r where coalesce(r->>'resultado','') not in ('Pendiente','Conforme','No conforme','No aplica')) then raise exception 'Resultado de control inválido';end if;
 if p_data->>'estado'='aprobado' and exists(select 1 from jsonb_array_elements(p_data->'resultados') r where r->>'resultado' in ('Pendiente','No conforme')) then raise exception 'Resuelve los controles pendientes o no conformes antes de aprobar';end if;
 select coalesce(nombre,usuario) into actor_name from public.usuarios where auth_user_id=auth.uid() and empresa=w.empresa limit 1;
 num:=rec.correlativo;
 if num is null then select coalesce(max(correlativo),0)+1 into num from private.quality_specialty_protocols where obra_id=p_work and especialidad_id=sid and partida_id=pid and tipo_id=tid;end if;
 snap:=jsonb_build_object('obra',w.nombre,'especialidad',sp.nombre,'partida',part.partida,'tipo',coalesce(rec.snapshot->>'tipo',typ.nombre),
  'controles_base',controls,'resultados',p_data->'resultados','comentarios',coalesce(p_data->>'comentarios',''),
  'autor',coalesce(rec.snapshot->>'autor',actor_name),'aprobado_por',case when p_data->>'estado'='aprobado' then actor_name else null end);
 insert into private.quality_specialty_protocols(id,obra_id,especialidad_id,partida_id,tipo_id,fecha,correlativo,estado,snapshot,autor)
  values(rid,p_work,sid,pid,tid,(p_data->>'fecha')::date,num,p_data->>'estado',snap,auth.uid())
  on conflict(id) do update set fecha=excluded.fecha,estado=excluded.estado,snapshot=excluded.snapshot,revision=private.quality_specialty_protocols.revision+1,updated_at=now();
 return jsonb_build_object('id',rid,'correlativo',num);
end $$;
revoke all on function private.quality_specialties_api(integer,text,jsonb) from public,anon,authenticated;
grant execute on function private.quality_specialties_api(integer,text,jsonb) to authenticated;
create or replace function public.quality_specialties_api(p_work integer,p_action text,p_data jsonb default '{}')
returns jsonb language sql security invoker set search_path='' as $$select private.quality_specialties_api(p_work,p_action,p_data)$$;
revoke all on function public.quality_specialties_api(integer,text,jsonb) from public,anon;
grant execute on function public.quality_specialties_api(integer,text,jsonb) to authenticated;
