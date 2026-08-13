-- Cierre de gobierno IA: límites mensuales y autorización por rol/usuario.
alter table public.ia_config_empresas
  add column if not exists limites_funcion jsonb not null default '{}'::jsonb,
  add column if not exists limites_usuario jsonb not null default '{}'::jsonb;

comment on column public.ia_config_empresas.limites_funcion is
  'Por función: presupuesto_mensual_usd, max_ejecuciones_usuario_mes y roles_autorizados.';
comment on column public.ia_config_empresas.limites_usuario is
  'Por auth_user_id: habilitado, presupuesto_mensual_usd y max_ejecuciones_mes.';

create or replace function public.ia_reservar_consumo(
  p_empresa text,
  p_obra_nombre text,
  p_auth_user_id uuid,
  p_usuario text,
  p_funcion text,
  p_modelo text,
  p_reserva_usd numeric default 0.02
) returns uuid
language plpgsql
security invoker
set search_path=public
as $$
declare
  v_config public.ia_config_empresas%rowtype;
  v_consumido numeric(12,6);
  v_consumido_funcion numeric(12,6);
  v_consumido_usuario numeric(12,6);
  v_ejecuciones_usuario_funcion integer;
  v_ejecuciones_usuario integer;
  v_id uuid;
  v_rol text;
  v_limite_funcion jsonb;
  v_limite_usuario jsonb;
  v_roles jsonb;
  v_presupuesto_funcion numeric;
  v_presupuesto_usuario numeric;
  v_max_funcion_usuario integer;
  v_max_usuario integer;
begin
  if p_auth_user_id is null then
    raise exception 'La ejecución de IA requiere un usuario autenticado.' using errcode='P0001';
  end if;

  perform pg_advisory_xact_lock(hashtext(lower(trim(p_empresa))));
  insert into public.ia_config_empresas (empresa) values (p_empresa) on conflict (empresa) do nothing;
  select * into v_config from public.ia_config_empresas where empresa=p_empresa for update;

  if not v_config.habilitada then
    raise exception 'La inteligencia artificial está deshabilitada para esta empresa.' using errcode='P0001';
  end if;
  if coalesce((v_config.funciones->>p_funcion)::boolean,false) is false then
    raise exception 'Esta función de inteligencia artificial no está habilitada para la empresa.' using errcode='P0001';
  end if;

  select coalesce(nullif(trim(rol),''),nullif(trim(rol_base),''),'Sin rol')
    into v_rol
    from public.usuarios
   where auth_user_id=p_auth_user_id and lower(trim(empresa))=lower(trim(p_empresa))
   order by id
   limit 1;
  if v_rol is null then
    raise exception 'El usuario autenticado no pertenece a esta empresa.' using errcode='P0001';
  end if;

  v_limite_funcion := coalesce(v_config.limites_funcion->p_funcion,'{}'::jsonb);
  v_limite_usuario := coalesce(v_config.limites_usuario->(p_auth_user_id::text),'{}'::jsonb);
  v_roles := coalesce(v_limite_funcion->'roles_autorizados','[]'::jsonb);

  if jsonb_array_length(v_roles)>0 and not exists (
    select 1 from jsonb_array_elements_text(v_roles) r where lower(trim(r))=lower(trim(v_rol))
  ) then
    raise exception 'Tu rol no está autorizado para utilizar esta función de IA.' using errcode='P0001';
  end if;
  if v_limite_usuario ? 'habilitado' and not coalesce((v_limite_usuario->>'habilitado')::boolean,true) then
    raise exception 'El uso de IA está deshabilitado para este usuario.' using errcode='P0001';
  end if;

  v_presupuesto_funcion := nullif(v_limite_funcion->>'presupuesto_mensual_usd','')::numeric;
  v_presupuesto_usuario := nullif(v_limite_usuario->>'presupuesto_mensual_usd','')::numeric;
  v_max_funcion_usuario := nullif(v_limite_funcion->>'max_ejecuciones_usuario_mes','')::integer;
  v_max_usuario := nullif(v_limite_usuario->>'max_ejecuciones_mes','')::integer;

  select coalesce(sum(costo_usd),0) into v_consumido
    from public.ia_consumos where empresa=p_empresa and created_at>=date_trunc('month',now()) and estado in ('Reservado','Completado');
  select coalesce(sum(costo_usd),0) into v_consumido_funcion
    from public.ia_consumos where empresa=p_empresa and funcion=p_funcion and created_at>=date_trunc('month',now()) and estado in ('Reservado','Completado');
  select coalesce(sum(costo_usd),0),count(*) into v_consumido_usuario,v_ejecuciones_usuario
    from public.ia_consumos where empresa=p_empresa and auth_user_id=p_auth_user_id and created_at>=date_trunc('month',now()) and estado in ('Reservado','Completado');
  select count(*) into v_ejecuciones_usuario_funcion
    from public.ia_consumos where empresa=p_empresa and auth_user_id=p_auth_user_id and funcion=p_funcion and created_at>=date_trunc('month',now()) and estado in ('Reservado','Completado');

  if v_config.bloquear_al_limite and v_config.presupuesto_mensual_usd>0 and v_consumido+greatest(p_reserva_usd,0)>v_config.presupuesto_mensual_usd then
    raise exception 'Se alcanzó el presupuesto mensual de IA de la empresa.' using errcode='P0001';
  end if;
  if coalesce(v_presupuesto_funcion,0)>0 and v_consumido_funcion+greatest(p_reserva_usd,0)>v_presupuesto_funcion then
    raise exception 'Se alcanzó el presupuesto mensual de esta función de IA.' using errcode='P0001';
  end if;
  if coalesce(v_presupuesto_usuario,0)>0 and v_consumido_usuario+greatest(p_reserva_usd,0)>v_presupuesto_usuario then
    raise exception 'Se alcanzó el presupuesto mensual de IA de este usuario.' using errcode='P0001';
  end if;
  if coalesce(v_max_funcion_usuario,0)>0 and v_ejecuciones_usuario_funcion>=v_max_funcion_usuario then
    raise exception 'Se alcanzó el límite mensual de ejecuciones para esta función.' using errcode='P0001';
  end if;
  if coalesce(v_max_usuario,0)>0 and v_ejecuciones_usuario>=v_max_usuario then
    raise exception 'Se alcanzó el límite mensual de ejecuciones de IA de este usuario.' using errcode='P0001';
  end if;

  insert into public.ia_consumos(empresa,obra_nombre,auth_user_id,usuario,funcion,modelo,estado,costo_usd,metadatos)
  values(p_empresa,nullif(p_obra_nombre,''),p_auth_user_id,p_usuario,p_funcion,p_modelo,'Reservado',greatest(p_reserva_usd,0),jsonb_build_object('rol_solicitante',v_rol))
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.ia_reservar_consumo(text,text,uuid,text,text,text,numeric) from public,anon,authenticated;
grant execute on function public.ia_reservar_consumo(text,text,uuid,text,text,text,numeric) to service_role;
