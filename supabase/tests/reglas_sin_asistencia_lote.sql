begin;
do $$
declare actor uuid; centro integer; respaldo integer; obra integer; w1 integer; w2 integer; w3 integer; ajeno integer; marca bigint;
  cargo public.rrhh_imputaciones_diarias; pasado public.rrhh_imputaciones_diarias; antes jsonb; respuesta jsonb; rechazado boolean; historial integer;
  hoy date:=(now() at time zone 'America/Santiago')::date; periodo text:=to_char(hoy,'YYYY-MM');
  empresa_test text:='__TEST_REGLAS_LOTE_ROLLBACK__';
begin
  select auth_user_id into actor from public.usuarios where empresa='Obraxis' and lower(coalesce(rol_base,rol,'')) in ('superusuario','superadmin') and auth_user_id is not null limit 1;
  if actor is null then raise exception 'Falta actor para prueba'; end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  insert into public.facturacion_centros_gestion(empresa,codigo,nombre,tipo) values(empresa_test,'RL-OBRA','Obra prueba','Obra') returning id into centro;
  insert into public.facturacion_centros_gestion(empresa,codigo,nombre,tipo) values(empresa_test,'RL-ADM','Respaldo prueba','Administración') returning id into respaldo;
  insert into public.obras(empresa,nombre,centro_gestion_id) values(empresa_test,'Obra reglas lote prueba',centro) returning id into obra;
  insert into public.rrhh_costeo_parametros(empresa,periodo,horas_semanales,tope_gratificacion_mensual,cargas_empleador_pct,factor_hora_extra)
    values(empresa_test,periodo,42,100000,10,1.5);
  if to_char(hoy-1,'YYYY-MM')<>periodo then
    insert into public.rrhh_costeo_parametros(empresa,periodo,horas_semanales,tope_gratificacion_mensual,cargas_empleador_pct,factor_hora_extra)
      values(empresa_test,to_char(hoy-1,'YYYY-MM'),42,100000,10,1.5);
  end if;
  insert into public.maestro_personal(empresa,nombre,rut,sueldo_base,gratificacion,fecha_inicio_contrato)
    values(empresa_test,'TEST SIN ASISTENCIA','99999980-1',600000,'Sin Gratificación',hoy-2) returning id into w1;
  insert into public.maestro_personal(empresa,nombre,rut,sueldo_base,gratificacion,fecha_inicio_contrato)
    values(empresa_test,'TEST CON ASISTENCIA','99999980-2',600000,'Sin Gratificación',hoy-2) returning id into w2;
  insert into public.maestro_personal(empresa,nombre,rut,sueldo_base,gratificacion,fecha_inicio_contrato)
    values(empresa_test,'TEST SIN SUELDO','99999980-3',0,'Sin Gratificación',hoy-2) returning id into w3;
  insert into public.maestro_personal(empresa,nombre,rut) values('__TEST_REGLAS_OTRA_EMPRESA__','TEST AJENO','99999980-4') returning id into ajeno;
  insert into public.asistencia_personal(empresa,obra_id,obra_nombre,rut,trabajador,fecha_marcacion,asistencia,verificado_qr,horas_extras_manual)
    values(empresa_test,obra,'Obra reglas lote prueba','99999980-2','TEST CON ASISTENCIA',hoy,'PRESENTE',false,1);
  respuesta:=public.guardar_reglas_sin_asistencia_lote(empresa_test,array[w1,w2,w3],respaldo,hoy-1,null,array[1,2,3,4,5,6,7],2,true,false);
  if respuesta<>'{"guardadas":3,"omitidas":0}'::jsonb then raise exception 'Respuesta de lote incorrecta: %',respuesta; end if;
  select * into cargo from public.rrhh_imputaciones_diarias where empresa=empresa_test and trabajador_id=w1 and fecha=hoy;
  if cargo.estado<>'Aprobada' or cargo.centro_aprobado_id<>respaldo or cargo.horas_extra_aprobadas<>2 or cargo.costo_total<>33000 then raise exception 'No aplica inmediatamente el respaldo con 2 HE: %',to_jsonb(cargo); end if;
  if not exists(select 1 from public.rrhh_imputaciones_diarias where empresa=empresa_test and trabajador_id=w2 and fecha=hoy and centro_aprobado_id=centro and horas_extra_aprobadas=1 and costo_total=27500) then raise exception 'La regla sustituyó una asistencia existente'; end if;
  if exists(select 1 from public.rrhh_imputaciones_diarias where empresa=empresa_test and trabajador_id=w3 and estado='Aprobada') then raise exception 'Inventó costos sin sueldo'; end if;
  historial:=jsonb_array_length(cargo.historial);
  perform set_config('request.jwt.claim.sub','',true);
  perform private.rrhh_sincronizar_cargo_dia(empresa_test,w1,hoy);
  if not exists(select 1 from public.rrhh_imputaciones_diarias where id=cargo.id and aprobado_por=actor and costo_total=33000) then raise exception 'La regla necesita sesión'; end if;
  if (select jsonb_array_length(d.historial) from public.rrhh_imputaciones_diarias d where id=cargo.id)<>historial then raise exception 'Reprocesar duplica historial'; end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  select to_jsonb(r) into antes from public.rrhh_reglas_sin_asistencia r where empresa=empresa_test and trabajador_id=w1;
  respuesta:=public.guardar_reglas_sin_asistencia_lote(empresa_test,array[w1],centro,hoy,null,array[1],0,true,false);
  if respuesta<>'{"guardadas":0,"omitidas":1}'::jsonb or (select to_jsonb(r) from public.rrhh_reglas_sin_asistencia r where empresa=empresa_test and trabajador_id=w1) is distinct from antes then raise exception 'Sobrescribió regla sin autorización'; end if;
  -- Una asistencia posterior sustituye el mismo cargo y usa SUS HE, no suma las de respaldo.
  insert into public.asistencia_personal(empresa,obra_id,obra_nombre,rut,trabajador,fecha_marcacion,asistencia,verificado_qr,horas_extras_manual)
    values(empresa_test,obra,'Obra reglas lote prueba','99999980-1','TEST SIN ASISTENCIA',hoy,'PRESENTE',false,1) returning id into marca;
  if not exists(select 1 from public.rrhh_imputaciones_diarias where id=cargo.id and centro_aprobado_id=centro and horas_extra_aprobadas=1 and costo_total=27500) then raise exception 'No sustituye las HE de respaldo por las de asistencia'; end if;
  if (select count(*) from public.rrhh_imputaciones_diarias where empresa=empresa_test and trabajador_id=w1 and fecha=hoy)<>1 then raise exception 'Duplicó el cargo por asistencia tardía'; end if;
  delete from public.asistencia_personal where id=marca;
  if (select horas_extra_aprobadas from public.rrhh_imputaciones_diarias where id=cargo.id)<>2 then raise exception 'No restaura las HE de respaldo'; end if;
  select * into pasado from public.rrhh_imputaciones_diarias where empresa=empresa_test and trabajador_id=w1 and fecha=hoy-1;
  respuesta:=public.guardar_reglas_sin_asistencia_lote(empresa_test,array[w1],respaldo,hoy-1,null,array[1,2,3,4,5,6,7],0,true,true);
  if not exists(select 1 from public.rrhh_imputaciones_diarias where id=cargo.id and horas_extra_aprobadas=0 and costo_total=22000) then raise exception 'Sin HE conserva costo de HE'; end if;
  if (select costo_total from public.rrhh_imputaciones_diarias where id=pasado.id)<>pasado.costo_total then raise exception 'Editar regla altera costos históricos autorizados'; end if;
  rechazado:=false;
  begin perform public.guardar_reglas_sin_asistencia_lote(empresa_test,array[w1,ajeno],centro,hoy,null,array[1],0,true,true);exception when others then rechazado:=true;end;
  if not rechazado then raise exception 'Admite trabajador de otra empresa'; end if;
  rechazado:=false;
  begin perform public.guardar_reglas_sin_asistencia_lote(empresa_test,array[w1,w1],centro,hoy,null,array[1],0,true,true);exception when others then rechazado:=true;end;
  if not rechazado then raise exception 'Admite trabajador repetido'; end if;
  rechazado:=false;
  begin perform public.guardar_reglas_sin_asistencia_lote(empresa_test,array[w1],centro,hoy,null,array[1],25,true,true);exception when others then rechazado:=true;end;
  if not rechazado then raise exception 'Admite HE inválidas'; end if;
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);rechazado:=false;
  begin perform public.guardar_reglas_sin_asistencia_lote(empresa_test,array[w1],centro,hoy,null,array[1],0,true,true);exception when insufficient_privilege then rechazado:=true;end;
  if not rechazado then raise exception 'Admite sesión no autorizada'; end if;
  if has_function_privilege('anon','public.guardar_reglas_sin_asistencia_lote(text,integer[],integer,date,date,integer[],numeric,boolean,boolean)','EXECUTE') then raise exception 'RPC pública para anon'; end if;
end; $$;
rollback;
