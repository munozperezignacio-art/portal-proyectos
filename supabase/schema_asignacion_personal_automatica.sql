-- Registro manual = autorización del cargo diario. QR y conflictos conservan revisión.
create table public.rrhh_reglas_sin_asistencia (
  id bigint generated always as identity primary key,
  empresa text not null,
  trabajador_id integer not null references public.maestro_personal(id),
  centro_gestion_id integer not null references public.facturacion_centros_gestion(id),
  fecha_desde date not null, fecha_hasta date,
  dias_semana integer[] not null default array[1,2,3,4,5],
  hora_cierre time not null default '20:00', activa boolean not null default true,
  autorizado_por uuid not null, actualizado_en timestamptz not null default now(),
  historial jsonb not null default '[]',
  unique(empresa,trabajador_id),
  check(fecha_hasta is null or fecha_hasta>=fecha_desde),
  check(cardinality(dias_semana) between 1 and 7 and dias_semana <@ array[1,2,3,4,5,6,7])
);
create index rrhh_reglas_centro_idx on public.rrhh_reglas_sin_asistencia(centro_gestion_id);
create index rrhh_reglas_trabajador_idx on public.rrhh_reglas_sin_asistencia(trabajador_id);
alter table public.rrhh_reglas_sin_asistencia enable row level security;
revoke all on public.rrhh_reglas_sin_asistencia from public,anon,authenticated;
grant select on public.rrhh_reglas_sin_asistencia to authenticated;
create policy reglas_sin_asistencia_lectura on public.rrhh_reglas_sin_asistencia
  for select to authenticated using(private.rrhh_imputaciones_permiso(empresa,'ver'));
alter table public.rrhh_imputaciones_diarias add column asignacion_automatica boolean not null default false;

-- Interna: reutiliza las referencias YA aprobadas, sin ampliar su vigencia legal.
-- Solo la invocan el trigger autorizado de asistencia y las reglas autorizadas.
create function private.rrhh_costeo_para_registro(p_empresa text,p_periodo text,p_actor uuid)
returns void language plpgsql security definer set search_path='' as $$
declare anterior public.rrhh_costeo_parametros; reglas jsonb;
begin
  if p_actor is null or not exists(select 1 from public.rrhh_costeo_automatico_empresas where empresa=p_empresa)
    or exists(select 1 from public.rrhh_costeo_parametros where empresa=p_empresa and periodo=p_periodo) then return; end if;
  select * into anterior from public.rrhh_costeo_parametros where empresa=p_empresa and periodo<p_periodo order by periodo desc limit 1;
  if anterior.origen='Manual' then
    insert into public.rrhh_costeo_parametros(empresa,periodo,horas_semanales,tope_gratificacion_mensual,cargas_empleador_pct,factor_hora_extra,origen,heredado_de,reglas,actualizado_por)
    values(p_empresa,p_periodo,anterior.horas_semanales,anterior.tope_gratificacion_mensual,anterior.cargas_empleador_pct,anterior.factor_hora_extra,'Manual',anterior.periodo,anterior.reglas,p_actor)
    on conflict do nothing;return;
  end if;
  reglas:=private.rrhh_costeo_referencia(p_periodo);
  if reglas is null then return; end if;
  insert into public.rrhh_costeo_parametros(empresa,periodo,horas_semanales,tope_gratificacion_mensual,cargas_empleador_pct,factor_hora_extra,origen,reglas,actualizado_por)
  values(p_empresa,p_periodo,(reglas->>'horas_semanales')::numeric,round((reglas->>'ingreso_minimo')::numeric*4.75/12,2),
    (reglas->>'aporte_previsional_pct')::numeric+(reglas->>'afc_indefinido_pct')::numeric+(reglas->>'accidentes_basica_pct')::numeric+(reglas->>'sanna_pct')::numeric,
    (reglas->>'factor_hora_extra')::numeric,'Automático',reglas,p_actor) on conflict do nothing;
end; $$;
revoke all on function private.rrhh_costeo_para_registro(text,text,uuid) from public,anon,authenticated;

create function private.rrhh_sincronizar_cargo_dia(p_empresa text,p_trabajador integer,p_fecha date)
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
    and extract(isodow from p_fecha)::integer=any(regla.dias_semana)
    and (p_fecha<hoy or (now() at time zone 'America/Santiago')::time>=regla.hora_cierre) then
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
  costo:=private.rrhh_calcular_costo_dia(r.id,r.haber_imponible,r.haber_no_imponible,case when r.asignacion_automatica or automatico then null else r.horas_extra_aprobadas end);
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

