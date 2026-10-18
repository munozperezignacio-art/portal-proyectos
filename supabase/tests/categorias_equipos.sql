begin;
do $$
declare actor uuid; a bigint; b bigint; c bigint; equipo integer; rechazado boolean; empresa_test text:='__TEST_CATEGORIAS_ROLLBACK__';
begin
  select auth_user_id into actor from public.usuarios where empresa='Obraxis' and lower(coalesce(rol_base,rol,'')) in ('superusuario','superadmin') and auth_user_id is not null limit 1;
  if actor is null then raise exception 'Falta actor para prueba'; end if;
  perform set_config('request.jwt.claim.sub',actor::text,true);
  a:=public.gestionar_categoria_equipo(empresa_test,'crear',null,'Excavadoras');
  b:=public.gestionar_categoria_equipo(empresa_test,'crear',null,'Movimiento de tierras');
  c:=public.gestionar_categoria_equipo('__TEST_OTRA_CATEGORIAS__','crear',null,'Otra categoría');
  rechazado:=false;
  begin perform public.gestionar_categoria_equipo(empresa_test,'crear',null,' excavadoras ');exception when others then rechazado:=true;end;
  if not rechazado then raise exception 'Admite duplicados de nombre'; end if;
  insert into public.inventario_maquinaria(empresa,tipo,patente,marca,categoria_id,costo_interno) values(empresa_test,'Nombre original','TEST-01','Marca original',a,123456) returning id into equipo;
  perform public.gestionar_categoria_equipo(empresa_test,'editar',a,'Excavación');
  if not exists(select 1 from public.inventario_maquinaria where id=equipo and tipo='Nombre original' and categoria_id=a and costo_interno=123456) then raise exception 'Renombrar categoría modifica ficha'; end if;
  rechazado:=false;
  begin perform public.gestionar_categoria_equipo(empresa_test,'eliminar',a);exception when others then rechazado:=true;end;
  if not rechazado then raise exception 'Elimina categoría con equipos sin reasignar'; end if;
  rechazado:=false;
  begin perform public.gestionar_categoria_equipo(empresa_test,'eliminar',a,null,c);exception when others then rechazado:=true;end;
  if not rechazado then raise exception 'Permite reasignar a otra empresa'; end if;
  rechazado:=false;
  begin update public.inventario_maquinaria set categoria_id=c where id=equipo;exception when foreign_key_violation then rechazado:=true;end;
  if not rechazado then raise exception 'La FK no protege empresa'; end if;
  perform public.gestionar_categoria_equipo(empresa_test,'eliminar',a,null,b);
  if exists(select 1 from public.maquinaria_categorias where id=a) or not exists(select 1 from public.inventario_maquinaria where id=equipo and categoria_id=b and tipo='Nombre original' and marca='Marca original' and costo_interno=123456) then raise exception 'Eliminar no conserva equipo o no reasigna'; end if;
  perform public.gestionar_categoria_equipo('__TEST_OTRA_CATEGORIAS__','eliminar',c);
  if has_table_privilege('authenticated','public.maquinaria_categorias','DELETE') or has_function_privilege('anon','public.gestionar_categoria_equipo(text,text,bigint,text,bigint)','EXECUTE') then raise exception 'Privilegios excesivos'; end if;
  perform set_config('request.jwt.claim.sub',gen_random_uuid()::text,true);
  rechazado:=false;
  begin perform public.gestionar_categoria_equipo(empresa_test,'editar',b,'Sin autorización');exception when others then rechazado:=true;end;
  if not rechazado then raise exception 'Permite modificar sin acceso'; end if;
end; $$;
set local role authenticated;
do $$begin
  if exists(select 1 from public.maquinaria_categorias where empresa='__TEST_CATEGORIAS_ROLLBACK__') then raise exception 'RLS permite leer otra empresa'; end if;
end; $$;
rollback;
