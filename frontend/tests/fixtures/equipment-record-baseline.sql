CREATE OR REPLACE FUNCTION private.maquinaria_registrar_reporte(p_equipo_id integer, p_datos jsonb, p_solicitud uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  'autor_declarado',left(p_datos->>'autor_declarado',180),'operador_id',p_datos->>'operador_id','unidad',coalesce(ec.unidad,'h'),'hubo_combustible',hasfuel,'hubo_falla',hasfailure,'detuvo_equipo',stopped,
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
end;$function$
;
CREATE OR REPLACE FUNCTION public.equipo_qr_mantencion(p_equipo integer, p_datos jsonb, p_solicitud uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare e public.inventario_maquinaria%rowtype; r public.maquinaria_mantenciones%rowtype; meter numeric; d date;
begin
 select * into strict e from public.inventario_maquinaria where id=p_equipo for update;
 select * into r from public.maquinaria_mantenciones where empresa=e.empresa and qr_solicitud=p_solicitud;
 if found then
  if r.equipo_id<>p_equipo or r.qr_datos<>p_datos then raise exception 'La solicitud ya existe con otros datos'; end if;
  return jsonb_build_object('id',r.id);
 end if;
 meter:=(p_datos->>'horometro')::numeric; d:=(p_datos->>'fecha')::date;
 if p_solicitud is null or meter is null or meter<0 or meter::text in ('NaN','Infinity','-Infinity') or d is null or d>(now() at time zone 'America/Santiago')::date or length(btrim(coalesce(p_datos->>'descripcion','')))<3 or coalesce(p_datos->>'tipo','') not in ('Preventiva','Correctiva') then raise exception 'Revisa fecha, lectura, tipo y descripción'; end if;
 insert into public.maquinaria_mantenciones(equipo_id,equipo_patente,equipo_tipo,empresa,obra_nombre,fecha,tipo,horometro,descripcion,responsable,registrado_por,qr_solicitud,qr_datos)
 values(e.id,e.patente,e.tipo,e.empresa,e.obra_nombre,d,p_datos->>'tipo',meter,p_datos->>'descripcion',p_datos->>'nombre',p_datos->>'autor_declarado',p_solicitud,p_datos) returning * into r;
 return jsonb_build_object('id',r.id);
end;$function$
;
CREATE OR REPLACE FUNCTION private.maquinaria_validar_cargo_diario()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  equipo public.inventario_maquinaria%rowtype;
  destinos text[];
  anterior public.maquinaria_uso_diario%rowtype;
begin
  if TG_OP='UPDATE' then
    if row(new.empresa,new.equipo_id,new.fecha,new.obra_cargo_diario,new.cargo_obra_id,new.tarifa_diaria_aplicada,new.cargo_decidido_at)
       is distinct from row(old.empresa,old.equipo_id,old.fecha,old.obra_cargo_diario,old.cargo_obra_id,old.tarifa_diaria_aplicada,old.cargo_decidido_at) then
      raise exception 'El destino y la tarifa del reporte no se pueden cambiar directamente. Registra un nuevo reporte con la elección de cargo.';
    end if;
    return new;
  end if;
  -- El bloqueo del equipo serializa las decisiones concurrentes del mismo día.
  if new.fecha is null then raise exception 'Indica la fecha del reporte de maquinaria.'; end if;
  select * into equipo from public.inventario_maquinaria
    where id::text=new.equipo_id and empresa=new.empresa for update;
  if not found then raise exception 'Equipo no disponible para esta empresa.'; end if;
  select array_agg(distinct destino order by destino) into destinos from (
    select r.obra_nombre as destino from public.maquinaria_uso_diario r
    where r.empresa=new.empresa and r.equipo_id=new.equipo_id and r.fecha=new.fecha
    union select new.obra_nombre
  ) d where destino is not null and btrim(destino)<>'';
  if cardinality(destinos)>1 and nullif(new.obra_cargo_diario,'') is null then
    raise exception using message='MAQUINARIA_DESTINO_REQUERIDO',
      detail=jsonb_build_object('obras',destinos,'fecha',new.fecha,'equipo',new.equipo_patente)::text;
  end if;
  if nullif(new.obra_cargo_diario,'') is not null and not(new.obra_cargo_diario=any(destinos)) then
    raise exception 'El cargo debe corresponder a una obra con reporte para ese equipo y día.';
  end if;
  select * into anterior from public.maquinaria_uso_diario r
    where r.empresa=new.empresa and r.equipo_id=new.equipo_id and r.fecha=new.fecha
      and r.tarifa_diaria_aplicada is not null
    order by r.cargo_decidido_at desc,r.id desc limit 1;
  new.obra_cargo_diario:=coalesce(nullif(new.obra_cargo_diario,''),
    (select o.nombre from public.obras o where o.id=anterior.cargo_obra_id and o.empresa=new.empresa),
    anterior.obra_cargo_diario,new.obra_nombre);
  select id into new.cargo_obra_id from public.obras where empresa=new.empresa and nombre=new.obra_cargo_diario;
  new.tarifa_diaria_aplicada:=anterior.tarifa_diaria_aplicada;
  if new.tarifa_diaria_aplicada is null and lower(coalesce(equipo.unidad_costo_interno,'')) in ('$/día','$/dia')
     and equipo.costo_interno>=0 then
    new.tarifa_diaria_aplicada:=round(equipo.costo_interno);
  end if;
  new.cargo_decidido_at:=clock_timestamp();
  return new;
end $function$
;
