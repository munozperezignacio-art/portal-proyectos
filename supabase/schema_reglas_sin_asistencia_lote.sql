-- Reglas múltiples sin hora de cierre; HE autorizadas por día sin marcaje.
alter table public.rrhh_reglas_sin_asistencia
  add column horas_extra_diarias numeric(5,2) not null default 0 check(horas_extra_diarias between 0 and 24);
alter table public.rrhh_reglas_sin_asistencia alter column hora_cierre set default '00:00';
comment on column public.rrhh_reglas_sin_asistencia.hora_cierre is 'Legado sin efecto: no se espera cierre para aplicar una regla.';
comment on column public.rrhh_reglas_sin_asistencia.horas_extra_diarias is 'HE de costo autorizadas por día sin marcaje. 0 = sin HE. No genera asistencia.';

create or replace function private.rrhh_sincronizar_cargo_dia(p_empresa text,p_trabajador integer,p_fecha date)
returns void language plpgsql security definer set search_path='' as $$
declare p public.maestro_personal; r public.rrhh_imputaciones_diarias; regla public.rrhh_reglas_sin_asistencia;
  marcas record; v_evidencia jsonb; costo jsonb; centro integer; v_origen text; actor uuid;
  automatico boolean:=false; vigente boolean; conciliada boolean; misma boolean;
  hoy date:=(now() at time zone 'America/Santiago')::date;
