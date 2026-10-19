-- La ficha conserva la identidad de la obra y actualiza sus referencias operativas.
-- Los documentos emitidos y las instantáneas de auditoría no se reescriben.
create or replace function public.sync_factura_estado_pago()
returns trigger language plpgsql set search_path='public' as $$
begin
  -- Un cambio de etiqueta no es un nuevo pago (ni debe cambiar su fecha).
  if TG_OP='UPDATE' and (to_jsonb(NEW)-'obra_nombre'-'updated_at') is not distinct from
    (to_jsonb(OLD)-'obra_nombre'-'updated_at') then return NEW; end if;
  if NEW.direccion_flujo='Venta' and NEW.estado_pago_id is not null then
    update public.estados_pago_obra set factura_documento_id=NEW.id,factura_numero=NEW.folio::text,
      factura_fecha=NEW.fecha_emision,factura_monto=NEW.monto_total,
      factura_estado=case when NEW.estado_pago='Pagada' then 'Pagada' when NEW.estado_sii='Rechazado' then 'Rechazada'
        when NEW.estado_sii='Aceptado' then 'Emitida' else 'Pendiente de emisión' end,
      factura_fecha_pago=case when NEW.estado_pago='Pagada' then CURRENT_DATE else factura_fecha_pago end,
      factura_actualizada_en=now() where id=NEW.estado_pago_id;
  end if;
  return NEW;
end; $$;

