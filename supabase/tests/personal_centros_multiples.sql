begin;
do $$
declare actor uuid; a integer;b integer;c integer;ajeno integer; w integer;x integer; r jsonb; rechazado boolean;
  emp text:='__TEST_PERSONAL_CENTROS__';hoy date:=(now() at time zone 'America/Santiago')::date;
begin
  select auth_user_id into actor from public.usuarios where empresa='Obraxis' and lower(coalesce(rol_base,rol,'')) in('superusuario','superadmin') and auth_user_id is not null limit 1;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  insert into public.facturacion_centros_gestion(empresa,codigo,nombre,tipo) values(emp,'PRI','Principal','Obra') returning id into a;
  insert into public.facturacion_centros_gestion(empresa,codigo,nombre,tipo) values(emp,'SEG','Segunda obra','Obra') returning id into b;
  insert into public.facturacion_centros_gestion(empresa,codigo,nombre,tipo) values(emp,'TER','Tercera obra','Obra') returning id into c;
  insert into public.facturacion_centros_gestion(empresa,codigo,nombre,tipo) values(emp||'_OTRA','AJ','Ajeno','Obra') returning id into ajeno;
  insert into public.maestro_personal(empresa,nombre,rut,centro_gestion_id,sueldo_base,fecha_inicio_contrato)
    values(emp,'Persona A','99999882-1',a,650000,hoy-30) returning id into w;
  insert into public.maestro_personal(empresa,nombre,rut,centro_gestion_id,sueldo_base,fecha_inicio_contrato)
    values(emp,'Persona B','99999882-2',a,700000,hoy-30) returning id into x;
  r:=public.gestionar_personal_centros(emp,array[w,x],array[a,b,c],hoy);
  if r<>'{"agregados":4,"omitidos":2,"finalizados":0}'::jsonb then raise exception 'Lote incorrecto: %',r;end if;
  if(select count(*) from public.rrhh_personal_centros where empresa=emp)<>4 then raise exception 'Vínculos incompletos';end if;
  if not exists(select 1 from public.maestro_personal where id=w and centro_gestion_id=a and sueldo_base=650000) then raise exception 'Cambió principal o sueldo';end if;
  r:=public.gestionar_personal_centros(emp,array[w,x],array[a,b,c],hoy);
  if r<>'{"agregados":0,"omitidos":6,"finalizados":0}'::jsonb then raise exception 'Repetir duplica asignaciones';end if;
  rechazado:=false;begin perform public.gestionar_personal_centros(emp,array[w],array[b],hoy-1);exception when others then rechazado:=true;end;
  if not rechazado then raise exception 'Admite fechas solapadas';end if;
  rechazado:=false;begin perform public.gestionar_personal_centros(emp,array[w],array[b,ajeno],hoy);exception when others then rechazado:=true;end;
  if not rechazado or(select count(*) from public.rrhh_personal_centros where empresa=emp)<>4 then raise exception 'No aísla empresa o deja lote parcial';end if;
  rechazado:=false;begin perform public.gestionar_personal_centros(emp||'_OTRA',array[w],array[ajeno],hoy);exception when others then rechazado:=true;end;
  if not rechazado then raise exception 'Admite trabajador ajeno';end if;
  r:=public.gestionar_personal_centros(emp,array[w],array[b],hoy,hoy,'finalizar');
  if r->>'finalizados'<>'1' or not exists(select 1 from public.rrhh_personal_centros where empresa=emp and trabajador_id=w and centro_gestion_id=b and fecha_termino=hoy) then raise exception 'No conserva cierre';end if;
  perform public.gestionar_personal_centros(emp,array[w],array[b],hoy+1);
  if(select count(*) from public.rrhh_personal_centros where empresa=emp and trabajador_id=w and centro_gestion_id=b)<>2 then raise exception 'No conserva dos períodos';end if;
  update public.maestro_personal set fecha_vencimiento_contrato=hoy where id=x;
  rechazado:=false;begin perform public.gestionar_personal_centros(emp,array[x],array[c],hoy+1);exception when others then rechazado:=true;end;
  if not rechazado then raise exception 'Admite asignación fuera de contrato';end if;
  if exists(select 1 from public.rrhh_imputaciones_diarias where empresa=emp) or exists(select 1 from public.rrhh_asignaciones_personal where empresa=emp) then raise exception 'Asignar pertenencia crea cargos o altera historial principal';end if;
  update public.usuarios set empresa=emp,rol='Inspector',rol_base='Inspector',permisos='{"rrhh.personal.editar":false}' where auth_user_id=actor;
  rechazado:=false;begin perform public.gestionar_personal_centros(emp,array[w],array[c],hoy);exception when insufficient_privilege then rechazado:=true;end;
  if not rechazado then raise exception 'Ignora permiso denegado';end if;
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);rechazado:=false;
  begin perform public.gestionar_personal_centros(emp,array[w],array[c],hoy);exception when insufficient_privilege then rechazado:=true;end;
  if not rechazado then raise exception 'Admite sesión desconocida';end if;
  if has_table_privilege('authenticated','public.rrhh_personal_centros','INSERT,UPDATE,DELETE') or has_function_privilege('anon','public.gestionar_personal_centros(text,integer[],integer[],date,date,text)','EXECUTE') then raise exception 'Permisos excesivos';end if;
end; $$;
rollback;
select 'Centros múltiples: lote, historial, no duplicación, no costos, contrato, empresa y permisos verificados' as verificacion;
