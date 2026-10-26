-- Stable project link; legacy personal/mobile requests remain valid and unassigned.
alter table public.solicitudes add column obra_id integer references public.obras(id) on delete restrict;
alter table public.solicitudes add column obra_nombre text;
create index solicitudes_obra_idx on public.solicitudes(obra_id,updated_at desc);
create or replace function private.solicitudes_operar(p_perfil integer,p_accion text,p_datos jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 actor public.usuarios%rowtype; receptor public.usuarios%rowtype;
 s public.solicitudes%rowtype; dep public.solicitudes_departamentos%rowtype;
 work public.obras%rowtype; work_id integer;
 sid uuid; eid uuid; nuevo_estado text; mensaje text; resultado jsonb; objetivo integer;
begin
 if auth.uid() is null then raise exception 'Debes iniciar sesión'; end if;
 select * into actor from public.usuarios where id=p_perfil and auth_user_id=auth.uid();
 if not found then raise exception 'Perfil no autorizado'; end if;
 work_id:=nullif(p_datos->>'obra_id','')::integer;
 if work_id is not null then
  select * into work from public.obras where id=work_id and empresa=actor.empresa;
  if not found then raise exception 'Obra no válida para esta empresa'; end if;
  if not (lower(coalesce(actor.rol,''))='superusuario' or exists(select 1 from unnest(string_to_array(lower(coalesce(actor.obras,'')),',')) scope(name) where btrim(scope.name) in ('todas',lower(btrim(work.nombre))))) then
   raise exception 'No tienes acceso a esta obra';
  end if;
 end if;
 if p_accion='opciones' then
  return jsonb_build_object('usuarios',coalesce((select jsonb_agg(jsonb_build_object('id',id,'nombre',coalesce(nullif(nombre,''),usuario),'cargo',cargo) order by nombre) from public.usuarios where empresa=actor.empresa and auth_user_id is not null and id<>actor.id),'[]'::jsonb),
   'departamentos',coalesce((select jsonb_agg(to_jsonb(d) order by nombre) from public.solicitudes_departamentos d where empresa=actor.empresa),'[]'::jsonb),
   'obras',coalesce((select jsonb_agg(jsonb_build_object('id',o.id,'nombre',o.nombre) order by o.nombre) from public.obras o where o.empresa=actor.empresa and (lower(coalesce(actor.rol,''))='superusuario' or exists(select 1 from unnest(string_to_array(lower(coalesce(actor.obras,'')),',')) scope(name) where btrim(scope.name) in ('todas',lower(btrim(o.nombre)))))),'[]'::jsonb),
   'puede_configurar',private.obraxis_actor_can_manage_company(actor.empresa));
 elsif p_accion='departamento' then
  if not private.obraxis_actor_can_manage_company(actor.empresa) then raise exception 'Solo la administración puede configurar departamentos'; end if;
  select * into receptor from public.usuarios where id=(p_datos->>'responsable_id')::integer and empresa=actor.empresa and auth_user_id is not null;
  if not found then raise exception 'Responsable no válido para esta empresa'; end if;
  if nullif(p_datos->>'id','') is null then
   insert into public.solicitudes_departamentos(empresa,nombre,responsable_id) values(actor.empresa,btrim(p_datos->>'nombre'),receptor.id) returning * into dep;
  else
   update public.solicitudes_departamentos set nombre=btrim(p_datos->>'nombre'),responsable_id=receptor.id,activo=coalesce((p_datos->>'activo')::boolean,true)
   where id=(p_datos->>'id')::uuid and empresa=actor.empresa returning * into dep;
   if not found then raise exception 'Departamento no autorizado'; end if;
  end if;
  return to_jsonb(dep);
 elsif p_accion='listar' then
  select coalesce(jsonb_agg(to_jsonb(q)),'[]'::jsonb) into resultado from (
   select listed.*,coalesce(a.nombre,a.usuario) solicitante_nombre,coalesce(b.nombre,b.usuario) destinatario_nombre
   from public.solicitudes listed join public.usuarios a on a.id=listed.solicitante_id join public.usuarios b on b.id=listed.destinatario_id
   where (work_id is null or listed.obra_id=work_id) and listed.empresa=actor.empresa and actor.id in (listed.solicitante_id,listed.destinatario_id)
   and (case when p_datos->>'bandeja'='recibidas' then listed.destinatario_id=actor.id else listed.solicitante_id=actor.id end)
   and (case when p_datos->>'historial'='true' then listed.estado in ('Rechazada','Completada') else listed.estado not in ('Rechazada','Completada') end)
   order by listed.updated_at desc,listed.id limit 51 offset greatest(0,least(coalesce((p_datos->>'offset')::integer,0),100000))
  ) q;
  return resultado;
 elsif p_accion='crear' then
  sid:=(p_datos->>'id')::uuid;
  if sid is null then raise exception 'Falta identificador de la solicitud'; end if;
  -- Serializes retries with the same client-generated UUID.
  perform pg_advisory_xact_lock(hashtextextended(sid::text,0));
  select * into s from public.solicitudes where id=sid;
  if found then
   if s.empresa<>actor.empresa or s.solicitante_id<>actor.id then raise exception 'Identificador no disponible'; end if;
   return to_jsonb(s);
  end if;
  if nullif(p_datos->>'departamento_id','') is not null then
   select * into dep from public.solicitudes_departamentos where id=(p_datos->>'departamento_id')::uuid and empresa=actor.empresa and activo;
   if not found then raise exception 'Departamento no disponible'; end if;
   objetivo:=dep.responsable_id;
  else objetivo:=(p_datos->>'destinatario_id')::integer; end if;
  select * into receptor from public.usuarios where id=objetivo and empresa=actor.empresa and auth_user_id is not null and id<>actor.id;
  if not found then raise exception 'Selecciona otro usuario de tu empresa como destinatario'; end if;
  insert into public.solicitudes(id,empresa,solicitante_id,destinatario_id,departamento_id,departamento_nombre,categoria,titulo,descripcion,referencia,fecha_requerida,obra_id,obra_nombre)
   values(sid,actor.empresa,actor.id,receptor.id,dep.id,dep.nombre,p_datos->>'categoria',btrim(p_datos->>'titulo'),btrim(p_datos->>'descripcion'),nullif(btrim(p_datos->>'referencia'),''),nullif(p_datos->>'fecha_requerida','')::date,work.id,work.nombre) returning * into s;
  mensaje:='Solicitud enviada'; eid:=gen_random_uuid();
 elsif p_accion in ('detalle','responder') then
  select * into s from public.solicitudes where id=(p_datos->>'id')::uuid and empresa=actor.empresa and actor.id in (solicitante_id,destinatario_id) for update;
  if not found then raise exception 'Solicitud no disponible para tu usuario'; end if;
  if work_id is not null and s.obra_id is distinct from work_id then raise exception 'La solicitud pertenece a otra obra'; end if;
  if p_accion='detalle' then
   return jsonb_build_object('solicitud',to_jsonb(s),'eventos',coalesce((select jsonb_agg(to_jsonb(e) order by created_at,id) from public.solicitudes_eventos e where solicitud_id=s.id),'[]'::jsonb));
  end if;
  eid:=(p_datos->>'evento_id')::uuid;
  if eid is null then raise exception 'Falta identificador de respuesta'; end if;
  if exists(select 1 from public.solicitudes_eventos where id=eid and solicitud_id=s.id and actor_id=actor.id) then return to_jsonb(s); end if;
  if (p_datos->>'version')::integer is distinct from s.version then raise exception 'La solicitud cambió. Actualiza antes de responder'; end if;
  if s.estado in ('Rechazada','Completada') then raise exception 'La solicitud está cerrada'; end if;
  nuevo_estado:=coalesce(nullif(p_datos->>'estado',''),s.estado);
  mensaje:=btrim(coalesce(p_datos->>'mensaje',''));
  if nuevo_estado<>s.estado then
   if actor.id<>s.destinatario_id then raise exception 'Solo el destinatario puede cambiar el estado'; end if;
   if not ((s.estado in ('Pendiente','En revisión') and nuevo_estado in ('En revisión','Aprobada','Rechazada')) or (s.estado='Aprobada' and nuevo_estado='Completada')) then raise exception 'Cambio de estado no permitido'; end if;
   if nuevo_estado='Rechazada' and length(mensaje)<3 then raise exception 'Indica el motivo del rechazo'; end if;
   if mensaje='' then mensaje:='Estado cambiado a '||nuevo_estado; end if;
  end if;
  if mensaje='' then raise exception 'Escribe una respuesta'; end if;
  update public.solicitudes set estado=nuevo_estado,version=version+1,updated_at=now() where id=s.id returning * into s;
  objetivo:=case when actor.id=s.solicitante_id then s.destinatario_id else s.solicitante_id end;
 else raise exception 'Acción no válida'; end if;
 insert into public.solicitudes_eventos(id,solicitud_id,actor_id,actor_nombre,mensaje,estado) values(eid,s.id,actor.id,coalesce(nullif(actor.nombre,''),actor.usuario),mensaje,s.estado);
 insert into public.notificaciones_entregas(empresa,evento_codigo,canal,destinatario,asunto,estado,payload,enviada_at)
 values(actor.empresa,'solicitudes_actualizacion','Plataforma',objetivo::text,
  case when p_accion='crear' then 'Nueva solicitud: ' else 'Solicitud actualizada: ' end||s.titulo,'Enviada',
  jsonb_build_object('solicitud_id',s.id,'route','/solicitudes','estado',s.estado,'obra_id',s.obra_id,'obra_nombre',s.obra_nombre),now());
 return to_jsonb(s);
end $$;