-- Un único trigger procesa la clave antigua y la nueva, también al borrar o mover
-- un marcaje. Evita el orden ambiguo entre los dos triggers anteriores.
drop trigger rrhh_invalida_imputacion on public.asistencia_personal;
drop trigger rrhh_propone_costo on public.asistencia_personal;
create function private.rrhh_actualizar_cargo_asistencia() returns trigger
language plpgsql security definer set search_path='' as $$
declare v record; trabajador record;
begin
  for v in select distinct x->>'empresa' empresa,(x->>'fecha_marcacion')::date fecha,coalesce(x->>'rut_normalizado',x->>'rut') rut
    from jsonb_array_elements(case when TG_OP='INSERT' then jsonb_build_array(to_jsonb(new)) when TG_OP='DELETE' then jsonb_build_array(to_jsonb(old)) else jsonb_build_array(to_jsonb(old),to_jsonb(new)) end) x
    order by 1,2,3 loop
    for trabajador in select id from public.maestro_personal p where p.empresa=v.empresa and coalesce(v.rut,'')<>''
      and upper(regexp_replace(p.rut,'[^0-9kK]','','g'))=upper(regexp_replace(v.rut,'[^0-9kK]','','g')) loop
      perform private.rrhh_sincronizar_cargo_dia(v.empresa,trabajador.id,v.fecha);
    end loop;
  end loop;
  return null;
end; $$;
revoke all on function private.rrhh_actualizar_cargo_asistencia() from public,anon,authenticated;
create trigger rrhh_actualiza_cargo after insert or update or delete on public.asistencia_personal
for each row execute function private.rrhh_actualizar_cargo_asistencia();

create or replace function private.rrhh_preparar_destinos(p_empresa text,p_periodo text)
returns integer language plpgsql security definer set search_path='' as $$
declare d record; total integer:=0; v_inicio date; v_fin date;
begin
  if not (private.rrhh_imputaciones_permiso(p_empresa,'editar') or private.rrhh_imputaciones_permiso(p_empresa,'aprobar')) then raise exception 'Sin permiso para preparar imputaciones'; end if;
  if p_periodo !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then raise exception 'Período inválido'; end if;
  v_inicio:=(p_periodo||'-01')::date;v_fin:=least((v_inicio+interval '1 month - 1 day')::date,(now() at time zone 'America/Santiago')::date);
  perform pg_advisory_xact_lock(hashtextextended(p_empresa||p_periodo,0));
  for d in select p.id,g::date fecha from public.maestro_personal p cross join generate_series(v_inicio,v_fin,interval '1 day') g
    where p.empresa=p_empresa and g::date>=coalesce(p.fecha_inicio_contrato,v_inicio) and g::date<=coalesce(p.fecha_vencimiento_contrato,v_fin)
      and (extract(isodow from g)<=5 or exists(select 1 from public.asistencia_personal a where a.empresa=p_empresa and a.fecha_marcacion=g::date and coalesce(p.rut,'')<>'' and upper(regexp_replace(coalesce(a.rut_normalizado,a.rut,''),'[^0-9kK]','','g'))=upper(regexp_replace(p.rut,'[^0-9kK]','','g')))
        or exists(select 1 from public.rrhh_reglas_sin_asistencia r where r.empresa=p_empresa and r.trabajador_id=p.id and r.activa and extract(isodow from g)::integer=any(r.dias_semana))) order by g,p.id loop
    perform private.rrhh_sincronizar_cargo_dia(p_empresa,d.id,d.fecha);total:=total+1;
  end loop;
  return total;
end; $$;
-- El motor anterior anulaba los costos recién devengados; ahora hay una sola ruta.
create or replace function private.rrhh_preparar_imputaciones(p_empresa text,p_periodo text)
returns integer language plpgsql security definer set search_path='' as $$
begin
  if not (private.rrhh_imputaciones_permiso(p_empresa,'editar') or private.rrhh_imputaciones_permiso(p_empresa,'aprobar')) then raise exception 'Sin permiso para preparar imputaciones'; end if;
  perform private.rrhh_completar_costeo(p_empresa,p_periodo);
  return private.rrhh_preparar_destinos(p_empresa,p_periodo);
end; $$;

