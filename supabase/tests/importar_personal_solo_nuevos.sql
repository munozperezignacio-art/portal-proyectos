begin;
do $$
declare actor uuid; r jsonb; id_primero integer; antes jsonb; rechazado boolean; empresa_test text:='__TEST_IMPORTAR_PERSONAL_ROLLBACK__';
begin
  select auth_user_id into actor from public.usuarios where empresa='Obraxis' and lower(coalesce(rol_base,rol,'')) in ('superusuario','superadmin') and auth_user_id is not null limit 1;
  if actor is null then raise exception 'Falta actor de prueba'; end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  r:=public.importar_personal_solo_nuevos(empresa_test,'[{"fila":3,"rut":"12.345.678-5","nombre":"Prueba","cargo":"Operador","fecha_inicio_contrato":"2026-01-01","fecha_vencimiento_contrato":"3000-12-31","sueldo_base":650000,"afp":null}]');
  if r->0->>'estado'<>'creado' then raise exception 'No crea: %',r; end if;
  id_primero:=(r->0->>'id')::integer;
  select to_jsonb(p) into antes from public.maestro_personal p where id=id_primero;
  if antes->>'tipo_contrato'<>'Indefinido' or antes->>'fecha_vencimiento_contrato' is not null or antes->>'afp' is not null then raise exception 'Transformación errónea'; end if;
  r:=public.importar_personal_solo_nuevos(empresa_test,'[{"fila":3,"rut":"123456785","nombre":"NO CAMBIAR","sueldo_base":1,"fecha_inicio_contrato":"fecha inválida"}]');
  if r->0->>'estado'<>'existente' or (select to_jsonb(p) from public.maestro_personal p where id=id_primero) is distinct from antes then raise exception 'Modifica ficha existente'; end if;
  r:=public.importar_personal_solo_nuevos(empresa_test,'[{"fila":4,"rut":"11111111-1","nombre":"Prueba renuncia","cargo":"Operador","fecha_inicio_contrato":"2026-01-01","fecha_vencimiento_contrato":"2026-10-07","causal_termino_contrato":"159i2"}]');
  if r->0->>'estado'<>'creado' or not exists(select 1 from public.maestro_personal where id=(r->0->>'id')::integer and causal_termino_contrato='159i2' and fecha_vencimiento_contrato='2026-10-07' and tipo_contrato='No informado') then raise exception 'Pierde renuncia: %',r; end if;
  r:=public.importar_personal_solo_nuevos('__TEST_IMPORTAR_OTRA__','[{"rut":"12345678-5","nombre":"Otro","cargo":"Operador"}]');
  if r->0->>'estado'<>'creado' then raise exception 'RUT de otra empresa bloquea importación'; end if;
  r:=public.importar_personal_solo_nuevos(empresa_test,'[{"rut":"22222222-2","nombre":"Duplicado","cargo":"Operador"},{"rut":"22.222.222-2","nombre":"Duplicado 2","cargo":"Operador"}]');
  if r->0->>'estado'<>'error' or r->1->>'estado'<>'error' then raise exception 'Acepta duplicados de archivo'; end if;
  r:=public.importar_personal_solo_nuevos(empresa_test,'[{"rut":"12345678-9","nombre":"Mal rut","cargo":"Operador"},{"empresa":"OTRA","rut":"22222222-2","nombre":"Intruso","cargo":"Operador"}]');
  if r->0->>'estado'<>'error' or r->1->>'estado'<>'error' then raise exception 'Validación servidor incompleta'; end if;
  perform set_config('request.jwt.claim.sub','',true); rechazado:=false;
  begin perform public.importar_personal_solo_nuevos(empresa_test,'[{"rut":"12345678-5"}]'); exception when insufficient_privilege then rechazado:=true; end;
  if not rechazado then raise exception 'Permite importar sin sesión'; end if;
  if has_function_privilege('anon','public.importar_personal_solo_nuevos(text,jsonb)','EXECUTE') then raise exception 'RPC accesible a anon'; end if;
  select auth_user_id into actor from public.usuarios where empresa='EMINSG' and auth_user_id is not null limit 1;
  perform set_config('request.jwt.claim.sub',actor::text,true); rechazado:=false;
  begin perform public.importar_personal_solo_nuevos(empresa_test,'[{"rut":"12345678-5"}]'); exception when insufficient_privilege then rechazado:=true; end;
  if not rechazado then raise exception 'Permite importar en otra empresa'; end if;
end; $$;
-- Comprueba la misma ruta RPC/privilegios que utiliza el navegador.
select set_config('request.jwt.claim.sub',auth_user_id::text,true) from public.usuarios where empresa='EMINSG' and lower(correo)='imunozp@eminsg.cl';
set local role authenticated;
do $$
declare r jsonb;
begin
  r:=public.importar_personal_solo_nuevos('EMINSG','[{"rut":"180093850"}]');
  if r->0->>'estado'<>'existente' then raise exception 'No funciona la RPC para authenticated'; end if;
end; $$;
reset role;
rollback;
