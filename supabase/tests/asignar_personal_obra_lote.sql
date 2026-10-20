begin;
do $$
declare actor uuid; a integer; b integer; c integer; w1 integer; w2 integer; w3 integer; w4 integer; ajeno integer; r jsonb; rechazado boolean;
  w5 integer; w6 integer; w7 integer; original jsonb; historial_real jsonb;
  hoy date:=(now() at time zone 'America/Santiago')::date; empresa_test text:='__TEST_ASIGNAR_LOTE__';
begin
 select auth_user_id into actor from public.usuarios where empresa='Obraxis' and lower(coalesce(rol_base,rol,'')) in ('superusuario','superadmin') and auth_user_id is not null limit 1;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 insert into public.facturacion_centros_gestion(empresa,codigo,nombre,tipo) values(empresa_test,'ASG','Destino prueba','Obra') returning id into c;
 insert into public.obras(empresa,nombre) values(empresa_test,'Origen prueba') returning id into a;
 insert into public.obras(empresa,nombre,centro_gestion_id) values(empresa_test,'Destino prueba',c) returning id into b;
 insert into public.maestro_personal(empresa,nombre,rut,obra_nombre,fecha_asig,fecha_inicio_contrato,sueldo_base)
   values(empresa_test,'Anterior','99999880-1','Origen prueba',hoy-10,hoy-20,650000) returning id into w1;
 insert into public.rrhh_asignaciones_personal(empresa,trabajador_id,trabajador_nombre,obra_nombre,destino_nombre,fecha_inicio)
   values(empresa_test,w1,'Anterior','Origen prueba','Origen prueba',hoy-10);
 insert into public.maestro_personal(empresa,nombre,rut,fecha_inicio_contrato,sueldo_base) values(empresa_test,'Nuevo','99999880-2',hoy-20,700000) returning id into w2;
 r:=public.asignar_personal_obra_lote(empresa_test,array[w1,w2],b,hoy);
 if r<>'{"asignados":2,"omitidos":0}'::jsonb then raise exception 'No asigna el lote: %',r; end if;
 if (select count(*) from public.maestro_personal where id=any(array[w1,w2]) and obra_nombre='Destino prueba' and centro_gestion_id=c and fecha_asig=hoy)<>2 then raise exception 'Ficha desincronizada'; end if;
 if not exists(select 1 from public.rrhh_asignaciones_personal where trabajador_id=w1 and obra_nombre='Origen prueba' and fecha_termino=hoy-1) then raise exception 'No cierra el período anterior'; end if;
 if (select count(*) from public.rrhh_asignaciones_personal where trabajador_id=any(array[w1,w2]) and fecha_termino is null)<>2 then raise exception 'Historial incompleto'; end if;
 if not exists(select 1 from public.maestro_personal where id=w1 and sueldo_base=650000 and centro_gestion_defecto_id is null) then raise exception 'Modifica sueldo o regla de respaldo'; end if;
 r:=public.asignar_personal_obra_lote(empresa_test,array[w1,w2],b,hoy);
 if r<>'{"asignados":0,"omitidos":2}'::jsonb or (select count(*) from public.rrhh_asignaciones_personal where trabajador_id=any(array[w1,w2]))<>3 then raise exception 'Repetir duplica historial'; end if;
 insert into public.maestro_personal(empresa,nombre,rut,fecha_inicio_contrato) values(empresa_test,'Válido','99999880-3',hoy-20) returning id into w3;
 insert into public.maestro_personal(empresa,nombre,rut,fecha_inicio_contrato,fecha_vencimiento_contrato) values(empresa_test,'Terminado','99999880-4',hoy-20,hoy-1) returning id into w4;
 rechazado:=false;
 begin perform public.asignar_personal_obra_lote(empresa_test,array[w3,w4],b,hoy);exception when others then rechazado:=true;end;
 if not rechazado or exists(select 1 from public.maestro_personal where id=w3 and obra_nombre is not null) or exists(select 1 from public.rrhh_asignaciones_personal where trabajador_id=w3) then raise exception 'Lote parcialmente guardado'; end if;
 insert into public.maestro_personal(empresa,nombre,rut) values('__TEST_ASIGNAR_OTRA__','Ajeno','99999880-5') returning id into ajeno;
 rechazado:=false;
 begin perform public.asignar_personal_obra_lote(empresa_test,array[w3,ajeno],b,hoy);exception when others then rechazado:=true;end;
 if not rechazado then raise exception 'Admite trabajadores ajenos'; end if;
 rechazado:=false;
 begin perform public.asignar_personal_obra_lote(empresa_test,array[w3],b,hoy+1);exception when others then rechazado:=true;end;
 if not rechazado then raise exception 'Carga futura como asignación actual'; end if;
 rechazado:=false;
 begin perform public.asignar_personal_obra_lote(empresa_test,array[w1],a,hoy);exception when others then rechazado:=true;end;
 if not rechazado then raise exception 'Solapa fechas del historial'; end if;
 -- Caso reportado: ficha sin obra y período Sin asignar posterior a la fecha solicitada.
 insert into public.maestro_personal(empresa,nombre,rut,fecha_inicio_contrato,fecha_asig)
   values(empresa_test,'Sin asignar posterior','99999880-6',hoy-30,hoy-7) returning id into w5;
 insert into public.rrhh_asignaciones_personal(empresa,trabajador_id,trabajador_nombre,destino_nombre,fecha_inicio)
   values(empresa_test,w5,'Sin asignar posterior','Sin asignar',hoy-7) returning to_jsonb(rrhh_asignaciones_personal.*) into original;
 r:=public.asignar_personal_obra_lote(empresa_test,array[w5],b,hoy-8);
 if r->>'asignados'<>'1' or not exists(select 1 from public.rrhh_asignaciones_personal where trabajador_id=w5 and obra_nombre='Destino prueba' and fecha_inicio=hoy-8 and fecha_termino is null)
   or (select count(*) from public.rrhh_asignaciones_personal where trabajador_id=w5)<>1 then raise exception 'No cubre período vacío posterior'; end if;
 if not exists(select 1 from private.rrhh_asignaciones_sin_destino_auditoria where trabajador_id=w5 and registro_original=original and registrado_por=actor and nueva_fecha_inicio=hoy-8) then raise exception 'Pierde respaldo original'; end if;
 perform public.asignar_personal_obra_lote(empresa_test,array[w5],b,hoy-8);
 if (select count(*) from private.rrhh_asignaciones_sin_destino_auditoria where trabajador_id=w5)<>1 then raise exception 'Repetir duplica respaldo'; end if;
 -- Período vacío anterior se recorta, sin alterar historia real anterior.
 insert into public.maestro_personal(empresa,nombre,rut,fecha_inicio_contrato)
   values(empresa_test,'Sin asignar anterior','99999880-7',hoy-30) returning id into w6;
 insert into public.rrhh_asignaciones_personal(empresa,trabajador_id,trabajador_nombre,obra_nombre,destino_nombre,fecha_inicio,fecha_termino)
   values(empresa_test,w6,'Sin asignar anterior','Origen prueba','Origen prueba',hoy-20,hoy-12) returning to_jsonb(rrhh_asignaciones_personal.*) into historial_real;
 insert into public.rrhh_asignaciones_personal(empresa,trabajador_id,trabajador_nombre,destino_nombre,fecha_inicio)
   values(empresa_test,w6,'Sin asignar anterior','Sin asignar',hoy-11);
 perform public.asignar_personal_obra_lote(empresa_test,array[w6],b,hoy-8);
 if not exists(select 1 from public.rrhh_asignaciones_personal registro where registro.trabajador_id=w6 and to_jsonb(registro)=historial_real)
   or not exists(select 1 from public.rrhh_asignaciones_personal where trabajador_id=w6 and destino_nombre='Sin asignar' and fecha_inicio=hoy-11 and fecha_termino=hoy-9) then raise exception 'Altera historia anterior'; end if;
 -- Centro real sin obra no es un período vacío. Un fallo revierte todo el lote, incluido su respaldo.
 insert into public.maestro_personal(empresa,nombre,rut,fecha_inicio_contrato)
   values(empresa_test,'Centro real sin obra','99999880-8',hoy-30) returning id into w7;
 insert into public.rrhh_asignaciones_personal(empresa,trabajador_id,trabajador_nombre,centro_gestion_id,destino_nombre,fecha_inicio)
   values(empresa_test,w7,'Centro real sin obra',c,'Sin asignar',hoy-7);
 insert into public.rrhh_asignaciones_personal(empresa,trabajador_id,trabajador_nombre,destino_nombre,fecha_inicio)
   values(empresa_test,w3,'Válido','Sin asignar',hoy-7) returning to_jsonb(rrhh_asignaciones_personal.*) into original;
 rechazado:=false;
 begin perform public.asignar_personal_obra_lote(empresa_test,array[w3,w7],b,hoy-8);exception when others then rechazado:=true;end;
 if not rechazado or exists(select 1 from private.rrhh_asignaciones_sin_destino_auditoria where trabajador_id=w3)
   or not exists(select 1 from public.rrhh_asignaciones_personal registro where registro.trabajador_id=w3 and to_jsonb(registro)=original) then raise exception 'Lote deja cambios parciales o reemplaza centro real'; end if;
 if has_table_privilege('authenticated','private.rrhh_asignaciones_sin_destino_auditoria','SELECT') then raise exception 'Respaldo expuesto'; end if;
 if exists(select 1 from public.rrhh_imputaciones_diarias where empresa=empresa_test) then raise exception 'Asignar obra crea costos sin asistencia ni regla'; end if;
 perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);rechazado:=false;
 begin perform public.asignar_personal_obra_lote(empresa_test,array[w1],a,hoy);exception when insufficient_privilege then rechazado:=true;end;
 if not rechazado then raise exception 'Admite sesión no autorizada'; end if;
 if has_function_privilege('anon','public.asignar_personal_obra_lote(text,integer[],integer,date)','EXECUTE') then raise exception 'RPC accesible para anon'; end if;
end; $$;
rollback;
select 'Asignación en lote y rollback: pruebas completadas' as verificacion;