create function private.renombrar_referencias_obra(p_empresa text,p_id integer,p_anterior text,p_nuevo text)
returns void language plpgsql security invoker set search_path='' as $$
declare tabla text; config jsonb;
begin
  -- Lista explícita de referencias activas. Las ocho FK compuestas ya propagan el nombre.
  foreach tabla in array array['gastos_rendicion_items','maquinaria_fallas','clientes_portal_obras',
    'clientes_portal_eventos','maquinaria_mantenciones','dte_documentos_operacion','subcontrato_ep_requisitos',
    'maquinaria_uso_diario','obra_presupuestos','notificaciones_reglas','last_planner_recursos',
    'condiciones_pago_obra','libro_obra_digital','estados_pago_obra','facturacion_documentos','costos_reales_obra',
    'bodega_bodegas','rrhh_proyecciones_dotacion','subcontrato_avances','subcontrato_asistencia',
    'subcontrato_estados_pago','rrhh_asignaciones_personal','ia_consumos','bodega_movimientos',
    'acreditaciones_revisiones_ia','compras_conciliaciones','copiloto_obra_consultas','calidad_no_conformidades',
    'predicciones_obra_historial','acreditaciones_resumen_obra','bitacora_eventos_obra','calidad_pac','calidad_rdi',
    'calidad_recepciones_partidas','prevencion_procedimientos','obra_cuadrillas','obra_liquidaciones',
    'subcontrato_contratos','acreditaciones_internas','arriendos_maquinaria'] loop
    execute format('update public.%I set obra_nombre=$1 where empresa=$2 and obra_nombre=$3',tabla)
      using p_nuevo,p_empresa,p_anterior;
  end loop;
  update public.prevencion_respuestas set proyecto_nombre=p_nuevo where obra_id=p_id and proyecto_nombre=p_anterior;
  update public.colaboraciones_obra set obra_nombre=p_nuevo where empresa_contratista=p_empresa and obra_nombre=p_anterior;
  update public.rrhh_nomina_items i set obra_nombre=p_nuevo from public.rrhh_nominas_mensuales n
    where i.nomina_id=n.id and n.empresa=p_empresa and i.obra_nombre=p_anterior;
  update public.maquinaria_reservas set obra_destino=p_nuevo where empresa=p_empresa and obra_destino=p_anterior;
  update public.maquinaria_arriendos set obra_cliente=p_nuevo where empresa=p_empresa and obra_cliente=p_anterior;
  update public.acreditaciones_proveedores set obra_asociada=p_nuevo where empresa=p_empresa and obra_asociada=p_anterior;
  update public.acreditaciones_subcontratos set obra_asociada=p_nuevo where empresa=p_empresa and obra_asociada=p_anterior;
  update public.contratos_colaborativos set obra_contratista_nombre=p_nuevo where obra_contratista_id=p_id;
  update public.contratos_colaborativos set obra_colaboradora_nombre=p_nuevo where obra_colaboradora_id=p_id;
  update public.mandante_contratos set obra_contratista_nombre=p_nuevo where obra_contratista_id=p_id;
  update public.facturacion_centros_gestion c set nombre=p_nuevo from public.obras o
    where o.id=p_id and c.id=o.centro_gestion_id and c.empresa=p_empresa and c.nombre=p_anterior;
  update public.rrhh_centros_trabajo set nombre=p_nuevo where empresa=p_empresa and obra_id=p_id and nombre=p_anterior;
  update public.rrhh_asignaciones_personal set destino_nombre=p_nuevo where empresa=p_empresa and destino_nombre=p_anterior;
  update public.usuarios u set obras=(select string_agg(case when lower(btrim(v))=lower(p_anterior)
    then p_nuevo else btrim(v) end,',' order by posicion) from unnest(string_to_array(u.obras,',')) with ordinality t(v,posicion))
    where u.empresa=p_empresa and exists(select 1 from unnest(string_to_array(u.obras,',')) v where lower(btrim(v))=lower(p_anterior));
  update public.config_correos set filtro=p_nuevo where empresa=p_empresa and filtro=p_anterior
    and tipo<>'Informe Mensual Cumplimiento';
  -- Mantener los destinatarios anteriores; los contextos nuevos utilizan el ID estable.
  select correos_contextuales into config from public.config_empresa where empresa=p_empresa for update;
  if config ? ('avances_obra:'||p_anterior) then
    if config ? ('avances_obra:'||p_nuevo) and config->('avances_obra:'||p_nuevo) is distinct from config->('avances_obra:'||p_anterior) then
      raise exception 'Existen configuraciones de correo distintas para ese nombre. Revísalas antes de renombrar';
    end if;
    update public.config_empresa set correos_contextuales=(config-('avances_obra:'||p_anterior))||
      jsonb_build_object('avances_obra:'||p_nuevo,config->('avances_obra:'||p_anterior)) where empresa=p_empresa;
  end if;
  update public.notificaciones_reglas r set condiciones=jsonb_set(r.condiciones,'{obras_seleccionadas}',
    (select coalesce(jsonb_agg(case when v=to_jsonb(p_anterior) then to_jsonb(p_nuevo) else v end order by n),'[]'::jsonb)
     from jsonb_array_elements(r.condiciones->'obras_seleccionadas') with ordinality t(v,n)))
    where empresa=p_empresa and jsonb_typeof(condiciones->'obras_seleccionadas')='array' and condiciones->'obras_seleccionadas' @> jsonb_build_array(p_anterior);
  update public.informes_programaciones r set obras=(select jsonb_agg(case when v=to_jsonb(p_anterior) then to_jsonb(p_nuevo) else v end order by n)
    from jsonb_array_elements(r.obras) with ordinality t(v,n))
    where empresa=p_empresa and jsonb_typeof(obras)='array' and obras @> jsonb_build_array(p_anterior);
end; $$;
revoke all on function private.renombrar_referencias_obra(text,integer,text,text) from public,anon,authenticated;

