begin;
do $$
declare actor uuid; a integer; b integer; c integer; w integer; v_partida integer; resultado jsonb; rechazado boolean;
  ep bigint:=-floor(extract(epoch from clock_timestamp())*1000)::bigint;
  emp text:='__TEST_FICHA_ROLLBACK__'; anterior text:='Proyecto inicial prueba'; nuevo text:='Proyecto renombrado prueba';
begin
  select auth_user_id into actor from public.usuarios where empresa='Obraxis' and lower(coalesce(rol_base,rol,'')) in ('superusuario','superadmin') and auth_user_id is not null limit 1;
  if actor is null then raise exception 'Falta actor de prueba'; end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  insert into public.obras(empresa,nombre,tipo,estado,presupuesto_costo_control) values(emp,anterior,'Original','Activa',123456) returning id,centro_gestion_id into a,c;
  insert into public.obras(empresa,nombre) values(emp,'Duplicado') returning id into b;
  insert into public.obras(empresa,nombre) values(emp||'_OTRA',anterior);
  insert into public.maestro_personal(empresa,nombre,rut,obra_nombre,sueldo_base) values(emp,'Prueba ficha','99999881-1',anterior,654321) returning id into w;
  insert into public.partidas_obra(empresa,obra_id,obra_nombre,partida) values(emp,a,anterior,'Partida prueba') returning id into v_partida;
  insert into public.estados_pago_obra(id,empresa,obra_nombre,numero,fecha_corte) values(ep,emp,anterior,1,'2026-09-30');
  insert into public.facturacion_documentos(empresa,tipo_dte,folio,rut_receptor,nombre_receptor,obra_nombre,estado_pago_id,direccion_flujo,estado_pago,monto_total)
    values(emp,33,1,'99999881-1','Prueba ficha',anterior,ep,'Venta','Pagada',345678);
  update public.estados_pago_obra set factura_fecha_pago='2026-09-15' where id=ep;
  insert into public.config_empresa(empresa,correos_contextuales) values(emp,jsonb_build_object('avances_obra:'||anterior,jsonb_build_object('emails',jsonb_build_array('test@example.invalid'),'autoNotify',true)));
  insert into public.config_correos(empresa,tipo,filtro,correos) values(emp,'Produccion Diaria',anterior,'test@example.invalid');
  resultado:=public.actualizar_ficha_obra(emp,a,anterior,jsonb_build_object('nombre',nuevo,'cliente','Mandante prueba','presupuesto_costo_control',999));
  if (resultado->>'id')::integer<>a or resultado->>'nombre'<>nuevo or (resultado->>'presupuesto_costo_control')::numeric<>123456 then raise exception 'Cambió identidad o campos no permitidos'; end if;
  if not exists(select 1 from public.maestro_personal where id=w and obra_nombre=nuevo and sueldo_base=654321) then raise exception 'No conserva personal'; end if;
  if not exists(select 1 from public.partidas_obra where id=v_partida and obra_id=a and obra_nombre=nuevo) then raise exception 'No propaga FK'; end if;
  if not exists(select 1 from public.facturacion_documentos where empresa=emp and obra_nombre=nuevo and monto_total=345678 and estado_pago='Pagada') then raise exception 'Factura alterada'; end if;
  if not exists(select 1 from public.estados_pago_obra where id=ep and obra_nombre=nuevo and factura_fecha_pago='2026-09-15' and factura_monto=345678) then raise exception 'Renombrar alteró el pago histórico'; end if;
  if not exists(select 1 from public.obras where empresa=emp||'_OTRA' and nombre=anterior) then raise exception 'Modifica otra empresa'; end if;
  if not exists(select 1 from public.config_empresa where empresa=emp and correos_contextuales ? ('avances_obra:'||nuevo) and not correos_contextuales ? ('avances_obra:'||anterior)) then raise exception 'Pierde configuración de correos'; end if;
  if not exists(select 1 from public.config_correos where empresa=emp and filtro=nuevo and correos='test@example.invalid') then raise exception 'Pierde filtro de notificaciones'; end if;
  resultado:=public.actualizar_ficha_obra(emp,a,nuevo,'{"ubicacion":"Dirección prueba"}');
  if resultado->>'nombre'<>nuevo or resultado->>'ubicacion'<>'Dirección prueba' then raise exception 'Edición sin renombre'; end if;
  rechazado:=false;begin perform public.actualizar_ficha_obra(emp,a,nuevo,'{"nombre":"duplicado"}');exception when others then rechazado:=true;end;
  if not rechazado then raise exception 'Admite duplicado sin distinguir mayúsculas'; end if;
  rechazado:=false;begin perform public.actualizar_ficha_obra(emp,a,anterior,'{"nombre":"Desfasado"}');exception when others then rechazado:=true;end;
  if not rechazado then raise exception 'Admite escritura desfasada'; end if;
  rechazado:=false;begin perform public.actualizar_ficha_obra(emp,a,nuevo,'{"nombre":"todas"}');exception when others then rechazado:=true;end;
  if not rechazado then raise exception 'Admite nombre reservado'; end if;
  rechazado:=false;begin perform public.actualizar_ficha_obra(emp,a,nuevo,'{"estado":"Terminada"}');exception when others then rechazado:=true;end;
  if not rechazado then raise exception 'Cierra sin fecha ni motivo'; end if;
  -- La colisión de configuración debe deshacer también el cambio de nombre/FK.
  update public.config_empresa set correos_contextuales=correos_contextuales||'{"avances_obra:Colision":{"emails":["otro@example.invalid"]}}'::jsonb where empresa=emp;
  rechazado:=false;begin perform public.actualizar_ficha_obra(emp,a,nuevo,'{"nombre":"Colision"}');exception when others then rechazado:=true;end;
  if not rechazado or not exists(select 1 from public.obras where id=a and nombre=nuevo) or not exists(select 1 from public.maestro_personal where id=w and obra_nombre=nuevo) then raise exception 'No revierte todas las referencias en error'; end if;
  -- Solo durante esta transacción: comprobar permiso explícito y alcance por obra.
  -- No se tocan correo ni contraseña ni se ejecuta el trigger de Auth.
  update public.usuarios set empresa=emp,rol='Inspector',rol_base='Inspector',obras=nuevo,permisos='{"obras.ficha.editar":false}' where auth_user_id=actor;
  rechazado:=false;begin perform public.actualizar_ficha_obra(emp,a,nuevo,'{"ubicacion":"Bloqueada"}');exception when insufficient_privilege then rechazado:=true;end;
  if not rechazado then raise exception 'Ignora permiso explícito denegado'; end if;
  update public.usuarios set permisos='{"obras.ficha.editar":true}',obras='Otra obra' where auth_user_id=actor;
  rechazado:=false;begin perform public.actualizar_ficha_obra(emp,a,nuevo,'{"ubicacion":"Fuera de alcance"}');exception when insufficient_privilege then rechazado:=true;end;
  if not rechazado then raise exception 'Ignora alcance por proyecto'; end if;
  update public.usuarios set obras=nuevo||',Otro Lonco' where auth_user_id=actor;
  resultado:=public.actualizar_ficha_obra(emp,a,nuevo,'{"nombre":"Nombre final prueba"}');
  if not exists(select 1 from public.usuarios where auth_user_id=actor and obras='Nombre final prueba,Otro Lonco') then raise exception 'Pierde el alcance del usuario al renombrar'; end if;
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);rechazado:=false;
  begin perform public.actualizar_ficha_obra(emp,a,nuevo,'{"nombre":"No autorizado"}');exception when insufficient_privilege then rechazado:=true;end;
  if not rechazado then raise exception 'Admite sesión no autorizada'; end if;
  if has_function_privilege('anon','public.actualizar_ficha_obra(text,integer,text,jsonb)','EXECUTE') or has_function_privilege('authenticated','private.renombrar_referencias_obra(text,integer,text,text)','EXECUTE') then raise exception 'Permiso RPC excesivo'; end if;
end; $$;
rollback;
select 'Ficha de proyecto: identidad, referencias, pagos, aislamiento, permisos y rollback verificados' as verificacion;
