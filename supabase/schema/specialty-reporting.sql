-- Specialty journals are private: all access goes through the checked RPC below.
create table if not exists private.specialty_settings (
 obra_id integer not null references public.obras(id), partida_id integer not null references public.partidas_obra(id),
 especialidad text not null default 'pilas_grava' check(especialidad='pilas_grava'),
 ejecucion uuid, topografia uuid, calidad uuid, activa_desde date not null,
 datos_fijos jsonb not null default '{}', revision integer not null default 1,
 primary key(obra_id,partida_id)
);
create table if not exists private.specialty_sessions (
 id uuid primary key, obra_id integer not null, partida_id integer not null, fecha date not null,
 responsable uuid not null, estado text not null default 'abierta' check(estado in ('abierta','cerrada','historica')),
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
create table if not exists private.specialty_protocols (
 id uuid primary key, obra_id integer not null references public.obras(id), sesion_id uuid not null references private.specialty_sessions(id),
 tipo text not null check(tipo in ('ejecucion','topografia')), fecha date not null, correlativo text not null,
 estado text not null check(estado in ('borrador','aprobado')), snapshot jsonb not null,
 revision integer not null default 1, autor uuid not null, updated_at timestamptz not null default now(),
 unique(obra_id,tipo,correlativo)
);
create table if not exists private.specialty_audit (
 id bigint generated always as identity primary key, obra_id integer not null, actor uuid not null,
 accion text not null, referencia text, created_at timestamptz not null default now()
);
create table if not exists private.specialty_requests (
 id uuid primary key, actor uuid not null, obra_id integer not null, action text not null, payload jsonb not null, response jsonb not null
);
alter table private.specialty_requests enable row level security;
revoke all on private.specialty_requests from public,anon,authenticated;
alter table private.specialty_settings enable row level security;
alter table private.specialty_sessions enable row level security;
alter table private.specialty_elements enable row level security;
alter table private.specialty_protocols enable row level security;
alter table private.specialty_audit enable row level security;
revoke all on private.specialty_settings,private.specialty_sessions,private.specialty_elements,private.specialty_protocols,private.specialty_audit from public,anon,authenticated;
alter table public.avances_produccion_partidas add column if not exists specialty_session_id uuid;
create unique index if not exists progress_specialty_session on public.avances_produccion_partidas(specialty_session_id) where specialty_session_id is not null;

create or replace function private.specialty_api(p_work integer,p_action text,p_data jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 w public.obras%rowtype; actor public.usuarios%rowtype; cfg private.specialty_settings%rowtype;
 s private.specialty_sessions%rowtype; el private.specialty_elements%rowtype; proto private.specialty_protocols%rowtype;
 part public.partidas_obra%rowtype; adm boolean; uid uuid:=auth.uid(); x jsonb; result jsonb;
 sid uuid; pid integer; count_piles integer; rid integer; ids integer[]; total numeric; role_uid uuid; req private.specialty_requests%rowtype;
begin
 select * into w from public.obras where id=p_work;
 if uid is null or w.id is null or not coalesce(private.rrhh_partidas_permiso(w.empresa,w.id,'ver'),false) then raise exception 'No autorizado para esta obra';end if;
 select * into actor from public.usuarios where auth_user_id=uid and empresa=w.empresa order by id limit 1;
 adm:=lower(coalesce(nullif(actor.rol_base,''),actor.rol,'')) in ('administrador de empresa','administrador empresa','administrador de contratos','administrador de contrato');
 if p_action='state' then
  return jsonb_build_object('settings',coalesce((select jsonb_agg(to_jsonb(t)) from private.specialty_settings t where obra_id=p_work),'[]'),
   'elements',coalesce((select jsonb_agg(to_jsonb(t) order by etapa,numero) from private.specialty_elements t where obra_id=p_work),'[]'),
   'sessions',coalesce((select jsonb_agg(to_jsonb(t) order by fecha desc) from private.specialty_sessions t where obra_id=p_work),'[]'),
   'protocols',coalesce((select jsonb_agg(to_jsonb(t) order by fecha desc) from private.specialty_protocols t where obra_id=p_work),'[]'),
   'protocol_create',coalesce(private.obraxis_permission(w.empresa,'obras.calidad.crear'),false),'protocol_edit',coalesce(private.obraxis_permission(w.empresa,'obras.calidad.editar'),false),
   'can_execute',coalesce(private.obraxis_permission(w.empresa,'obras.avances.crear'),false),'can_configure',adm,'actor',uid,
   'reminders',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'hora',coalesce(r.hora_envio,time '20:00'),'push',r.canal_push,'dias_no_laborales',coalesce(r.condiciones->'dias_no_laborales','[]'::jsonb))) from public.notificaciones_reglas r where r.empresa=w.empresa and r.activa and r.evento_codigo='especialidad_jornada_abierta' and (coalesce(r.condiciones->>'alcance_tipo',case when r.obra_nombre is null then 'todas' else 'seleccionadas' end)<>'seleccionadas' or r.obra_nombre=w.nombre or coalesce(r.condiciones->'obras_seleccionadas','[]'::jsonb)?w.nombre)),'[]'),
   'reports',case when adm then coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'partida_id',a.partida_id,'partida',a.partida,'cantidad',a.cantidad,'fecha',(a.created_at at time zone 'America/Santiago')::date)) from public.avances_produccion_partidas a where a.obra_id=p_work),'[]') else '[]'::jsonb end,
   'users',case when adm then coalesce((select jsonb_agg(jsonb_build_object('id',u.auth_user_id,'nombre',coalesce(u.nombre,u.usuario))) from public.usuarios u where u.empresa=w.empresa and u.auth_user_id is not null and exists(select 1 from unnest(string_to_array(u.obras,',')) v where lower(trim(v)) in ('todas',lower(w.nombre)))),'[]') else '[]'::jsonb end);
 end if;
 -- Serialize decisions for this work, including concurrent closes on different devices.
 perform pg_advisory_xact_lock(78231,p_work);
 if p_data ? 'request_id' then
  select * into req from private.specialty_requests where id=(p_data->>'request_id')::uuid;
  if req.id is not null then
   if req.actor<>uid or req.obra_id<>p_work or req.action<>p_action or req.payload<>p_data then raise exception 'Identificador de solicitud reutilizado con otros datos';end if;
   return req.response;
  end if;
 end if;
 if p_action='undo_reconcile' then
  if not adm then raise exception 'Solo administración puede deshacer conciliaciones';end if;
  select * into s from private.specialty_sessions where id=(p_data->>'id')::uuid and obra_id=p_work and partida_id=(p_data->>'partida_id')::integer for update;
  if not found or s.estado<>'historica' then raise exception 'No hay una conciliación histórica vigente para esta jornada';end if;
  if s.revision is distinct from (p_data->>'revision')::integer then raise exception 'La jornada cambió; actualiza antes de continuar';end if;
  if exists(select 1 from private.specialty_protocols where sesion_id=s.id) then raise exception 'Hay protocolos vinculados. No se modificó la conciliación';end if;
  insert into private.specialty_audit(obra_id,actor,accion,referencia) values(p_work,uid,p_action,to_jsonb(s)::text);
  update private.specialty_elements set sesion_id=null where sesion_id=s.id;
  delete from private.specialty_sessions where id=s.id;
  return jsonb_build_object('desvinculada',true,'report_ids',s.report_ids);
 end if;
 pid:=nullif(p_data->>'partida_id','')::integer;
 if p_action in ('save','close','topography','protocol','reconcile') then
  sid:=(p_data->>'id')::uuid;
  if exists(select 1 from private.specialty_sessions where id=sid and obra_id<>p_work) then raise exception 'Jornada de otra obra';end if;
  select * into s from private.specialty_sessions where id=sid and obra_id=p_work for update;
  if s.id is not null then pid:=s.partida_id;end if;
 end if;
 select * into part from public.partidas_obra where id=pid and obra_id=p_work and empresa=w.empresa and not coalesce(es_titulo,false);
 if part.id is null then raise exception 'Selecciona una partida válida de la obra';end if;
 select * into cfg from private.specialty_settings where obra_id=p_work and partida_id=pid;
 if p_action='configure' then
  if not adm then raise exception 'Solo administración puede asignar responsables';end if;
  if upper(part.unidad) not in ('UND','UN','UNIDAD','UNIDADES') then raise exception 'Pilas de grava requiere una partida medida en unidades';end if;
  foreach role_uid in array array[nullif(p_data->>'ejecucion','')::uuid,nullif(p_data->>'topografia','')::uuid,nullif(p_data->>'calidad','')::uuid] loop
   if role_uid is not null and not exists(select 1 from public.usuarios u where u.auth_user_id=role_uid and u.empresa=w.empresa and exists(select 1 from unnest(string_to_array(u.obras,',')) v where lower(trim(v)) in ('todas',lower(w.nombre)))) then raise exception 'Responsable sin acceso a esta obra';end if;
  end loop;
  if cfg.obra_id is not null and cfg.revision<>coalesce((p_data->>'revision')::integer,0) then raise exception 'Configuración modificada por otro usuario; actualiza';end if;
  if nullif(p_data->>'activa_desde','') is null then raise exception 'Indica fecha de inicio';end if;
  if cfg.obra_id is not null and cfg.activa_desde<>(p_data->>'activa_desde')::date and exists(select 1 from private.specialty_sessions where obra_id=p_work and partida_id=pid and estado<>'historica') then raise exception 'Ya existen jornadas: no puede cambiarse la fecha de inicio';end if;
  insert into private.specialty_settings(obra_id,partida_id,ejecucion,topografia,calidad,activa_desde,datos_fijos)
   values(p_work,pid,nullif(p_data->>'ejecucion','')::uuid,nullif(p_data->>'topografia','')::uuid,nullif(p_data->>'calidad','')::uuid,(p_data->>'activa_desde')::date,coalesce(p_data->'datos_fijos','{}'))
   on conflict(obra_id,partida_id) do update set ejecucion=excluded.ejecucion,topografia=excluded.topografia,calidad=excluded.calidad,activa_desde=excluded.activa_desde,datos_fijos=excluded.datos_fijos,revision=private.specialty_settings.revision+1;
 elsif cfg.obra_id is null then raise exception 'Configura primero la especialidad y sus responsables';
 elsif p_action='catalog' then
  if not adm then raise exception 'Solo administración puede cargar el catálogo';end if;
  if jsonb_typeof(p_data->'rows')<>'array' or jsonb_array_length(p_data->'rows')>10000 then raise exception 'Catálogo inválido';end if;
  for x in select value from jsonb_array_elements(p_data->'rows') loop
   select * into el from private.specialty_elements where obra_id=p_work and partida_id=pid and etapa=x->>'etapa' and numero=x->>'numero';
   if el.id is not null then
    if el.norte<>(x->>'norte')::numeric or el.este<>(x->>'este')::numeric or el.longitud_diseno is distinct from nullif(x->>'longitud_diseno','')::numeric then raise exception 'El catálogo difiere para pila %; no se sobrescribió',el.numero;end if;
   else
    insert into private.specialty_elements(obra_id,partida_id,etapa,numero,norte,este,longitud_diseno) values(p_work,pid,x->>'etapa',x->>'numero',(x->>'norte')::numeric,(x->>'este')::numeric,nullif(x->>'longitud_diseno','')::numeric);
   end if;
  end loop;
 elsif p_action in ('save','close','reconcile') then
  if (p_action='reconcile' and not adm) or (p_action<>'reconcile' and not coalesce(private.obraxis_permission(w.empresa,'obras.avances.crear'),false)) then raise exception 'Falta permiso para registrar avances de obra';end if;
  if s.id is not null and s.estado<>'abierta' then
   if p_action in ('close','reconcile') then return to_jsonb(s);end if;
   raise exception 'Jornada cerrada: no se puede sobrescribir';
  end if;
  if s.id is not null and s.revision<>coalesce((p_data->>'revision')::integer,-1) then raise exception 'Conflicto de sincronización: conserva tu borrador y actualiza';end if;
  if s.id is not null and (p_data->>'fecha')::date is distinct from s.fecha then raise exception 'No se puede cambiar la fecha ni el autor de una jornada';end if;
  if s.id is null and coalesce((p_data->>'revision')::integer,0)<>0 then raise exception 'Jornada no encontrada';end if;
  if p_action<>'reconcile' and (p_data->>'fecha')::date<cfg.activa_desde then raise exception 'El historial anterior debe conciliarse, no cargarse nuevamente';end if;
  if (p_data->>'fecha')::date>(now() at time zone 'America/Santiago')::date then raise exception 'No se permite ejecutar en fecha futura';end if;
  if jsonb_typeof(p_data->'datos'->'pilas') is distinct from 'array' then raise exception 'Detalle de pilas inválido';end if;
  if jsonb_array_length(p_data->'datos'->'pilas')>1000 then raise exception 'Demasiadas pilas en una jornada';end if;
  if p_action<>'reconcile' and exists(select 1 from public.avances_produccion_partidas a where a.obra_id=p_work and (a.partida_id=pid or (a.partida_id is null and lower(trim(a.partida))=lower(trim(part.partida)))) and (a.created_at at time zone 'America/Santiago')::date=(p_data->>'fecha')::date and a.specialty_session_id is distinct from sid) then raise exception 'Ya existe avance por unidades en esa fecha. Debe conciliarse antes de abrir una jornada';end if;
  if (select count(*)<>count(distinct value->>'element_id') from jsonb_array_elements(p_data->'datos'->'pilas')) then raise exception 'Pila repetida dentro de la jornada';end if;
  for x in select value from jsonb_array_elements(p_data->'datos'->'pilas') loop
   select * into el from private.specialty_elements where id=(x->>'element_id')::uuid and obra_id=p_work and partida_id=pid;
   if el.id is null then raise exception 'Pila ajena al catálogo de la partida';end if;
   if el.sesion_id is not null and el.sesion_id<>sid then raise exception 'Pila % ya ejecutada en otra jornada',el.numero;end if;
   if coalesce((x->>'terminada')::boolean,false) and p_action in ('close','reconcile') then
    if exists(select 1 from jsonb_each_text(x) v where v.key in ('paladas','volumen','longitud','volumen_cuchara','longitud_perforacion','diametro','profundidad') and v.value in ('NaN','Infinity','-Infinity')) then raise exception 'Valores numéricos inválidos';end if;
    if nullif(x->>'paladas','')::numeric is null or (x->>'paladas')::numeric<0 or nullif(x->>'volumen','')::numeric is null or (x->>'volumen')::numeric<0 or nullif(x->>'longitud','')::numeric is null or (x->>'longitud')::numeric<=0 then raise exception 'Completa paladas, volumen y longitud de las pilas terminadas';end if;
    if p_action='close' and nullif(trim(x->>'equipo'),'') is null then raise exception 'Indica el equipo de cada pila terminada';end if;
   end if;
  end loop;
  insert into private.specialty_sessions(id,obra_id,partida_id,fecha,responsable,datos,revision)
   values(sid,p_work,pid,(p_data->>'fecha')::date,uid,p_data->'datos',1)
   on conflict(id) do update set datos=excluded.datos,revision=private.specialty_sessions.revision+1;
  if p_action in ('close','reconcile') then
   select count(*) into count_piles from jsonb_array_elements(p_data->'datos'->'pilas') where coalesce((value->>'terminada')::boolean,false);
   if p_action='reconcile' then
    if not adm then raise exception 'La conciliación histórica requiere administración';end if;
    select array_agg(value::integer) into ids from jsonb_array_elements_text(p_data->'report_ids');
    if coalesce(cardinality(ids),0)=0 then raise exception 'Selecciona los reportes existentes para conciliar';end if;
    if exists(select 1 from private.specialty_sessions t where t.id<>sid and t.report_ids && ids) then raise exception 'Un reporte ya fue conciliado';end if;
    select sum(cantidad) into total from public.avances_produccion_partidas where id=any(ids) and obra_id=p_work and partida_id=pid and (created_at at time zone 'America/Santiago')::date=(p_data->>'fecha')::date;
    if total is distinct from count_piles::numeric or (select count(*) from public.avances_produccion_partidas where id=any(ids) and obra_id=p_work and partida_id=pid and (created_at at time zone 'America/Santiago')::date=(p_data->>'fecha')::date)<>cardinality(ids) then raise exception 'El historial no coincide con los reportes: revisa fecha, partida y cantidad. No se modificó el avance';end if;
   else
    perform set_config('obraxis.specialty_write',sid::text,true);
    insert into public.avances_produccion_partidas(empresa,obra_id,obra_nombre,supervisor,partida_id,partida,unidad,cantidad,observaciones,created_at,specialty_session_id)
     values(w.empresa,p_work,w.nombre,coalesce(actor.nombre,actor.usuario),pid,part.partida,part.unidad,count_piles,p_data->'datos'->>'observaciones',((p_data->>'fecha')::date+time '12:00') at time zone 'America/Santiago',sid) returning id into rid;
    ids:=array[rid];
    perform set_config('obraxis.specialty_write','',true);
   end if;
   update private.specialty_elements set sesion_id=sid where id in (select (value->>'element_id')::uuid from jsonb_array_elements(p_data->'datos'->'pilas') where coalesce((value->>'terminada')::boolean,false));
   update private.specialty_sessions set estado=case when p_action='reconcile' then 'historica' else 'cerrada' end,closed_at=now(),report_ids=ids where id=sid;
  end if;
  select to_jsonb(t) into result from private.specialty_sessions t where id=sid;
 elsif p_action='protocol_defaults' then
  if uid is distinct from cfg.calidad then raise exception 'Solo el responsable de Calidad puede guardar datos fijos';end if;
  if jsonb_typeof(p_data->'datos_fijos') is distinct from 'object' then raise exception 'Datos fijos inválidos';end if;
  update private.specialty_settings set datos_fijos=p_data->'datos_fijos',revision=revision+1 where obra_id=p_work and partida_id=pid;
 elsif p_action='topography' then
  if uid is distinct from cfg.topografia then raise exception 'Solo el topógrafo designado puede completar estos datos';end if;
  select * into el from private.specialty_elements where id=(p_data->>'element_id')::uuid and obra_id=p_work and partida_id=pid;
  if el.id is null or el.revision_topografia<>coalesce((p_data->>'revision')::integer,-1) then raise exception 'Datos topográficos modificados; actualiza';end if;
  if jsonb_typeof(p_data->'datos') is distinct from 'object' then raise exception 'Datos topográficos inválidos';end if;
  for x in select jsonb_build_object('key',key,'value',value) from jsonb_each_text(p_data->'datos') where key in ('cota_inicial','cota_final','norte_real','este_real','cota_real','cota_diseno','deformacion','cst','bst','profundidad_control') loop
   if nullif(x->>'value','') is not null and ((x->>'value') in ('NaN','Infinity','-Infinity') or not (x->>'value') ~ '^-?[0-9]+([.][0-9]+)?$') then raise exception 'Dato numérico inválido: %',x->>'key';end if;
  end loop;
  update private.specialty_elements set topografia=p_data->'datos',revision_topografia=revision_topografia+1 where id=el.id;
  result:=jsonb_build_object('ok',true,'revision',el.revision_topografia+1);
 elsif p_action='protocol' then
  if not coalesce(uid=cfg.calidad or (p_data->>'tipo'='topografia' and uid=cfg.topografia) or
   (p_data->>'estado'='borrador' and private.obraxis_permission(w.empresa,case when exists(select 1 from private.specialty_protocols where id=(p_data->>'protocol_id')::uuid) then 'obras.calidad.editar' else 'obras.calidad.crear' end)),false) then raise exception 'Se requiere el permiso de Calidad o el responsable designado';end if;
  if s.id is null or s.estado='abierta' then raise exception 'Selecciona una jornada cerrada';end if;
  if coalesce(jsonb_array_length(p_data->'element_ids'),0)=0 then raise exception 'Selecciona las pilas del protocolo';end if;
  if exists(select 1 from jsonb_array_elements_text(p_data->'element_ids') i where not exists(select 1 from private.specialty_elements e where e.id=i::uuid and e.sesion_id=sid)) then raise exception 'El protocolo contiene pilas de otra jornada';end if;
  select * into proto from private.specialty_protocols where id=(p_data->>'protocol_id')::uuid;
  if proto.id is not null and (proto.obra_id<>p_work or proto.sesion_id<>sid or proto.tipo<>p_data->>'tipo' or proto.correlativo<>p_data->>'correlativo' or proto.estado='aprobado' or proto.revision<>coalesce((p_data->>'revision')::integer,0)) then raise exception 'Protocolo aprobado, distinto o modificado; no se sobrescribió';end if;
  if nullif(trim(p_data->>'correlativo'),'') is null then raise exception 'Indica correlativo';end if;
  if p_data->>'estado'='aprobado' and (nullif(trim(coalesce(p_data->'fijos'->>'plano',cfg.datos_fijos->>'plano')),'') is null or nullif(trim(coalesce(p_data->'fijos'->>'mandante',cfg.datos_fijos->>'mandante')),'') is null) then raise exception 'Completa plano y mandante antes de aprobar';end if;
  if p_data->>'estado'='aprobado' and exists(select 1 from private.specialty_elements e where e.id in(select value::uuid from jsonb_array_elements_text(p_data->'element_ids')) and (nullif(e.topografia->>'cota_inicial','') is null or nullif(e.topografia->>'cota_final','') is null)) then raise exception 'Topografía debe completar las cotas inicial y final antes de aprobar';end if;
  if p_data->>'estado'='aprobado' and uid is distinct from cfg.calidad then raise exception 'La aprobación corresponde al responsable de Calidad';end if;
  select jsonb_build_object('obra',w.nombre,'empresa',w.empresa,'partida',part.partida,'fecha',s.fecha,'fijos',cfg.datos_fijos||coalesce(p_data->'fijos','{}'),'observaciones',s.datos->>'observaciones','pilas',jsonb_agg(to_jsonb(e)||jsonb_build_object('ejecucion',j.value) order by e.etapa,e.numero),'autor',coalesce(proto.snapshot->>'autor',actor.nombre,actor.usuario),'aprobado_por',case when p_data->>'estado'='aprobado' then coalesce(actor.nombre,actor.usuario) else null end,'aprobado_at',case when p_data->>'estado'='aprobado' then now() else null end) into result
   from private.specialty_elements e join jsonb_array_elements(s.datos->'pilas') j on j.value->>'element_id'=e.id::text
   where e.sesion_id=sid and e.id in (select value::uuid from jsonb_array_elements_text(p_data->'element_ids'));
  result:=result||jsonb_build_object('catalogo',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'numero',e.numero,'etapa',e.etapa,'norte',e.norte,'este',e.este,'sesion_id',case when j.fecha<=s.fecha then e.sesion_id else null end)),'[]') from private.specialty_elements e left join private.specialty_sessions j on j.id=e.sesion_id where e.obra_id=p_work and e.partida_id=pid));
  insert into private.specialty_protocols(id,obra_id,sesion_id,tipo,fecha,correlativo,estado,snapshot,autor)
   values((p_data->>'protocol_id')::uuid,p_work,sid,p_data->>'tipo',s.fecha,p_data->>'correlativo',p_data->>'estado',result,uid)
   on conflict(id) do update set snapshot=excluded.snapshot,estado=excluded.estado,revision=private.specialty_protocols.revision+1,updated_at=now();
 else raise exception 'Acción no admitida';
 end if;
 insert into private.specialty_audit(obra_id,actor,accion,referencia) values(p_work,uid,p_action,coalesce(sid::text,pid::text));
 result:=coalesce(result,jsonb_build_object('ok',true));
 if p_data ? 'request_id' then insert into private.specialty_requests(id,actor,obra_id,action,payload,response) values((p_data->>'request_id')::uuid,uid,p_work,p_action,p_data,result);end if;
 return result;
