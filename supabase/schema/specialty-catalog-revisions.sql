-- Design-only revisions: never update sessions, measurements, progress or protocol snapshots.
create table if not exists private.specialty_catalog_history (
 id bigint generated always as identity primary key,
 obra_id integer not null references public.obras(id), partida_id integer not null references public.partidas_obra(id),
 element_id uuid not null references private.specialty_elements(id), actor uuid not null,
 plano text not null, fecha date not null, motivo text not null,
 antes jsonb, despues jsonb not null, created_at timestamptz not null default now()
);
create index if not exists specialty_catalog_history_scope on private.specialty_catalog_history(obra_id,partida_id,id desc);
alter table private.specialty_catalog_history enable row level security;
revoke all on private.specialty_catalog_history from public,anon,authenticated;

create or replace function private.specialty_catalog_api(p_work integer,p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security definer set search_path='' as $$
declare
 w public.obras%rowtype; uid uuid:=auth.uid(); pid integer:=(p_data->>'partida_id')::integer;
 e private.specialty_elements%rowtype; before_data jsonb; after_data jsonb; x jsonb; result jsonb;
 req private.specialty_requests%rowtype; n numeric; east_value numeric; len numeric; front_name text; stage_name text; pile_number text;
 changed integer:=0; added integer:=0; locked boolean; can_create boolean; can_edit boolean; can_import boolean;
begin
 select * into w from public.obras where id=p_work;
 if uid is null or w.id is null or not coalesce(private.rrhh_partidas_permiso(w.empresa,w.id,'ver'),false) then raise exception 'No autorizado para esta obra';end if;
 if not exists(select 1 from private.specialty_settings s join public.partidas_obra p on p.id=s.partida_id where s.obra_id=p_work and s.partida_id=pid and p.obra_id=p_work and p.empresa=w.empresa) then raise exception 'Partida no configurada en esta obra';end if;
 can_create:=coalesce(private.obraxis_permission(w.empresa,'obras.especialidad.crear'),false);
 can_edit:=coalesce(private.obraxis_permission(w.empresa,'obras.especialidad.editar'),false);
 can_import:=coalesce(private.obraxis_permission(w.empresa,'obras.especialidad.importar'),false);
 if p_action='state' then
  return jsonb_build_object('can_create',can_create,'can_edit',can_edit,'can_import',can_import,
   'fronts',(select jsonb_agg(nombre order by nombre) from private.work_front_names(p_work)),
   'history',coalesce((select jsonb_agg(to_jsonb(h)||jsonb_build_object('autor',coalesce((select coalesce(u.nombre,u.usuario) from public.usuarios u where u.auth_user_id=h.actor and u.empresa=w.empresa order by u.id limit 1),h.actor::text)) order by h.id desc) from private.specialty_catalog_history h where h.obra_id=p_work and h.partida_id=pid),'[]'));
 end if;
 if p_action not in ('create','edit','import') then raise exception 'Acción no admitida';end if;
 if (p_action='create' and not can_create) or (p_action='edit' and not can_edit) or (p_action='import' and not can_import) then raise exception 'Falta permiso para agregar, editar o importar pilas';end if;
 if length(trim(coalesce(p_data->>'plano',''))) not between 1 and 150 or length(trim(coalesce(p_data->>'motivo',''))) not between 1 and 1000 or nullif(p_data->>'fecha','') is null then raise exception 'Indica plano / revisión, fecha y motivo';end if;
 if jsonb_typeof(p_data->'rows') is distinct from 'array' or jsonb_array_length(p_data->'rows') not between 1 and 10000 then raise exception 'Selecciona entre 1 y 10000 pilas';end if;
 if p_action<>'import' and jsonb_array_length(p_data->'rows')<>1 then raise exception 'Selecciona una sola pila';end if;
 if nullif(p_data->>'request_id','') is null then raise exception 'Falta identificador de solicitud';end if;
 perform pg_advisory_xact_lock(78231,p_work);
 select * into req from private.specialty_requests where id=(p_data->>'request_id')::uuid;
 if found then
  if req.actor<>uid or req.obra_id<>p_work or req.action<>'catalog_'||p_action or req.payload<>p_data then raise exception 'Solicitud reutilizada con otros datos';end if;
  return req.response;
 end if;
 if exists(select 1 from jsonb_array_elements(p_data->'rows') r group by trim(r->>'etapa'),trim(r->>'numero') having count(*)>1) then raise exception 'Hay pilas repetidas en la revisión';end if;
 if exists(select 1 from jsonb_array_elements(p_data->'rows') r where nullif(r->>'id','') is not null group by r->>'id' having count(*)>1) then raise exception 'Pila repetida';end if;
 for x in select value from jsonb_array_elements(p_data->'rows') loop
  stage_name:=trim(x->>'etapa');pile_number:=trim(x->>'numero');front_name:=trim(x->>'frente');
  if coalesce(length(stage_name),0) not between 1 and 100 or coalesce(length(pile_number),0) not between 1 and 100 then raise exception 'Indica etapa y número de pila';end if;
  if not exists(select 1 from private.work_front_names(p_work) f where f.nombre=front_name) then raise exception 'Selecciona un frente registrado en esta obra';end if;
  n:=nullif(trim(x->>'norte'),'')::numeric;east_value:=nullif(trim(x->>'este'),'')::numeric;len:=nullif(trim(x->>'longitud_diseno'),'')::numeric;
  if n is null or east_value is null or n::text in ('NaN','Infinity','-Infinity') or east_value::text in ('NaN','Infinity','-Infinity') or (len is not null and (len<=0 or len::text in ('NaN','Infinity','-Infinity'))) then raise exception 'Coordenadas o longitud de diseño inválidas';end if;
  e:=null;
  if nullif(x->>'id','') is not null then
   select * into e from private.specialty_elements where id=(x->>'id')::uuid and obra_id=p_work and partida_id=pid for update;
   if not found then raise exception 'Pila fuera de la obra o partida';end if;
  else
   select * into e from private.specialty_elements where obra_id=p_work and partida_id=pid and etapa=stage_name and numero=pile_number for update;
  end if;
  before_data:=case when e.id is null then null else jsonb_build_object('id',e.id,'numero',e.numero,'etapa',e.etapa,'norte',e.norte,'este',e.este,'frente',e.frente,'longitud_diseno',e.longitud_diseno) end;
  if p_action='create' and e.id is not null then raise exception 'La pila ya existe; usa Editar';end if;
  if p_action='edit' and e.id is null then raise exception 'Pila no encontrada';end if;
  if before_data is distinct from nullif(x->'antes','null'::jsonb) then raise exception 'La pila % cambió desde la vista previa. Actualiza y revisa nuevamente',pile_number;end if;
  if e.id is not null then
   locked:=e.sesion_id is not null or exists(select 1 from private.specialty_sessions s where s.obra_id=p_work and s.partida_id=pid and exists(select 1 from jsonb_array_elements(s.datos->'pilas') j where j->>'element_id'=e.id::text));
   if locked and (e.numero is distinct from pile_number or e.etapa is distinct from stage_name or e.frente is distinct from front_name) then raise exception 'Pila % vinculada a una jornada: conserva número, etapa y frente para proteger el historial',e.numero;end if;
  end if;
  if e.id is null then
   insert into private.specialty_elements(obra_id,partida_id,numero,etapa,norte,este,frente,longitud_diseno) values(p_work,pid,pile_number,stage_name,n,east_value,front_name,len) returning * into e;
   added:=added+1;
  else
   if (e.numero,e.etapa,e.norte,e.este,e.frente,e.longitud_diseno) is not distinct from (pile_number,stage_name,n,east_value,front_name,len) then continue;end if;
   update private.specialty_elements set numero=pile_number,etapa=stage_name,norte=n,este=east_value,frente=front_name,longitud_diseno=len where id=e.id returning * into e;
   changed:=changed+1;
  end if;
  after_data:=jsonb_build_object('id',e.id,'numero',e.numero,'etapa',e.etapa,'norte',e.norte,'este',e.este,'frente',e.frente,'longitud_diseno',e.longitud_diseno);
  insert into private.specialty_catalog_history(obra_id,partida_id,element_id,actor,plano,fecha,motivo,antes,despues) values(p_work,pid,e.id,uid,trim(p_data->>'plano'),(p_data->>'fecha')::date,trim(p_data->>'motivo'),before_data,after_data);
 end loop;
 result:=jsonb_build_object('added',added,'updated',changed);
 insert into private.specialty_requests(id,actor,obra_id,action,payload,response) values((p_data->>'request_id')::uuid,uid,p_work,'catalog_'||p_action,p_data,result);
 return result;
end $$;
create or replace function public.specialty_catalog_api(p_work integer,p_action text,p_data jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$select private.specialty_catalog_api(p_work,p_action,p_data)$$;
revoke all on function private.specialty_catalog_api(integer,text,jsonb),public.specialty_catalog_api(integer,text,jsonb) from public,anon;
grant execute on function private.specialty_catalog_api(integer,text,jsonb),public.specialty_catalog_api(integer,text,jsonb) to authenticated;
do $patch$
declare src text; needle text:='''can_configure'',adm';
begin
 select pg_get_functiondef('private.specialty_api(integer,text,jsonb)'::regprocedure) into src;
 if position('can_create_piles' in src)=0 then
  if position(needle in src)=0 then raise exception 'Revisar API de especialidades antes de aplicar';end if;
  src:=replace(src,needle,needle||',''can_create_piles'',coalesce(private.obraxis_permission(w.empresa,''obras.especialidad.crear''),false),''can_edit_piles'',coalesce(private.obraxis_permission(w.empresa,''obras.especialidad.editar''),false)');
  execute src;
 end if;
end $patch$;
notify pgrst,'reload schema';
