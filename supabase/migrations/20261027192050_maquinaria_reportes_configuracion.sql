-- Configuration belongs to Machinery, not to anonymous form submitters.
create table public.maquinaria_reporte_config (
 empresa text primary key, codigo text not null default 'MAQ-01' check(length(btrim(codigo)) between 1 and 35),
 revision text not null default '01' check(length(btrim(revision)) between 1 and 15),
 responsable_id integer references public.usuarios(id), actualizado_en timestamptz not null default now()
);
alter table public.maquinaria_reporte_config enable row level security;
revoke all on public.maquinaria_reporte_config from public,anon,authenticated;
grant select on public.maquinaria_reporte_config to authenticated;
grant all on public.maquinaria_reporte_config to service_role;
create policy reporte_config_lectura on public.maquinaria_reporte_config for select to authenticated
 using((select private.obraxis_actor_can_access_company(empresa)));
create index maquinaria_reporte_responsable_idx on public.maquinaria_reporte_config(responsable_id);
create table public.maquinaria_reporte_equipo (
 equipo_id integer primary key references public.inventario_maquinaria(id) on delete cascade,
 empresa text not null, unidad text not null default 'h' check(unidad in ('h','km')),
 qr_activo boolean not null default true, actualizado_en timestamptz not null default now()
);
alter table public.maquinaria_reporte_equipo enable row level security;
revoke all on public.maquinaria_reporte_equipo from public,anon,authenticated;
grant select on public.maquinaria_reporte_equipo to authenticated;
grant all on public.maquinaria_reporte_equipo to service_role;
create policy reporte_equipo_lectura on public.maquinaria_reporte_equipo for select to authenticated
 using((select private.obraxis_actor_can_access_company(empresa)));
create index maquinaria_reporte_equipo_empresa_idx on public.maquinaria_reporte_equipo(empresa);
alter table public.maquinaria_uso_diario add column reporte_datos jsonb, add column solicitud_id uuid,
 add column registrado_por text;
create unique index maquinaria_reporte_solicitud on public.maquinaria_uso_diario(empresa,solicitud_id) where solicitud_id is not null;
alter table public.maquinaria_fallas add column uso_diario_id bigint references public.maquinaria_uso_diario(id);
create index maquinaria_falla_reporte_idx on public.maquinaria_fallas(uso_diario_id) where uso_diario_id is not null;