end $$;
revoke all on function private.specialty_api(integer,text,jsonb) from public,anon;
grant execute on function private.specialty_api(integer,text,jsonb) to authenticated;
create or replace function public.specialty_api(p_work integer,p_action text,p_data jsonb default '{}')
returns jsonb language sql security invoker set search_path='' as $$select private.specialty_api(p_work,p_action,p_data)$$;
revoke all on function public.specialty_api(integer,text,jsonb) from public,anon;
grant execute on function public.specialty_api(integer,text,jsonb) to authenticated;
create or replace function public.eliminar_avance_conciliado(p_work integer,p_report integer,p_session uuid,p_revision integer,p_part integer)
returns integer language plpgsql security invoker set search_path='' as $$
declare unlinked jsonb; removed integer;
begin
 if auth.uid() is null then raise exception 'Sesión requerida'; end if;
 unlinked:=private.specialty_api(p_work,'undo_reconcile',jsonb_build_object('id',p_session,'revision',p_revision,'partida_id',p_part));
 if not coalesce((unlinked->'report_ids') @> jsonb_build_array(p_report),false) then raise exception 'El reporte no pertenece a la conciliación seleccionada'; end if;
 delete from public.avances_produccion_partidas where id=p_report and obra_id=p_work and partida_id=p_part
 and private.obraxis_permission(empresa,'obras.avances.eliminar') returning id into removed;
 if removed is null then raise exception 'No se pudo eliminar el reporte. La conciliación se conserva'; end if;
 return removed;