begin
  if p_fecha is null or p_fecha>hoy then return; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_empresa||to_char(p_fecha,'YYYY-MM'),0));
  select * into p from public.maestro_personal where id=p_trabajador and empresa=p_empresa;
  if not found then return; end if;
  vigente:=p_fecha>=coalesce(p.fecha_inicio_contrato,p_fecha) and p_fecha<=coalesce(p.fecha_vencimiento_contrato,p_fecha);
  select count(*) total,count(*) filter(where upper(coalesce(a.asistencia,''))='PRESENTE') presentes,
    count(*) filter(where upper(coalesce(a.asistencia,''))='PRESENTE' and not coalesce(a.verificado_qr,false)) manuales,
    count(distinct a.obra_id) filter(where upper(coalesce(a.asistencia,''))='PRESENTE') obras,
    min(o.centro_gestion_id) filter(where upper(coalesce(a.asistencia,''))='PRESENTE') centro,
    coalesce(jsonb_agg(jsonb_build_array(a.id,a.obra_id,a.asistencia,o.centro_gestion_id,a.horas_extras_auto,a.horas_extras_manual,a.verificado_qr) order by a.id),'[]') marcas
  into marcas from public.asistencia_personal a left join public.obras o on o.id=a.obra_id and o.empresa=p_empresa
  where a.empresa=p_empresa and a.fecha_marcacion=p_fecha and coalesce(p.rut,'')<>''
    and upper(regexp_replace(coalesce(a.rut_normalizado,a.rut,''),'[^0-9kK]','','g'))=upper(regexp_replace(p.rut,'[^0-9kK]','','g'));
  select * into regla from public.rrhh_reglas_sin_asistencia where empresa=p_empresa and trabajador_id=p.id;
  centro:=case when marcas.obras=1 then marcas.centro when marcas.total=0 then p.centro_gestion_defecto_id else null end;
  v_origen:=case when marcas.obras>1 then 'Múltiples obras' when marcas.obras=1 then 'Asistencia' else 'Sin asistencia' end;
  actor:=auth.uid();
  if marcas.total=1 and marcas.presentes=1 and marcas.manuales=1 then automatico:=true; end if;
  if marcas.total=0 and regla.activa and vigente and p_fecha>=regla.fecha_desde and p_fecha<=coalesce(regla.fecha_hasta,p_fecha)
    and extract(isodow from p_fecha)::integer=any(regla.dias_semana) then
    centro:=regla.centro_gestion_id;actor:=regla.autorizado_por;automatico:=true;v_origen:='Sin asistencia';
  end if;
  v_evidencia:=jsonb_build_object('marcas',marcas.marcas,'defecto',p.centro_gestion_defecto_id,
    'regla',case when marcas.total=0 then to_jsonb(regla)-'historial' else null end);
  insert into public.rrhh_imputaciones_diarias(empresa,trabajador_id,fecha,origen,evidencia,centro_propuesto_id)
    values(p_empresa,p.id,p_fecha,v_origen,v_evidencia,centro) on conflict(empresa,trabajador_id,fecha) do nothing;
  select * into r from public.rrhh_imputaciones_diarias where empresa=p_empresa and trabajador_id=p.id and fecha=p_fecha for update;
  -- Editar/desactivar una regla no borra cargos históricos ya autorizados. Una
  -- asistencia tardía sí los sustituye, porque entonces marcas.total es mayor a 0.
  if r.estado='Aprobada' and r.asignacion_automatica and r.origen='Sin asistencia' and p_fecha<hoy and marcas.total=0
    and r.evidencia->'regla'->>'id' is not null
    and r.evidencia->'regla' is distinct from v_evidencia->'regla' then return; end if;
  if actor is null and r.asignacion_automatica and marcas.total>0 then actor:=r.aprobado_por; end if;
  perform private.rrhh_costeo_para_registro(p_empresa,to_char(p_fecha,'YYYY-MM'),actor);
  costo:=private.rrhh_calcular_costo_dia(r.id,r.haber_imponible,r.haber_no_imponible,case when marcas.total=0 and automatico then regla.horas_extra_diarias when r.asignacion_automatica or automatico then null else r.horas_extra_aprobadas end);
  conciliada:=exists(select 1 from public.rrhh_costos_centros_aprobados c join public.rrhh_nomina_items i on i.id=c.nomina_item_id
    join public.rrhh_nominas_mensuales n on n.id=c.nomina_id where c.empresa=p_empresa and i.trabajador_id=p.id and n.periodo=to_char(p_fecha,'YYYY-MM') and n.estado in ('Cerrada','Pagada'));
  misma:=r.evidencia=v_evidencia and r.costo_evidencia=costo->'evidencia';
  -- Respeta la reasignación explícita mientras no cambie su evidencia. Una nómina
  -- conciliada no se recarga ni se sustituye silenciosamente por otra provisión.
  if r.estado='Aprobada' and misma and (not r.asignacion_automatica or conciliada) then return; end if;
  automatico:=automatico and vigente and actor is not null and not conciliada and coalesce((costo->>'listo')::boolean,false)
    and coalesce(p.rut,'')<>'' and (select count(*) from public.maestro_personal mp where mp.empresa=p_empresa
      and upper(regexp_replace(mp.rut,'[^0-9kK]','','g'))=upper(regexp_replace(p.rut,'[^0-9kK]','','g')))=1
    and exists(select 1 from public.facturacion_centros_gestion c where c.id=centro and c.empresa=p_empresa and c.activo)
    and (select count(*) from public.obras where empresa=p_empresa and centro_gestion_id=centro)<=1;
  if misma and r.asignacion_automatica=automatico and r.centro_propuesto_id is not distinct from centro
    and r.costo_total is not distinct from (case when automatico then (costo->>'total')::numeric else null end) then return; end if;
  update public.rrhh_imputaciones_diarias set origen=v_origen, evidencia=v_evidencia, centro_propuesto_id=centro,
    costo_detalle=costo,costo_evidencia=costo->'evidencia',costo_total=case when automatico then (costo->>'total')::numeric end,
    estado=case when automatico then 'Aprobada' else 'Pendiente' end,asignacion_automatica=automatico,
    centro_aprobado_id=case when automatico then centro end,aprobado_por=case when automatico then actor end,
    aprobado_en=case when automatico then now() end,
    horas_extra_aprobadas=case when automatico then (costo->>'horas_extra')::numeric else null end,
    historial=historial||jsonb_build_array(jsonb_build_object('accion',case when automatico and marcas.total=0 then 'Cargo automático por regla sin asistencia' when automatico then 'Cargo directo por asistencia manual' else 'Evidencia actualizada; revisar excepción' end,
      'fecha',now(),'actor',actor,'centro',centro,'centro_anterior',r.centro_aprobado_id,'regla_id',case when marcas.total=0 then regla.id end))
  where id=r.id;
