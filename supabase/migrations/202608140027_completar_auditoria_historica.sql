-- Garantiza que cada actualización produzca un movimiento independiente.
create or replace function private.registrar_auditoria_cambio()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  payload jsonb := case when tg_op = 'DELETE' then to_jsonb(old) else to_jsonb(new) end;
  previous_payload jsonb := case when tg_op = 'UPDATE' then to_jsonb(old) else '{}'::jsonb end;
  v_empresa text;
  v_obra text;
  v_actor record;
  v_id text;
  v_modulo text := coalesce(tg_argv[0], tg_table_name);
  v_categoria text := coalesce(tg_argv[1], 'operacion');
  v_action text;
  v_changed text[];
begin
  v_empresa := coalesce(payload->>'empresa', payload->>'empresa_mandante', payload->>'empresa_contratista', payload->>'actor_empresa');
  if v_empresa is null or btrim(v_empresa) = '' then
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  v_obra := coalesce(payload->>'obra_nombre', payload->>'obra', payload->>'proyecto_nombre');
  v_id := coalesce(payload->>'id', payload->>'codigo', payload->>'folio');
  v_action := case tg_op when 'INSERT' then 'creado' when 'UPDATE' then 'actualizado' else 'eliminado' end;
  select u.usuario, u.nombre, coalesce(u.rol_base, u.rol) as rol, u.empresa into v_actor
  from public.usuarios u where u.auth_user_id = (select auth.uid()) limit 1;
  if tg_op = 'UPDATE' then
    select array_agg(k order by k) into v_changed from jsonb_object_keys(payload) k
    where payload->k is distinct from previous_payload->k
      and k not in ('updated_at','contrasena','token','clave','api_key','respuesta','pregunta','contenido','archivo_base64','logo_base64');
  end if;
  insert into public.auditoria_plataforma (
    empresa, obra_nombre, modulo, categoria, accion, descripcion, entidad_tipo, entidad_id,
    actor_auth_user_id, actor_usuario, actor_nombre, actor_rol, actor_empresa, origen,
    resultado, nivel, metadatos, source_table, source_id, created_at
  ) values (
    v_empresa, v_obra, v_modulo, v_categoria, v_action,
    initcap(replace(tg_table_name, '_', ' ')) || ' ' || v_action, tg_table_name, v_id,
    (select auth.uid()), v_actor.usuario, coalesce(v_actor.nombre, payload->>'actor_nombre', payload->>'actor'),
    v_actor.rol, coalesce(v_actor.empresa, payload->>'actor_empresa', v_empresa),
    case when (select auth.uid()) is null then 'automatizacion' else 'plataforma' end,
    'exitoso', 'informativo',
    jsonb_strip_nulls(jsonb_build_object('campos_modificados', to_jsonb(v_changed), 'estado', coalesce(payload->>'estado', payload->>'estado_destino'))),
    tg_table_name, tg_op || ':' || coalesce(v_id, 'sin-id') || ':' || clock_timestamp()::text,
    coalesce((payload->>'created_at')::timestamptz, now())
  );
  if tg_op = 'DELETE' then return old; else return new; end if;
exception when others then
  if tg_op = 'DELETE' then return old; else return new; end if;
end;
$$;
revoke all on function private.registrar_auditoria_cambio() from public, anon, authenticated;

insert into public.auditoria_plataforma (empresa, modulo, categoria, accion, descripcion, entidad_tipo, entidad_id, actor_nombre, actor_empresa, origen, resultado, metadatos, source_table, source_id, created_at)
select empresa, 'facturacion', 'tributario', accion, detalle, 'dte_eventos', id::text, actor, empresa, 'plataforma',
       case when lower(coalesce(estado_destino,'')) in ('rechazado','error') then 'observado' else 'exitoso' end,
       jsonb_strip_nulls(jsonb_build_object('estado_origen',estado_origen,'estado_destino',estado_destino)), 'dte_eventos', id::text, created_at
from public.dte_eventos where created_at >= now() - interval '90 days' on conflict do nothing;

insert into public.auditoria_plataforma (empresa, modulo, categoria, accion, descripcion, entidad_tipo, entidad_id, actor_nombre, actor_empresa, origen, resultado, metadatos, source_table, source_id, created_at)
select empresa_mandante, 'mandante', 'contrato', accion, detalle, 'mandante_eventos', id::text, actor_nombre, coalesce(actor_empresa,empresa_mandante), 'plataforma', 'exitoso',
       jsonb_strip_nulls(jsonb_build_object('estado',estado_resultante,'actor_rut',actor_rut,'actor_cargo',actor_cargo)), 'mandante_eventos', id::text, created_at
from public.mandante_eventos where created_at >= now() - interval '90 days' on conflict do nothing;

insert into public.auditoria_plataforma (empresa, obra_nombre, modulo, categoria, accion, descripcion, entidad_tipo, entidad_id, actor_nombre, actor_empresa, origen, resultado, metadatos, source_table, source_id, created_at)
select empresa, obra_nombre, 'clientes', 'portal', accion, detalle, 'clientes_portal_eventos', id::text, actor, empresa, 'portal_externo', 'exitoso', '{}'::jsonb, 'clientes_portal_eventos', id::text, created_at
from public.clientes_portal_eventos where created_at >= now() - interval '90 days' on conflict do nothing;

insert into public.auditoria_plataforma (empresa, modulo, categoria, accion, descripcion, entidad_tipo, entidad_id, actor_auth_user_id, actor_nombre, actor_empresa, origen, resultado, metadatos, source_table, source_id, created_at)
select empresa, 'colaboracion', 'contrato', accion, detalle, 'contratos_colaborativos_eventos', id::text, actor_auth_id, actor_nombre, empresa, 'plataforma', 'exitoso',
       jsonb_strip_nulls(jsonb_build_object('estado',estado_resultante)), 'contratos_colaborativos_eventos', id::text, created_at
from public.contratos_colaborativos_eventos where created_at >= now() - interval '90 days' on conflict do nothing;
