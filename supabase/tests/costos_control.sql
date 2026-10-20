begin;
do $$
declare perfil public.usuarios; equipo integer; primera bigint; segunda bigint; nombre_a text; nombre_b text; periodo bigint; n integer; denied boolean;
begin
 select * into perfil from public.usuarios where empresa='EMINSG' and rol='Oficina Técnica' and auth_user_id is not null limit 1;
 select id,nombre into primera,nombre_a from public.obras where empresa=perfil.empresa order by id limit 1;
 select id,nombre into segunda,nombre_b from public.obras where empresa=perfil.empresa and id<>primera order by id limit 1;
 if perfil.auth_user_id is null or segunda is null then raise exception 'Faltan datos de prueba'; end if;
 insert into public.inventario_maquinaria(empresa,tipo,patente,obra_nombre,fecha_asig,costo_interno,unidad_costo_interno)
 values(perfil.empresa,'__CONTROL_TEST__','__TEST__',nombre_a,'2026-10-01',100,'$/día') returning id into equipo;
 select id into periodo from public.maquinaria_periodos_costo where equipo_id=equipo;
 if periodo is null then raise exception 'No creó historial'; end if;
 update public.inventario_maquinaria set obra_nombre=nombre_b,fecha_asig='2026-10-13',fecha_cambio_asignacion='2026-10-13' where id=equipo;
 if (select hasta from public.maquinaria_periodos_costo where id=periodo)<>'2026-10-13'::date then raise exception 'No cerró período anterior'; end if;
 if (select count(*) from public.maquinaria_periodos_costo where equipo_id=equipo)<>2 then raise exception 'Perdió historial'; end if;
 update public.inventario_maquinaria set costo_interno=120 where id=equipo;
 if (select count(distinct asignacion_id) from public.maquinaria_periodos_costo where equipo_id=equipo)<>2 then raise exception 'Tarifa abrió otra asignación'; end if;
 perform set_config('request.jwt.claim.sub',perfil.auth_user_id::text,true);
 execute 'set local role authenticated';
 select count(*) into n from public.maquinaria_periodos_costo where equipo_id=equipo;
 if n<>3 then raise exception 'Lectura autorizada bloqueada'; end if;
 if private.obraxis_permission(perfil.empresa,'obras.gestion.configurar') or private.obraxis_permission(perfil.empresa,'obras.maquinaria.editar') then
   insert into public.maquinaria_decisiones_costo(empresa,equipo_id,obra_id,periodo_id,fecha,tipo,monto,motivo)
   values(perfil.empresa,equipo,primera,periodo,'2026-10-09','confirmar',80,'Prueba transaccional');
   update public.maquinaria_decisiones_costo set monto=90 where equipo_id=equipo;
   if (select count(*) from public.maquinaria_decisiones_costo where equipo_id=equipo)<>1 then raise exception 'Duplicó confirmación'; end if;
   if (select count(*) from public.costos_control_historial where tabla='maquinaria_decisiones_costo' and nuevo->>'equipo_id'=equipo::text)<>2 then raise exception 'Falta auditoría'; end if;
 else raise exception 'El perfil de prueba no tiene permiso de costos'; end if;
 denied:=false;begin
   insert into public.maquinaria_decisiones_costo(empresa,equipo_id,obra_id,periodo_id,fecha,tipo,motivo) values('OTRA_EMPRESA_TEST',equipo,primera,periodo,'2026-10-10','no_uso','No autorizado');
 exception when others then denied:=true;end;
 if not denied then raise exception 'Permitió otra empresa'; end if;
 denied:=false;begin
   insert into public.maquinaria_decisiones_costo(empresa,equipo_id,obra_id,fecha,tipo,monto,motivo) values(perfil.empresa,equipo,primera,'2099-01-01','confirmar',100,'Futuro');
 exception when others then denied:=true;end;
 if not denied then raise exception 'Confirmó costo futuro'; end if;
 denied:=false;begin update public.maquinaria_periodos_costo set tarifa=1 where id=periodo;exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Permitió adulterar tarifa histórica'; end if;
 execute 'set local role anon';
 denied:=false;begin perform 1 from public.maquinaria_decisiones_costo;exception when insufficient_privilege then denied:=true;end;
 if not denied then raise exception 'Anon puede leer costos'; end if;
 execute 'reset role';
end $$;
rollback;