create function private.actualizar_ficha_obra(p_empresa text,p_obra integer,p_nombre_anterior text,p_datos jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare original public.obras; nueva public.obras; datos jsonb; v_nombre text; permitido boolean;
begin
  if auth.uid() is null or not private.obraxis_actor_can_access_company(p_empresa) then
    raise exception 'Sin acceso a esta empresa' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('ficha_obra:'||p_empresa,0));
  select * into original from public.obras where id=p_obra and empresa=p_empresa for update;
  if not found then raise exception 'Proyecto no disponible en esta empresa'; end if;
  select true into permitido from public.usuarios u left join public.roles r on r.empresa=u.empresa and r.nombre=u.rol
  cross join lateral(select coalesce(r.permisos,'{}'::jsonb)||coalesce(u.permisos,'{}'::jsonb) permisos,
    lower(coalesce(u.rol_base,r.rol_base,u.rol,'')) rol) e
  where u.auth_user_id=auth.uid() and not coalesce(r.archivado,false)
    and (u.empresa=p_empresa or (u.empresa='Obraxis' and e.rol in ('superusuario','superadmin')))
    and case when e.rol in ('superusuario','superadmin') then true
      when e.permisos ? 'obras.ficha.editar' then e.permisos->>'obras.ficha.editar'='true'
      else e.rol like '%admin%' or e.rol like '%gerencia%' or e.rol like '%jefe%' or e.rol like '%profesional%' or e.rol like '%creador%' end
    and (e.rol in ('superusuario','superadmin') or exists(select 1 from unnest(string_to_array(u.obras,',')) v
      where lower(btrim(v)) in ('todas',lower(original.nombre)))) limit 1;
  if not coalesce(permitido,false) then raise exception 'No tienes permiso para editar la ficha de este proyecto' using errcode='42501'; end if;
  if original.nombre is distinct from p_nombre_anterior then raise exception 'El proyecto cambió desde que abriste la ficha. Actualiza la página y vuelve a intentarlo'; end if;
  if jsonb_typeof(p_datos) is distinct from 'object' then raise exception 'Ficha inválida'; end if;
  v_nombre:=regexp_replace(btrim(coalesce(p_datos->>'nombre',original.nombre)),'\s+',' ','g');
  if length(v_nombre) not between 1 and 150 or v_nombre~'[,[:cntrl:]]' or lower(v_nombre) in ('todas','todos','*') then
    raise exception 'Ingresa un nombre de 1 a 150 caracteres, sin comas ni nombres reservados'; end if;
  if exists(select 1 from public.obras where empresa=p_empresa and id<>p_obra and lower(btrim(obras.nombre))=lower(v_nombre)) then
    raise exception 'Ya existe otro proyecto con ese nombre en la empresa'; end if;
  select coalesce(jsonb_object_agg(key,value),'{}'::jsonb) into datos from jsonb_each(p_datos)
    where key=any(array['tipo','cliente','cliente_email','cliente_telefono','ubicacion','admin_contrato',
      'oficina_tecnica','prevencionista','estado','fecha_termino_real','motivo_cierre']);
  nueva:=jsonb_populate_record(original,datos||jsonb_build_object('nombre',v_nombre));
  if nueva.estado in ('Terminada','Archivada') and (nueva.fecha_termino_real is null or coalesce(btrim(nueva.motivo_cierre),'')='') then
    raise exception 'Para cerrar registra la fecha real de término y el motivo'; end if;
  update public.obras set nombre=nueva.nombre,tipo=nueva.tipo,cliente=nueva.cliente,cliente_email=nueva.cliente_email,
    cliente_telefono=nueva.cliente_telefono,ubicacion=nueva.ubicacion,admin_contrato=nueva.admin_contrato,
    oficina_tecnica=nueva.oficina_tecnica,prevencionista=nueva.prevencionista,estado=nueva.estado,
    fecha_termino_real=nueva.fecha_termino_real,motivo_cierre=nueva.motivo_cierre where id=p_obra and empresa=p_empresa returning * into nueva;
  if original.nombre<>nueva.nombre then perform private.renombrar_referencias_obra(p_empresa,p_obra,original.nombre,nueva.nombre); end if;
  return to_jsonb(nueva);
end; $$;
revoke all on function private.actualizar_ficha_obra(text,integer,text,jsonb) from public,anon;
grant execute on function private.actualizar_ficha_obra(text,integer,text,jsonb) to authenticated;
create function public.actualizar_ficha_obra(p_empresa text,p_obra integer,p_nombre_anterior text,p_datos jsonb)
returns jsonb language sql security invoker set search_path='' as $$select private.actualizar_ficha_obra(p_empresa,p_obra,p_nombre_anterior,p_datos);$$;
revoke all on function public.actualizar_ficha_obra(text,integer,text,jsonb) from public,anon;
grant execute on function public.actualizar_ficha_obra(text,integer,text,jsonb) to authenticated;
notify pgrst,'reload schema';