create function private.rrhh_guardar_regla_sin_asistencia(p_empresa text,p_trabajador integer,p_centro integer,p_desde date,p_hasta date,p_dias integer[],p_hora time,p_activa boolean)
returns bigint language plpgsql security definer set search_path='' as $$
declare regla_id bigint;
begin
  if not private.rrhh_imputaciones_permiso(p_empresa,'aprobar') then raise exception 'Sin permiso para autorizar reglas de costos'; end if;
  if not exists(select 1 from public.maestro_personal where id=p_trabajador and empresa=p_empresa and coalesce(rut,'')<>'')
    or not exists(select 1 from public.facturacion_centros_gestion where id=p_centro and empresa=p_empresa and activo) then raise exception 'Trabajador o centro inválido para esta empresa'; end if;
  if (select count(*) from public.obras where empresa=p_empresa and centro_gestion_id=p_centro)>1 then raise exception 'El centro está vinculado a varias obras'; end if;
  insert into public.rrhh_reglas_sin_asistencia as r(empresa,trabajador_id,centro_gestion_id,fecha_desde,fecha_hasta,dias_semana,hora_cierre,activa,autorizado_por,historial)
    values(p_empresa,p_trabajador,p_centro,p_desde,p_hasta,p_dias,p_hora,p_activa,auth.uid(),jsonb_build_array(jsonb_build_object('accion','Regla autorizada','actor',auth.uid(),'fecha',now(),'centro',p_centro)))
  on conflict(empresa,trabajador_id) do update set centro_gestion_id=excluded.centro_gestion_id,fecha_desde=excluded.fecha_desde,fecha_hasta=excluded.fecha_hasta,
    dias_semana=excluded.dias_semana,hora_cierre=excluded.hora_cierre,activa=excluded.activa,autorizado_por=auth.uid(),actualizado_en=now(),
    historial=r.historial||jsonb_build_array(jsonb_build_object('accion','Regla actualizada','actor',auth.uid(),'fecha',now(),'centro',p_centro,'centro_anterior',r.centro_gestion_id)) returning id into regla_id;
  return regla_id;
end; $$;
revoke all on function private.rrhh_guardar_regla_sin_asistencia(text,integer,integer,date,date,integer[],time,boolean) from public,anon;
grant execute on function private.rrhh_guardar_regla_sin_asistencia(text,integer,integer,date,date,integer[],time,boolean) to authenticated;
create function public.guardar_regla_sin_asistencia(p_empresa text,p_trabajador integer,p_centro integer,p_desde date,p_hasta date,p_dias integer[],p_hora time,p_activa boolean)
returns bigint language sql security invoker set search_path='' as $$select private.rrhh_guardar_regla_sin_asistencia(p_empresa,p_trabajador,p_centro,p_desde,p_hasta,p_dias,p_hora,p_activa);$$;
revoke all on function public.guardar_regla_sin_asistencia(text,integer,integer,date,date,integer[],time,boolean) from public,anon;
grant execute on function public.guardar_regla_sin_asistencia(text,integer,integer,date,date,integer[],time,boolean) to authenticated;

-- Ejecución interna sin navegador. Revisa 31 días para recuperar cierres omitidos.
-- Las correcciones humanas dejan de ser automáticas hasta que cambie la evidencia.
alter function private.rrhh_aprobar_imputaciones(text,jsonb) rename to rrhh_aprobar_costos_preauto;
revoke all on function private.rrhh_aprobar_costos_preauto(text,jsonb) from public,anon,authenticated;
create function private.rrhh_aprobar_imputaciones(p_empresa text,p_decisiones jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare total integer;
begin
  total:=private.rrhh_aprobar_costos_preauto(p_empresa,p_decisiones);
  update public.rrhh_imputaciones_diarias t set asignacion_automatica=false
    where t.empresa=p_empresa and t.id in(select (d->>'id')::bigint from jsonb_array_elements(p_decisiones) d);
  return total;
end; $$;
revoke all on function private.rrhh_aprobar_imputaciones(text,jsonb) from public,anon;
grant execute on function private.rrhh_aprobar_imputaciones(text,jsonb) to authenticated;

create function private.rrhh_aplicar_reglas_diarias() returns integer
language plpgsql security definer set search_path='' as $$
declare r record; total integer:=0; hoy date:=(now() at time zone 'America/Santiago')::date;
begin
  for r in select regla.empresa,regla.trabajador_id,g::date fecha from public.rrhh_reglas_sin_asistencia regla
    cross join lateral generate_series(greatest(regla.fecha_desde,hoy-31),least(coalesce(regla.fecha_hasta,hoy),hoy),interval '1 day') g
    where regla.activa and extract(isodow from g)::integer=any(regla.dias_semana) order by regla.empresa,g,regla.trabajador_id loop
    perform private.rrhh_sincronizar_cargo_dia(r.empresa,r.trabajador_id,r.fecha);total:=total+1;
  end loop;
  return total;
end; $$;
revoke all on function private.rrhh_aplicar_reglas_diarias() from public,anon,authenticated;
do $$
declare v_job bigint;
begin
  select jobid into v_job from cron.job where jobname='rrhh-reglas-sin-asistencia' and username=current_user;
  if found then
    perform cron.alter_job(v_job,schedule:='*/15 * * * *',command:='select private.rrhh_aplicar_reglas_diarias()',active:=true);
  else
    perform cron.schedule('rrhh-reglas-sin-asistencia','*/15 * * * *','select private.rrhh_aplicar_reglas_diarias()');
  end if;
end; $$;
notify pgrst,'reload schema';
