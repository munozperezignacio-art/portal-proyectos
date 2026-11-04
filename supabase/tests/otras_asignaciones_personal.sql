begin;
do $$
declare w integer; t bigint; d jsonb; actor uuid; rows jsonb;
begin
 select auth_user_id into actor from public.usuarios where empresa='Obraxis' and lower(coalesce(rol_base,rol,'')) in ('superusuario','superadmin') and auth_user_id is not null limit 1;
 if actor is null then raise exception 'Falta actor de prueba'; end if;
 perform set_config('request.jwt.claim.sub',actor::text,true);
 rows:='[{"nombre":"Responsabilidad","monto":90000,"tipo":"imponible","desde":"2020-02","hasta":null},{"nombre":"Viático","monto":60000,"tipo":"no_imponible","desde":"2020-02","hasta":"2020-03"}]';
 if not private.rrhh_asignaciones_validas(rows) then raise exception 'Rechaza asignaciones válidas'; end if;
 if private.rrhh_asignaciones_validas('[{"nombre":"","monto":-1,"tipo":"otro","desde":"2020-13"}]') then raise exception 'Acepta asignación inválida'; end if;
 insert into public.maestro_personal(empresa,nombre,rut,sueldo_base,gratificacion,colacion,movilizacion,otras_asignaciones)
 values('__TEST_ALLOWANCES__','Prueba asignaciones','99999980-1',600000,'Sin Gratificación',0,0,rows) returning id into w;
 insert into public.rrhh_costeo_parametros(empresa,periodo,horas_semanales,tope_gratificacion_mensual,cargas_empleador_pct)
 values('__TEST_ALLOWANCES__','2020-01',42,100000,10),('__TEST_ALLOWANCES__','2020-02',42,100000,10),('__TEST_ALLOWANCES__','2020-04',42,100000,10);
 insert into public.rrhh_imputaciones_diarias(empresa,trabajador_id,fecha,origen,evidencia)
 values('__TEST_ALLOWANCES__',w,'2020-02-03','Sin asistencia','{}') returning id into t;
 d:=private.rrhh_calcular_costo_dia(t,100,200,0);
 if (d->>'total')::numeric<>27610 or (d->>'haber_imponible')::numeric<>100 or (d->>'haber_no_imponible')::numeric<>200 then raise exception 'Costeo diario incorrecto: %',d; end if;
 if d is distinct from private.rrhh_calcular_costo_dia(t,100,200,0) then raise exception 'Recalcular duplica costo'; end if;
 update public.rrhh_imputaciones_diarias set fecha='2020-01-03' where id=t;
 d:=private.rrhh_calcular_costo_dia(t,100,200,0);
 if (d->>'total')::numeric<>22310 then raise exception 'Alteró meses anteriores'; end if;
 update public.rrhh_imputaciones_diarias set fecha='2020-04-03' where id=t;
 d:=private.rrhh_calcular_costo_dia(t,100,200,0);
 if (d->>'total')::numeric<>25610 then raise exception 'No respeta término'; end if;
 if has_function_privilege('authenticated','private.rrhh_calcular_costo_dia(bigint,numeric,numeric,numeric)','execute') then raise exception 'Motor expuesto'; end if;
end; $$;
rollback;
