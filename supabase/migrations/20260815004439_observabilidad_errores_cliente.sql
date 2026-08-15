create or replace function public.registrar_error_cliente(
  p_mensaje text,
  p_stack text default null,
  p_contexto jsonb default '{}'::jsonb
) returns bigint
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_profile public.usuarios%rowtype;
  v_id bigint;
begin
  if auth.uid() is null then raise exception 'Autenticación requerida'; end if;
  select * into v_profile from public.usuarios where auth_user_id = auth.uid() and coalesce(activo, true) limit 1;
  if v_profile.id is null then raise exception 'Usuario activo no encontrado'; end if;
  if (select count(*) from public.auditoria_plataforma
      where actor_auth_user_id = auth.uid() and modulo = 'plataforma'
        and categoria = 'Error cliente' and created_at > now() - interval '1 minute') >= 10
  then raise exception 'Límite de reportes excedido'; end if;

  insert into public.auditoria_plataforma(
    empresa, modulo, categoria, accion, descripcion, actor_auth_user_id,
    actor_usuario, actor_nombre, actor_rol, actor_empresa, origen, resultado, nivel, metadatos
  ) values (
    v_profile.empresa, 'plataforma', 'Error cliente', 'error_cliente',
    left(coalesce(nullif(trim(p_mensaje), ''), 'Error no identificado'), 500),
    auth.uid(), v_profile.usuario, v_profile.nombre, coalesce(v_profile.rol_base, v_profile.rol),
    v_profile.empresa, 'frontend', 'fallido', 'critico',
    jsonb_build_object(
      'ruta', left(coalesce(p_contexto->>'ruta', ''), 500),
      'componente', left(coalesce(p_contexto->>'componente', ''), 200),
      'stack', left(coalesce(p_stack, ''), 4000),
      'version', left(coalesce(p_contexto->>'version', ''), 100)
    )
  ) returning id into v_id;
  return v_id;
end $$;

revoke all on function public.registrar_error_cliente(text, text, jsonb) from public, anon;
grant execute on function public.registrar_error_cliente(text, text, jsonb) to authenticated;

comment on function public.registrar_error_cliente(text, text, jsonb) is
'Registra errores no controlados del frontend para usuarios autenticados, con límite de frecuencia y sin datos funcionales.';
