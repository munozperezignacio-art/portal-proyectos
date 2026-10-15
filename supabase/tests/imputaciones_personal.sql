-- Prueba transaccional: todos los registros de prueba se revierten al final.
begin;
do $$
declare actor uuid; c1 integer; c2 integer; o1 integer; o2 integer; w integer; n bigint; ni bigint; n2 bigint; ni2 bigint; manual_id bigint; otra_id bigint;
  r public.rrhh_imputaciones_diarias; resultado jsonb; decisiones jsonb; rechazo boolean;
  empresa_test text:='__TEST_IMPUTACIONES_ROLLBACK__';
begin
  select auth_user_id into actor from public.usuarios where empresa='Obraxis'
    and lower(coalesce(rol_base,rol,'')) in ('superusuario','superadmin') and auth_user_id is not null limit 1;
  if actor is null then raise exception 'Se requiere un actor superusuario para la prueba transaccional'; end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  insert into public.facturacion_centros_gestion(empresa,codigo,nombre,tipo) values(empresa_test,'TEST-A','Centro Obra','Obra') returning id into c1;
  insert into public.facturacion_centros_gestion(empresa,codigo,nombre,tipo) values(empresa_test,'TEST-B','Centro Administración','Administración') returning id into c2;
  insert into public.obras(empresa,nombre,centro_gestion_id) values(empresa_test,'Obra test A',c1) returning id into o1;
  insert into public.obras(empresa,nombre) values(empresa_test,'Obra test B') returning id into o2;
  insert into public.maestro_personal(empresa,nombre,rut,centro_gestion_defecto_id,fecha_inicio_contrato,fecha_vencimiento_contrato)
    values(empresa_test,'TEST IMPUTACIONES','99999999-K',c2,'2099-01-01','2099-01-31') returning id into w;
  insert into public.asistencia_personal(empresa,obra_id,obra_nombre,rut,trabajador,fecha_marcacion,asistencia)
    values(empresa_test,o1,'Obra test A','99999999-K','TEST IMPUTACIONES','2099-01-05','PRESENTE');
  perform public.preparar_imputaciones_personal(empresa_test,'2099-01');
  select * into r from public.rrhh_imputaciones_diarias where empresa=empresa_test and trabajador_id=w and fecha='2099-01-05';
  if r.centro_propuesto_id<>c1 or r.origen<>'Asistencia' then raise exception 'La asistencia no prevalece sobre el centro predeterminado'; end if;
  if not exists(select 1 from public.rrhh_imputaciones_diarias where empresa=empresa_test and trabajador_id=w and origen='Sin asistencia' and centro_propuesto_id=c2) then raise exception 'No se propone el centro predeterminado'; end if;
  insert into public.rrhh_nominas_mensuales(empresa,periodo,estado) values(empresa_test,'2099-01','Cerrada') returning id into n;
  insert into public.rrhh_nomina_items(nomina_id,trabajador_id,trabajador_nombre,calculo,sueldo_liquido) values(n,w,'TEST IMPUTACIONES','{"employerCost":1000001}',900000) returning id into ni;
  insert into public.obra_liquidaciones(empresa,obra_id,obra_nombre,trabajador,periodo,monto_real,nomina_id) values(empresa_test,o1,'Obra test A','TEST MANUAL','2099-01',77,n) returning id into manual_id;
  insert into public.rrhh_nominas_mensuales(empresa,periodo,estado) values(empresa_test,'2099-02','Cerrada') returning id into n2;
  insert into public.rrhh_nomina_items(nomina_id,trabajador_id,trabajador_nombre) values(n2,w,'TEST OTRA NÓMINA') returning id into ni2;
  insert into public.obra_liquidaciones(empresa,obra_id,obra_nombre,trabajador,periodo,monto_real,nomina_id,nomina_item_id) values(empresa_test,o1,'Obra test A','TEST OTRA NÓMINA','2099-02',88,n2,ni2) returning id into otra_id;
  resultado:=public.distribuir_nomina_a_obras(n);
  if coalesce((resultado->>'distribuida')::boolean,true) then raise exception 'Se distribuyó sin aprobar'; end if;
  select jsonb_agg(jsonb_build_object('id',id,'evidencia',evidencia,'centro_id',centro_propuesto_id)) into decisiones
    from public.rrhh_imputaciones_diarias where empresa=empresa_test and trabajador_id=w;
  perform public.aprobar_imputaciones_personal(empresa_test,decisiones);
  resultado:=public.distribuir_nomina_a_obras(n);
  if not (resultado->>'distribuida')::boolean then raise exception 'No se distribuyó con aprobaciones'; end if;
  if (select sum(monto) from public.rrhh_costos_centros_aprobados where nomina_id=n)<>1000001 then raise exception 'No conserva el costo total y redondeo'; end if;
  if (select count(*) from public.rrhh_costos_centros_aprobados where nomina_id=n)<>2 then raise exception 'No distribuye a obra y administración'; end if;
  if (select sum(monto_imputado) from public.obra_liquidaciones_partidas where nomina_id=n) is distinct from (select sum(monto_real) from public.obra_liquidaciones where nomina_id=n and nomina_item_id is not null) then raise exception 'El detalle por partida no cuadra'; end if;
  perform public.distribuir_nomina_a_obras(n);
  if (select count(*) from public.rrhh_costos_centros_aprobados where nomina_id=n)<>2 then raise exception 'Recalcular duplica costos'; end if;
  if not exists(select 1 from public.obra_liquidaciones where id=manual_id and monto_real=77) then raise exception 'Se alteró liquidación manual'; end if;
  if not exists(select 1 from public.obra_liquidaciones where id=otra_id and monto_real=88) then raise exception 'Se alteró otra nómina'; end if;
  -- Simula una segunda obra el mismo día y comprueba invalidación y rechazo de aprobación obsoleta.
  insert into public.asistencia_personal(empresa,obra_id,obra_nombre,rut,trabajador,fecha_marcacion,asistencia)
    values(empresa_test,o2,'Obra test B','99999999-K','TEST IMPUTACIONES','2099-01-05','PRESENTE');
  if exists(select 1 from public.rrhh_imputaciones_diarias where id=r.id and estado='Aprobada') then raise exception 'La asistencia tardía no invalida'; end if;
  rechazo:=false;
  begin perform public.aprobar_imputaciones_personal(empresa_test,jsonb_build_array(jsonb_build_object('id',r.id,'evidencia',r.evidencia,'centro_id',c1)));
  exception when others then rechazo:=true; end;
  if not rechazo then raise exception 'Se aprobó evidencia obsoleta'; end if;
  perform public.preparar_imputaciones_personal(empresa_test,'2099-01');
  select * into r from public.rrhh_imputaciones_diarias where id=r.id;
  if r.origen<>'Múltiples obras' or r.centro_propuesto_id is not null then raise exception 'Se duplica o resuelve arbitrariamente un día multiobra'; end if;
  perform public.aprobar_imputaciones_personal(empresa_test,jsonb_build_array(jsonb_build_object('id',r.id,'evidencia',r.evidencia,'centro_id',c2,'comentario','Reasignación verificada')));
  -- Sin autenticación, ninguna función permite aprobar ni leer nuevas tablas.
  perform set_config('request.jwt.claim.sub','',true);
  if private.rrhh_imputaciones_permiso(empresa_test,'aprobar') then raise exception 'Acceso anónimo permitido'; end if;
  if has_table_privilege('anon','public.rrhh_imputaciones_diarias','SELECT') or has_table_privilege('authenticated','public.rrhh_imputaciones_diarias','UPDATE') then raise exception 'Privilegios directos excesivos'; end if;
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  if private.rrhh_imputaciones_permiso(empresa_test,'ver') then raise exception 'Actor ajeno puede ver imputaciones'; end if;
end; $$;
set local role authenticated;
do $$
declare rechazado boolean:=false;
begin
  if exists(select 1 from public.rrhh_imputaciones_diarias where empresa='__TEST_IMPUTACIONES_ROLLBACK__') then raise exception 'RLS permite leer otra empresa'; end if;
  if exists(select 1 from public.rrhh_costos_centros_aprobados where empresa='__TEST_IMPUTACIONES_ROLLBACK__') then raise exception 'RLS permite leer costos ajenos'; end if;
  begin perform public.preparar_imputaciones_personal('__TEST_IMPUTACIONES_ROLLBACK__','2099-01');
  exception when others then rechazado:=true; end;
  if not rechazado then raise exception 'La API permite preparar imputaciones sin actor autorizado'; end if;
end; $$;
rollback;