create function private.maquinaria_configurar_reporte(p_empresa text,p_accion text,p_datos jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare admin boolean; responsable integer; conf public.maquinaria_reporte_config%rowtype; eq public.inventario_maquinaria%rowtype; actor integer;
begin
 if auth.uid() is null or not private.obraxis_actor_can_access_company(p_empresa) then raise exception 'Sin acceso a esta empresa'; end if;
 select id into actor from public.usuarios where auth_user_id=auth.uid() limit 1;
 select * into conf from public.maquinaria_reporte_config where empresa=p_empresa;
 admin:=private.obraxis_permission(p_empresa,'maquinaria.inventario.configurar');
 if not admin and (conf.responsable_id is distinct from actor or not private.obraxis_permission(p_empresa,'maquinaria.inventario.ver')) then raise exception 'Solo configuración de maquinaria o su responsable pueden modificar el reporte'; end if;
 if p_accion='consultar' then
   return jsonb_build_object('config',case when conf.empresa is null then '{"codigo":"MAQ-01","revision":"01","responsable_id":null}'::jsonb else to_jsonb(conf) end,'puede_designar',admin,'usuarios',case when admin then
    (select coalesce(jsonb_agg(jsonb_build_object('id',id,'nombre',coalesce(nombre,usuario)) order by nombre),'[]') from public.usuarios where empresa=p_empresa and auth_user_id is not null) else '[]'::jsonb end);
 elsif p_accion='documento' then
   responsable:=nullif(p_datos->>'responsable_id','')::integer;
   if not admin and responsable is distinct from conf.responsable_id then raise exception 'Solo quien configura maquinaria puede designar al responsable'; end if;
   if responsable is not null and not exists(select 1 from public.usuarios where id=responsable and empresa=p_empresa and auth_user_id is not null) then raise exception 'Responsable no disponible en esta empresa'; end if;
   insert into public.maquinaria_reporte_config(empresa,codigo,revision,responsable_id) values(p_empresa,btrim(p_datos->>'codigo'),btrim(p_datos->>'revision'),responsable)
   on conflict(empresa) do update set codigo=excluded.codigo,revision=excluded.revision,responsable_id=excluded.responsable_id,actualizado_en=now();
 elsif p_accion in ('equipo','renovar_qr') then
   select * into eq from public.inventario_maquinaria where id=(p_datos->>'equipo_id')::integer and empresa=p_empresa for update;
   if not found then raise exception 'Equipo no disponible'; end if;
   if p_accion='renovar_qr' then
     update public.inventario_maquinaria set publico_token=encode(extensions.gen_random_bytes(24),'hex') where id=eq.id;
   else
     insert into public.maquinaria_reporte_equipo(equipo_id,empresa,unidad,qr_activo) values(eq.id,p_empresa,p_datos->>'unidad',(p_datos->>'qr_activo')::boolean)
     on conflict(equipo_id) do update set unidad=excluded.unidad,qr_activo=excluded.qr_activo,actualizado_en=now();
   end if;
 else raise exception 'Acción inválida'; end if;
 return jsonb_build_object('ok',true);
end;$$;
revoke all on function private.maquinaria_configurar_reporte(text,text,jsonb) from public,anon;
grant execute on function private.maquinaria_configurar_reporte(text,text,jsonb) to authenticated;
create function public.configurar_reporte_maquinaria(p_empresa text,p_accion text,p_datos jsonb default '{}')
returns jsonb language sql security invoker set search_path='' as $$select private.maquinaria_configurar_reporte(p_empresa,p_accion,p_datos);$$;
revoke all on function public.configurar_reporte_maquinaria(text,text,jsonb) from public,anon;
grant execute on function public.configurar_reporte_maquinaria(text,text,jsonb) to authenticated;

-- One transaction: usage + optional linked failure + current meter. A retry of
-- the same request returns its receipt; no duplicate daily cost or failure.
create function private.maquinaria_registrar_reporte(p_equipo_id integer,p_datos jsonb,p_solicitud uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare eq public.inventario_maquinaria%rowtype; cfg public.maquinaria_reporte_config%rowtype;
 ec public.maquinaria_reporte_equipo%rowtype; r public.maquinaria_uso_diario%rowtype;
 initial numeric; final numeric; fuel numeric; hours numeric; downtime numeric; hasfuel boolean; hasfailure boolean; stopped boolean;
 d date; operator text; author text; rid bigint; snapshot jsonb; is_public boolean; actor public.usuarios%rowtype;
begin
 is_public:=coalesce(auth.jwt()->>'role','')='service_role';
 if not is_public and auth.uid() is null then raise exception 'Sesión requerida'; end if;
 if p_solicitud is null then raise exception 'Falta identificador de envío'; end if;
 select * into eq from public.inventario_maquinaria where id=p_equipo_id for update;
 if not found then raise exception 'Equipo no disponible'; end if;
 if not is_public then
   if not private.obraxis_permission(eq.empresa,'maquinaria.uso.crear') then raise exception 'Sin permiso para registrar reportes'; end if;
   select * into actor from public.usuarios where auth_user_id=auth.uid() limit 1;
   author:=coalesce(actor.nombre,actor.usuario);
 else author:='Formulario público (identidad declarada)'; end if;
 select * into r from public.maquinaria_uso_diario where empresa=eq.empresa and solicitud_id=p_solicitud;
 if found then
   if r.equipo_id<>eq.id::text then raise exception 'Identificador de envío ya utilizado'; end if;
   if r.reporte_datos->>'envio_hash' is distinct from md5((p_datos-'token'-'action'-'solicitud_id'-'obra_cargo_diario')::text) then raise exception 'Este envío ya fue guardado con otros datos (reporte %). Consulta el historial antes de crear otro.',r.id; end if;
   return jsonb_build_object('ok',true,'id',r.id,'repetido',true);
 end if;
 select * into cfg from public.maquinaria_reporte_config where empresa=eq.empresa;
 select * into ec from public.maquinaria_reporte_equipo where equipo_id=eq.id and empresa=eq.empresa;
 if p_datos ? 'unidad' and p_datos->>'unidad'<>coalesce(ec.unidad,'h') then raise exception 'La unidad del equipo cambió. Actualiza el formulario'; end if;
 if p_datos ? 'obra_nombre' and coalesce(p_datos->>'obra_nombre','')<>coalesce(eq.obra_nombre,'') then raise exception 'La asignación del equipo cambió. Actualiza el formulario'; end if;
 if is_public and not coalesce(ec.qr_activo,true) then raise exception 'Enlace desactivado'; end if;
 initial:=nullif(replace(p_datos->>'horometro_inicial',',','.'),'')::numeric;
 final:=nullif(replace(p_datos->>'horometro_final',',','.'),'')::numeric;
 hasfuel:=(p_datos->>'hubo_combustible')::boolean; hasfailure:=(p_datos->>'hubo_falla')::boolean;
 if hasfuel is null or hasfailure is null then raise exception 'Indica si hubo combustible y si hubo falla'; end if;
 fuel:=case when hasfuel then nullif(replace(p_datos->>'combustible_cargado',',','.'),'')::numeric else 0 end;
 stopped:=case when hasfailure then (p_datos->>'detuvo_equipo')::boolean else false end;
 downtime:=case when stopped then nullif(replace(p_datos->>'horas_fuera_servicio',',','.'),'')::numeric else 0 end;
 d:=(p_datos->>'fecha')::date; operator:=btrim(p_datos->>'operador');
 if d is null or d>(now() at time zone 'America/Santiago')::date or operator is null or length(operator) not between 2 and 180 then raise exception 'Revisa fecha y operador'; end if;
 if initial is null or final is null or initial<0 or final<initial or final-initial>5000 or initial::text in ('NaN','Infinity') or final::text in ('NaN','Infinity') then raise exception 'Lecturas inválidas'; end if;
 if abs(initial-coalesce(eq.horometro_inicial,0))>.01 then raise exception 'La lectura cambió. Actualiza el formulario antes de enviar'; end if;
 if fuel is null or fuel<0 or fuel>10000 or (hasfuel and fuel<=0) or fuel::text='NaN' then raise exception 'Indica litros válidos'; end if;
 if stopped is null or downtime is null or downtime<0 or downtime>24 or (stopped and downtime<=0) or downtime::text='NaN' then raise exception 'Revisa las horas de paralización'; end if;
 hours:=case when coalesce(ec.unidad,'h')='km' then nullif(replace(p_datos->>'horas_trabajadas',',','.'),'')::numeric else final-initial end;
 if hours is null or hours<0 or hours>24 or hours::text='NaN' then raise exception 'Indica horas de trabajo entre 0 y 24'; end if;
 if hasfailure and (nullif(btrim(p_datos->>'descripcion'),'') is null or length(p_datos->>'descripcion')>2000 or coalesce(p_datos->>'severidad','') not in ('Baja','Media','Alta','Crítica')) then raise exception 'Completa descripción y severidad de la falla'; end if;
 if length(coalesce(p_datos->>'observaciones',''))>4000 then raise exception 'Observaciones demasiado extensas'; end if;
 snapshot:=jsonb_build_object('codigo',coalesce(cfg.codigo,'MAQ-01'),'revision',coalesce(cfg.revision,'01'),'envio_hash',md5((p_datos-'token'-'action'-'solicitud_id'-'obra_cargo_diario')::text),
  'unidad',coalesce(ec.unidad,'h'),'hubo_combustible',hasfuel,'hubo_falla',hasfailure,'detuvo_equipo',stopped,
  'horas_fuera_servicio',downtime,'descripcion',case when hasfailure then p_datos->>'descripcion' else null end,
  'severidad',case when hasfailure then p_datos->>'severidad' else null end,'origen',case when is_public then 'qr' else 'app' end,
  'responsable',(select coalesce(nombre,usuario) from public.usuarios where id=cfg.responsable_id and empresa=eq.empresa));
 insert into public.maquinaria_uso_diario(equipo_id,equipo_tipo,equipo_patente,obra_nombre,fecha,horometro_inicial,horometro_final,horas_trabajadas,combustible_cargado,operador,observaciones,empresa,obra_cargo_diario,reporte_datos,solicitud_id,registrado_por)
 values(eq.id::text,eq.tipo,eq.patente,coalesce(eq.obra_nombre,'Bodega / Sin asignar'),d,initial,final,hours,fuel,operator,p_datos->>'observaciones',eq.empresa,
  case when is_public then null else nullif(p_datos->>'obra_cargo_diario','') end,snapshot,p_solicitud,author) returning id into rid;
 if hasfailure then
   insert into public.maquinaria_fallas(equipo_id,equipo_tipo,equipo_patente,obra_nombre,fecha,severidad,detuvo_equipo,horas_fuera_servicio,descripcion,responsable,registrado_por,empresa,uso_diario_id)
   values(eq.id,eq.tipo,eq.patente,coalesce(eq.obra_nombre,'Bodega / Sin asignar'),d,p_datos->>'severidad',stopped,downtime,p_datos->>'descripcion',snapshot->>'responsable',author,eq.empresa,rid);
 end if;
 update public.inventario_maquinaria set horometro_inicial=greatest(coalesce(horometro_inicial,0),final) where id=eq.id;
 return jsonb_build_object('ok',true,'id',rid);
end;$$;
revoke all on function private.maquinaria_registrar_reporte(integer,jsonb,uuid) from public,anon;
grant execute on function private.maquinaria_registrar_reporte(integer,jsonb,uuid) to authenticated,service_role;
create function public.registrar_reporte_maquinaria(p_equipo_id integer,p_datos jsonb,p_solicitud uuid)
returns jsonb language sql security invoker set search_path='' as $$select private.maquinaria_registrar_reporte(p_equipo_id,p_datos,p_solicitud);$$;
revoke all on function public.registrar_reporte_maquinaria(integer,jsonb,uuid) from public,anon;
grant execute on function public.registrar_reporte_maquinaria(integer,jsonb,uuid) to authenticated,service_role;
notify pgrst,'reload schema';