end; $$;
revoke all on function private.rrhh_sincronizar_cargo_dia(text,integer,date) from public,anon,authenticated;

create function private.rrhh_guardar_reglas_lote(p_empresa text,p_trabajadores integer[],p_centro integer,p_desde date,p_hasta date,p_dias integer[],p_horas_extra numeric,p_activa boolean,p_reemplazar boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare trabajador integer; v_regla bigint; guardadas integer:=0; omitidas integer:=0; v_dias integer[]; v_fecha date;
  hoy date:=(now() at time zone 'America/Santiago')::date;
begin
  if not private.rrhh_imputaciones_permiso(p_empresa,'aprobar') then raise exception 'Sin permiso para autorizar reglas de costos' using errcode='42501'; end if;
  if p_trabajadores is null or cardinality(p_trabajadores) not between 1 and 500 or array_position(p_trabajadores,null) is not null then raise exception 'Selecciona entre 1 y 500 trabajadores'; end if;
  if cardinality(p_trabajadores)<>(select count(distinct id) from unnest(p_trabajadores) id) then raise exception 'Hay trabajadores repetidos'; end if;
  if p_desde is null or (p_hasta is not null and p_hasta<p_desde) then raise exception 'Vigencia inválida'; end if;
  if p_dias is null or cardinality(p_dias) not between 1 and 7 or array_position(p_dias,null) is not null or not p_dias <@ array[1,2,3,4,5,6,7] then raise exception 'Selecciona días válidos'; end if;
  if p_horas_extra is null or p_horas_extra not between 0 and 24 or p_horas_extra<>round(p_horas_extra,2) then raise exception 'HE diarias inválidas: de 0 a 24, hasta dos decimales'; end if;
  if p_activa is null or p_reemplazar is null then raise exception 'Indica el estado y si se reemplazan reglas'; end if;
  if exists(select 1 from unnest(p_trabajadores) as elegido(trabajador_id) where not exists(select 1 from public.maestro_personal p where p.id=elegido.trabajador_id and p.empresa=p_empresa and coalesce(p.rut,'')<>'')) then raise exception 'Hay trabajadores sin RUT o ajenos a esta empresa'; end if;
  if not exists(select 1 from public.facturacion_centros_gestion where id=p_centro and empresa=p_empresa and activo)
    or (select count(*) from public.obras where empresa=p_empresa and centro_gestion_id=p_centro)>1 then raise exception 'Centro de gestión inválido o vinculado a varias obras'; end if;
  select array_agg(distinct d order by d) into v_dias from unnest(p_dias) d;
  perform pg_advisory_xact_lock(hashtextextended('rrhh_reglas_lote:'||p_empresa,0));
  for trabajador in select id from unnest(p_trabajadores) id order by id loop
    if not p_reemplazar and exists(select 1 from public.rrhh_reglas_sin_asistencia where empresa=p_empresa and trabajador_id=trabajador) then
      omitidas:=omitidas+1;continue;
    end if;
    insert into public.rrhh_reglas_sin_asistencia as r(empresa,trabajador_id,centro_gestion_id,fecha_desde,fecha_hasta,dias_semana,hora_cierre,horas_extra_diarias,activa,autorizado_por,historial)
      values(p_empresa,trabajador,p_centro,p_desde,p_hasta,v_dias,'00:00',p_horas_extra,p_activa,auth.uid(),
        jsonb_build_array(jsonb_build_object('accion','Regla autorizada en lote','actor',auth.uid(),'fecha',now(),'centro',p_centro,'horas_extra_diarias',p_horas_extra)))
    on conflict(empresa,trabajador_id) do update set centro_gestion_id=excluded.centro_gestion_id,fecha_desde=excluded.fecha_desde,fecha_hasta=excluded.fecha_hasta,
      dias_semana=excluded.dias_semana,hora_cierre='00:00',horas_extra_diarias=excluded.horas_extra_diarias,activa=excluded.activa,autorizado_por=auth.uid(),actualizado_en=now(),
      historial=r.historial||jsonb_build_array(jsonb_build_object('accion','Regla actualizada en lote','actor',auth.uid(),'fecha',now(),'centro',p_centro,
        'centro_anterior',r.centro_gestion_id,'horas_extra_diarias',p_horas_extra,'horas_extra_anteriores',r.horas_extra_diarias))
    returning id into v_regla;
    guardadas:=guardadas+1;
    -- Revisión inmediata y acotada. Meses anteriores se preparan por período.
    for v_fecha in select g::date from public.maestro_personal p
      cross join lateral generate_series(greatest(p_desde,hoy-31,coalesce(p.fecha_inicio_contrato,p_desde)),
        least(coalesce(p_hasta,hoy),hoy,coalesce(p.fecha_vencimiento_contrato,hoy)),interval '1 day') g
      where p.id=trabajador and p.empresa=p_empresa and extract(isodow from g)::integer=any(v_dias) order by g loop
      perform private.rrhh_sincronizar_cargo_dia(p_empresa,trabajador,v_fecha);
    end loop;
  end loop;
  return jsonb_build_object('guardadas',guardadas,'omitidas',omitidas);
end; $$;
revoke all on function private.rrhh_guardar_reglas_lote(text,integer[],integer,date,date,integer[],numeric,boolean,boolean) from public,anon;
grant execute on function private.rrhh_guardar_reglas_lote(text,integer[],integer,date,date,integer[],numeric,boolean,boolean) to authenticated;

create function public.guardar_reglas_sin_asistencia_lote(p_empresa text,p_trabajadores integer[],p_centro integer,p_desde date,p_hasta date,p_dias integer[],p_horas_extra numeric default 0,p_activa boolean default true,p_reemplazar boolean default false)
returns jsonb language sql security invoker set search_path='' as $$
select private.rrhh_guardar_reglas_lote(p_empresa,p_trabajadores,p_centro,p_desde,p_hasta,p_dias,p_horas_extra,p_activa,p_reemplazar); $$;
revoke all on function public.guardar_reglas_sin_asistencia_lote(text,integer[],integer,date,date,integer[],numeric,boolean,boolean) from public,anon;
grant execute on function public.guardar_reglas_sin_asistencia_lote(text,integer[],integer,date,date,integer[],numeric,boolean,boolean) to authenticated;

-- Compatibilidad: la hora enviada por clientes anteriores ya no condiciona la regla.
create or replace function private.rrhh_guardar_regla_sin_asistencia(p_empresa text,p_trabajador integer,p_centro integer,p_desde date,p_hasta date,p_dias integer[],p_hora time,p_activa boolean)
returns bigint language plpgsql security definer set search_path='' as $$
declare v_id bigint;
begin
  perform private.rrhh_guardar_reglas_lote(p_empresa,array[p_trabajador],p_centro,p_desde,p_hasta,p_dias,0,p_activa,true);
  select id into v_id from public.rrhh_reglas_sin_asistencia where empresa=p_empresa and trabajador_id=p_trabajador;
  return v_id;
end; $$;
revoke all on function private.rrhh_guardar_regla_sin_asistencia(text,integer,integer,date,date,integer[],time,boolean) from public,anon;
grant execute on function private.rrhh_guardar_regla_sin_asistencia(text,integer,integer,date,date,integer[],time,boolean) to authenticated;
notify pgrst,'reload schema';


