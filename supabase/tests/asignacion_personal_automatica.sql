begin;
do $$
declare actor uuid; centro integer; respaldo integer; obra integer; otra integer; w integer; qr integer; sin_sueldo integer; marca bigint;
  cargo public.rrhh_imputaciones_diarias; antes integer; n bigint; ni bigint; resultado jsonb; rechazado boolean;
  hoy date:=(now() at time zone 'America/Santiago')::date; corte integer;
  empresa_test text:='__TEST_ASIGNACION_AUTO_ROLLBACK__';
begin
  select auth_user_id into actor from public.usuarios where empresa='Obraxis' and lower(coalesce(rol_base,rol,'')) in ('superusuario','superadmin') and auth_user_id is not null limit 1;
  if actor is null then raise exception 'Falta actor para prueba transaccional'; end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  insert into public.facturacion_centros_gestion(empresa,codigo,nombre,tipo) values(empresa_test,'AUTO-A','Centro obra prueba','Obra') returning id into centro;
  insert into public.facturacion_centros_gestion(empresa,codigo,nombre,tipo) values(empresa_test,'AUTO-B','Centro respaldo prueba','Administración') returning id into respaldo;
  insert into public.obras(empresa,nombre,centro_gestion_id) values(empresa_test,'Obra cargo automático prueba',centro) returning id into obra;
  insert into public.obras(empresa,nombre) values(empresa_test,'Otra obra prueba') returning id into otra;
  insert into public.rrhh_costeo_parametros(empresa,periodo,horas_semanales,tope_gratificacion_mensual,cargas_empleador_pct) values(empresa_test,'2020-01',42,100000,10);
  insert into public.maestro_personal(empresa,nombre,rut,sueldo_base,gratificacion,fecha_inicio_contrato,fecha_vencimiento_contrato)
    values(empresa_test,'TEST CARGO AUTOMATICO','99999990-1',600000,'Sin Gratificación','2020-01-02','2020-01-05') returning id into w;
  perform public.guardar_regla_sin_asistencia(empresa_test,w,respaldo,'2020-01-02','2020-01-05',array[1,2,3,4,5,6,7],'20:00',true);
  perform private.rrhh_sincronizar_cargo_dia(empresa_test,w,'2020-01-05');
  select * into cargo from public.rrhh_imputaciones_diarias where empresa=empresa_test and trabajador_id=w and fecha='2020-01-05';
  if cargo.estado<>'Aprobada' or not cargo.asignacion_automatica or cargo.centro_aprobado_id<>respaldo then raise exception 'La regla no carga el respaldo sin asistencia'; end if;
  insert into public.asistencia_personal(empresa,obra_id,obra_nombre,rut,trabajador,fecha_marcacion,asistencia,verificado_qr,horas_extras_manual)
    values(empresa_test,obra,'Obra cargo automático prueba','99999990-1','TEST CARGO AUTOMATICO','2020-01-05','PRESENTE',false,2) returning id into marca;
  select * into cargo from public.rrhh_imputaciones_diarias where id=cargo.id;
  if cargo.estado<>'Aprobada' or cargo.centro_aprobado_id<>centro or cargo.horas_extra_aprobadas<>2 or cargo.costo_total<=22000 then raise exception 'El marcaje manual no sustituye el respaldo con HE'; end if;
  if (select count(*) from public.rrhh_imputaciones_diarias where empresa=empresa_test and trabajador_id=w and fecha='2020-01-05')<>1 then raise exception 'Duplicó el cargo al llegar asistencia tardía'; end if;
  antes:=jsonb_array_length(cargo.historial);
  perform private.rrhh_sincronizar_cargo_dia(empresa_test,w,'2020-01-05');
  if (select jsonb_array_length(historial) from public.rrhh_imputaciones_diarias where id=cargo.id)<>antes then raise exception 'Reprocesar no es idempotente'; end if;
  select * into cargo from public.rrhh_imputaciones_diarias where id=cargo.id;
  perform public.aprobar_imputaciones_personal(empresa_test,jsonb_build_array(jsonb_build_object('id',cargo.id,'evidencia',cargo.evidencia,'costo_evidencia',cargo.costo_evidencia,'centro_id',respaldo,'comentario','Reasignación explícita de prueba','horas_extra',2,'haber_imponible',5000,'haber_no_imponible',2000)));
  perform private.rrhh_sincronizar_cargo_dia(empresa_test,w,'2020-01-05');
  if not exists(select 1 from public.rrhh_imputaciones_diarias where id=cargo.id and centro_aprobado_id=respaldo and not asignacion_automatica and haber_imponible=5000 and haber_no_imponible=2000) then raise exception 'La automatización anuló una corrección humana'; end if;
  update public.asistencia_personal set horas_extras_manual=3 where id=marca;
  if (select horas_extra_aprobadas from public.rrhh_imputaciones_diarias where id=cargo.id)<>3 then raise exception 'Cambiar HE no recalcula costo'; end if;
  insert into public.asistencia_personal(empresa,obra_id,obra_nombre,rut,trabajador,fecha_marcacion,asistencia,verificado_qr)
    values(empresa_test,otra,'Otra obra prueba','99999990-1','TEST CARGO AUTOMATICO','2020-01-05','PRESENTE',false);
  if (select estado from public.rrhh_imputaciones_diarias where id=cargo.id)<>'Pendiente' then raise exception 'Aprobó un día ambiguo'; end if;
  delete from public.asistencia_personal where empresa=empresa_test and obra_id=otra;
  if (select centro_aprobado_id from public.rrhh_imputaciones_diarias where id=cargo.id)<>centro then raise exception 'No restaura cargo único al resolver conflicto'; end if;
  delete from public.asistencia_personal where id=marca;
  if (select centro_aprobado_id from public.rrhh_imputaciones_diarias where id=cargo.id)<>respaldo then raise exception 'Borrar asistencia no restaura regla'; end if;
  insert into public.asistencia_personal(empresa,obra_id,obra_nombre,rut,trabajador,fecha_marcacion,asistencia,verificado_qr)
    values(empresa_test,obra,'Obra cargo automático prueba','99999990-1','TEST CARGO AUTOMATICO','2020-01-05','AUSENTE',false) returning id into marca;
  if (select estado from public.rrhh_imputaciones_diarias where id=cargo.id)<>'Pendiente' then raise exception 'Confundió ausencia informada con falta de marcaje'; end if;
  update public.asistencia_personal set asistencia='PRESENTE',verificado_qr=true where id=marca;
  if (select estado from public.rrhh_imputaciones_diarias where id=cargo.id)<>'Pendiente' then raise exception 'El QR se autoaprobó'; end if;
  update public.asistencia_personal set verificado_qr=false where id=marca;
  perform private.rrhh_sincronizar_cargo_dia(empresa_test,w,'2020-01-02');
  perform public.guardar_regla_sin_asistencia(empresa_test,w,centro,'2020-01-02','2020-01-05',array[1,2,3,4,5,6,7],'20:00',false);
  perform private.rrhh_sincronizar_cargo_dia(empresa_test,w,'2020-01-02');
  if not exists(select 1 from public.rrhh_imputaciones_diarias where empresa=empresa_test and trabajador_id=w and fecha='2020-01-02' and estado='Aprobada' and centro_aprobado_id=respaldo) then raise exception 'Editar la regla eliminó su costo histórico'; end if;
  perform public.guardar_regla_sin_asistencia(empresa_test,w,respaldo,'2020-01-02','2020-01-05',array[1,2,3,4,5,6,7],'20:00',true);
  perform public.preparar_imputaciones_personal(empresa_test,'2020-01');
  if exists(select 1 from public.rrhh_imputaciones_diarias where empresa=empresa_test and trabajador_id=w and estado<>'Aprobada') then raise exception 'Actualizar propuestas anuló cargos automáticos'; end if;
  insert into public.rrhh_nominas_mensuales(empresa,periodo,estado) values(empresa_test,'2020-01','Cerrada') returning id into n;
  insert into public.rrhh_nomina_items(nomina_id,trabajador_id,trabajador_nombre,calculo) values(n,w,'TEST CARGO AUTOMATICO','{"employerCost":100001}') returning id into ni;
  resultado:=public.distribuir_nomina_a_obras(n);
  if not (resultado->>'distribuida')::boolean then raise exception 'No concilia cargos automáticos'; end if;
  if (select sum(monto_real) from public.rrhh_costos_personal_vigentes where empresa=empresa_test and trabajador_id=w)<>100001 then raise exception 'Duplicó o perdió costo al cerrar nómina'; end if;
  perform public.distribuir_nomina_a_obras(n);
  if (select sum(monto_real) from public.rrhh_costos_personal_vigentes where empresa=empresa_test and trabajador_id=w)<>100001 then raise exception 'Reconciliar dos veces duplicó costo'; end if;
  perform private.rrhh_sincronizar_cargo_dia(empresa_test,w,(now() at time zone 'America/Santiago')::date+1);
  if exists(select 1 from public.rrhh_imputaciones_diarias where empresa=empresa_test and fecha>(now() at time zone 'America/Santiago')::date) then raise exception 'Creó costos futuros'; end if;
  insert into public.maestro_personal(empresa,nombre,rut,sueldo_base) values(empresa_test,'TEST SIN SUELDO','99999990-2',0) returning id into sin_sueldo;
  insert into public.asistencia_personal(empresa,obra_id,obra_nombre,rut,trabajador,fecha_marcacion,asistencia,verificado_qr)
    values(empresa_test,obra,'Obra cargo automático prueba','99999990-2','TEST SIN SUELDO','2020-01-05','PRESENTE',false);
  if exists(select 1 from public.rrhh_imputaciones_diarias where trabajador_id=sin_sueldo and estado='Aprobada') then raise exception 'Inventó costo sin sueldo'; end if;
  insert into public.maestro_personal(empresa,nombre,rut,sueldo_base,gratificacion,fecha_inicio_contrato) values(empresa_test,'TEST CORTE','99999990-3',600000,'Sin Gratificación',hoy) returning id into corte;
  insert into public.rrhh_costeo_parametros(empresa,periodo,horas_semanales,tope_gratificacion_mensual,cargas_empleador_pct) values(empresa_test,to_char(hoy,'YYYY-MM'),42,100000,10);
  perform public.guardar_regla_sin_asistencia(empresa_test,corte,respaldo,hoy,null,array[1,2,3,4,5,6,7],'23:59:59',true);
  perform private.rrhh_sincronizar_cargo_dia(empresa_test,corte,hoy);
  if not exists(select 1 from public.rrhh_imputaciones_diarias where trabajador_id=corte and estado='Aprobada') then raise exception 'La regla sigue esperando una hora de cierre'; end if;
  perform public.guardar_regla_sin_asistencia(empresa_test,corte,respaldo,hoy,null,array[1,2,3,4,5,6,7],'00:00',true);
  perform set_config('request.jwt.claim.sub','',true);
  perform private.rrhh_sincronizar_cargo_dia(empresa_test,corte,hoy);
  if not exists(select 1 from public.rrhh_imputaciones_diarias where trabajador_id=corte and estado='Aprobada' and aprobado_por=actor) then raise exception 'La regla necesita navegador o no conserva actor autorizante'; end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  rechazado:=false;
  begin perform public.guardar_regla_sin_asistencia(empresa_test,w,respaldo,'2020-01-02',null,array[1],'20:00',true);exception when others then rechazado:=true;end;
  if not rechazado then raise exception 'Autorizó regla de otra empresa'; end if;
  if has_function_privilege('authenticated','private.rrhh_sincronizar_cargo_dia(text,integer,date)','EXECUTE')
    or has_table_privilege('authenticated','public.rrhh_reglas_sin_asistencia','UPDATE') then raise exception 'Privilegios directos excesivos'; end if;
end; $$;
set local role authenticated;
do $$begin
  if exists(select 1 from public.rrhh_reglas_sin_asistencia where empresa='__TEST_ASIGNACION_AUTO_ROLLBACK__') then raise exception 'RLS expone reglas ajenas';end if;
end; $$;
rollback;
