begin;
do $$
declare perfil public.usuarios; obra integer; obra_nombre_test text; registro integer; afectados integer; denegado boolean;
begin
 select * into perfil from public.usuarios where empresa='EMINSG' and rol='Oficina Técnica' and auth_user_id is not null limit 1;
 if not found then raise exception 'Se necesita un usuario del rol Oficina Técnica para esta regresión'; end if;
 perform set_config('request.jwt.claim.sub',perfil.auth_user_id::text,true);
 if not private.obraxis_permission(perfil.empresa,'obras.avances.editar') then raise exception 'El permiso real de Oficina Técnica no habilita editar'; end if;
 if private.obraxis_permission(perfil.empresa,'obras.avances.eliminar') then raise exception 'Oficina Técnica recibe eliminación sin concederla'; end if;
 if private.obraxis_permission('__OTRA_EMPRESA__','obras.avances.editar') then raise exception 'Permite otra empresa'; end if;
 select id into obra from public.obras where empresa=perfil.empresa limit 1;
 insert into public.avances_produccion_partidas(obra_id,empresa,partida,cantidad) values(obra,perfil.empresa,'__TEST_PERMISO_AVANCE__',1) returning id into registro;
 -- Ejecutar el UPDATE/DELETE real con RLS, dentro de la transacción revertida.
 execute 'set local role authenticated';
 update public.avances_produccion_partidas set cantidad=2 where id=registro;
 get diagnostics afectados=row_count;
 if afectados<>1 then raise exception 'RLS no permite editar con el permiso concedido'; end if;
 delete from public.avances_produccion_partidas where id=registro;
 get diagnostics afectados=row_count;
 if afectados<>0 then raise exception 'RLS permite eliminar sin permiso'; end if;
 execute 'reset role';
 -- Una denegación explícita por usuario también prevalece sobre el rol.
 update public.usuarios set permisos=coalesce(permisos,'{}'::jsonb)||'{"obras.avances.editar":false}'::jsonb where id=perfil.id;
 execute 'set local role authenticated';
 update public.avances_produccion_partidas set cantidad=3 where id=registro;
 get diagnostics afectados=row_count;
 if afectados<>0 then raise exception 'Ignora la denegación explícita'; end if;
 execute 'reset role';
 if private.obraxis_configurar_responsabilidad(perfil.empresa,'{"alcance_tipo":"todas"}') then raise exception 'Permite configurar avisos globales sin permiso'; end if;
 update public.usuarios set permisos=coalesce(permisos,'{}'::jsonb)||'{"obras.ficha.configurar":true,"admin.permisos.configurar":false}'::jsonb where id=perfil.id;
 select nombre into obra_nombre_test from public.obras where id=obra;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',perfil.auth_user_id,'email',perfil.correo)::text,true);
 execute 'set local role authenticated';
 insert into public.notificaciones_reglas(empresa,nombre,evento_codigo,modulo,condiciones,activa)
 values(perfil.empresa,'__TEST_RESPONSABILIDAD__','avance_reporte_pendiente','Obras',jsonb_build_object('alcance_tipo','seleccionadas','obras_seleccionadas',jsonb_build_array(obra_nombre_test)),false);
 denegado:=false;
 begin
  insert into public.notificaciones_reglas(empresa,nombre,evento_codigo,modulo,condiciones,activa)
  values(perfil.empresa,'__TEST_GLOBAL_DENEGADA__','avance_reporte_pendiente','Obras','{"alcance_tipo":"todas"}',false);
 exception when insufficient_privilege then denegado:=true; end;
 if not denegado then raise exception 'Permite responsabilidad global sin permiso global'; end if;
 execute 'reset role';
 if has_function_privilege('anon','private.obraxis_permission(text,text)','EXECUTE') then raise exception 'Función accesible a anon'; end if;
end; $$;
rollback;
select 'Permisos de edición, denegación, eliminación y aislamiento verificados; cambios revertidos' as resultado;