end; $$;
revoke all on function public.eliminar_avance_conciliado(integer,integer,uuid,integer,integer) from public,anon;
grant execute on function public.eliminar_avance_conciliado(integer,integer,uuid,integer,integer) to authenticated;

create or replace function private.guard_specialty_progress() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op in ('UPDATE','DELETE') and (old.specialty_session_id is not null or exists(select 1 from private.specialty_sessions where old.id=any(report_ids))) then raise exception 'Este avance está vinculado a una jornada por especialidad; no puede editarse como reporte por unidades';end if;
 if tg_op='DELETE' then return old;end if;
 if new.specialty_session_id is not null then
  if current_setting('obraxis.specialty_write',true) is distinct from new.specialty_session_id::text then raise exception 'El avance por especialidad se genera únicamente al cerrar la jornada';end if;
 elsif exists(select 1 from private.specialty_settings c join public.partidas_obra p on p.id=c.partida_id where c.obra_id=new.obra_id and (c.partida_id=new.partida_id or (new.partida_id is null and p.partida=new.partida)) and (new.created_at at time zone 'America/Santiago')::date>=c.activa_desde) then
  raise exception 'Esta partida usa reportes por especialidad desde la fecha configurada. Registra sus pilas y cierra la jornada para evitar duplicar avance';
 end if;
 return new;
end $$;
revoke all on function private.guard_specialty_progress() from public,anon,authenticated;
drop trigger if exists guard_specialty_progress on public.avances_produccion_partidas;
create trigger guard_specialty_progress before insert or update or delete on public.avances_produccion_partidas for each row execute function private.guard_specialty_progress();
