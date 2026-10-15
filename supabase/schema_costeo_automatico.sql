-- Provisiones automáticas, versionadas y trazables. No aprueba cargos ni paga nóminas.
-- Referencias verificadas 2026-10-15. No extender vigencias sin verificar indicadores.
-- Activación gradual: únicamente EMINSG. Las demás empresas conservan su flujo.
create table public.rrhh_costeo_automatico_empresas (
  empresa text primary key,
  activado_en timestamptz not null default now()
);
alter table public.rrhh_costeo_automatico_empresas enable row level security;
revoke all on public.rrhh_costeo_automatico_empresas from public,anon,authenticated;
grant select on public.rrhh_costeo_automatico_empresas to authenticated;
create policy costeo_automatico_lectura on public.rrhh_costeo_automatico_empresas for select to authenticated
  using(private.rrhh_imputaciones_permiso(empresa,'ver'));
insert into public.rrhh_costeo_automatico_empresas(empresa) values('EMINSG');

alter table public.rrhh_costeo_parametros
  add column origen text not null default 'Manual' check(origen in ('Manual','Automático')),
  add column heredado_de text,
  add column reglas jsonb not null default '{}'::jsonb;
alter table public.maestro_personal add column horas_semanales numeric check(horas_semanales>0 and horas_semanales<=60);
comment on column public.maestro_personal.horas_semanales is 'Jornada contractual para valor hora. NULL usa referencia del período, no infiere contrato desde el horario de la obra.';

create function private.rrhh_costeo_referencia(p_periodo text) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
begin
  -- Cobertura deliberadamente acotada: IMM vigente desde mayo y aporte de agosto.
  if p_periodo !~ '^2026-(08|09|10|11|12)$' then return null; end if;
  return jsonb_build_object('version','2026-10-15','vigente_desde','2026-08','vigente_hasta','2026-12',
    'ingreso_minimo',553553,'horas_semanales',42,'factor_hora_extra',1.5,
    'aporte_previsional_pct',3.5,'afc_indefinido_pct',2.4,'afc_plazo_pct',3,
    'accidentes_basica_pct',0.9,'sanna_pct',0.03,
    'advertencia','Provisión referencial: no incluye la tasa adicional particular de mutualidad ni regímenes especiales. La nómina conciliada sustituye esta provisión.',
    'fuentes',jsonb_build_array('https://www.dt.gob.cl/portal/1628/w3-article-60141.html',
      'https://www.dt.gob.cl/portal/1626/w3-article-127092.html',
      'https://www.dt.gob.cl/portal/1626/w3-article-99034.html',
      'https://www.spensiones.cl/portal/institucional/594/w3-propertyvalue-10906.html',
      'https://www.afc.cl/empleadores/pagos-y-dudas-sobre-cotizaciones/cotizaciones-cuanto-y-como-se-paga/',
      'https://www.suseso.gob.cl/613/w3-propertyvalue-136002.html',
      'https://www.suseso.cl/622/articles-774676_archivo_05.pdf'));
end; $$;
revoke all on function private.rrhh_costeo_referencia(text) from public,anon,authenticated;

create function private.rrhh_completar_costeo(p_empresa text,p_periodo text) returns void
language plpgsql security definer set search_path='' as $$
declare anterior public.rrhh_costeo_parametros; reglas jsonb;
begin
  if auth.uid() is null or not (private.rrhh_imputaciones_permiso(p_empresa,'aprobar') or private.rrhh_imputaciones_permiso(p_empresa,'editar')) then
    raise exception 'Sin permiso para preparar el costeo de esta empresa'; end if;
  if p_periodo !~ '^\d{4}-(0[1-9]|1[0-2])$' then raise exception 'Período inválido'; end if;
  if not exists(select 1 from public.rrhh_costeo_automatico_empresas where empresa=p_empresa) then return; end if;
  if exists(select 1 from public.rrhh_costeo_parametros where empresa=p_empresa and periodo=p_periodo) then return; end if;
  -- Solo configuración anterior de la MISMA empresa; no copiar un futuro al pasado.
  select * into anterior from public.rrhh_costeo_parametros where empresa=p_empresa and periodo<p_periodo order by periodo desc limit 1;
  if anterior.origen='Manual' then
    insert into public.rrhh_costeo_parametros(empresa,periodo,horas_semanales,tope_gratificacion_mensual,cargas_empleador_pct,factor_hora_extra,origen,heredado_de,reglas)
      values(p_empresa,p_periodo,anterior.horas_semanales,anterior.tope_gratificacion_mensual,anterior.cargas_empleador_pct,anterior.factor_hora_extra,'Manual',anterior.periodo,anterior.reglas)
      on conflict(empresa,periodo) do nothing;
    return;
  end if;
  reglas:=private.rrhh_costeo_referencia(p_periodo);
  if reglas is null then return; end if; -- Mostrar dato faltante; jamás aplicar tasas de otro año.
  insert into public.rrhh_costeo_parametros(empresa,periodo,horas_semanales,tope_gratificacion_mensual,cargas_empleador_pct,factor_hora_extra,origen,reglas)
    values(p_empresa,p_periodo,(reglas->>'horas_semanales')::numeric,round(553553*4.75/12,2),6.83,1.5,'Automático',reglas)
    on conflict(empresa,periodo) do nothing;
end; $$;
revoke all on function private.rrhh_completar_costeo(text,text) from public,anon,authenticated;

-- Conservar sin cambios el comportamiento de configuraciones manuales existentes.
alter function private.rrhh_calcular_costo_dia(bigint,numeric,numeric,numeric) rename to rrhh_calcular_costo_dia_manual;
create function private.rrhh_calcular_costo_dia(p_id bigint,p_imponible numeric,p_no_imponible numeric,p_horas numeric default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.rrhh_imputaciones_diarias; p public.maestro_personal; c public.rrhh_costeo_parametros;
  d jsonb; parametros jsonb; evidencia jsonb; horas numeric; tasa numeric; extra numeric; grat numeric; cargas numeric; total numeric;
begin
  d:=private.rrhh_calcular_costo_dia_manual(p_id,p_imponible,p_no_imponible,p_horas);
  select * into t from public.rrhh_imputaciones_diarias where id=p_id;
  select * into c from public.rrhh_costeo_parametros where empresa=t.empresa and periodo=to_char(t.fecha,'YYYY-MM');
  if c.origen is distinct from 'Automático' then return d; end if;
  select * into p from public.maestro_personal where id=t.trabajador_id and empresa=t.empresa;
  if coalesce(p.sueldo_base,0)<=0 then return d||jsonb_build_object('motivo','Falta el sueldo base en la ficha del trabajador'); end if;
  if not coalesce((d->>'listo')::boolean,false) then return d; end if;
  if lower(coalesce(p.tipo_contrato,'')) not in ('indefinido','plazo fijo','por obra o faena') or coalesce(p.afp,'') in ('','Sin Previsión') then
    return jsonb_build_object('listo',false,'motivo','Revise tipo de contrato y régimen previsional en la ficha del trabajador','evidencia',d->'evidencia'); end if;
  horas:=coalesce(p.horas_semanales,c.horas_semanales);
  tasa:=(c.reglas->>'aporte_previsional_pct')::numeric+(c.reglas->>'accidentes_basica_pct')::numeric+(c.reglas->>'sanna_pct')::numeric+
    case when lower(p.tipo_contrato)='indefinido' then (c.reglas->>'afc_indefinido_pct')::numeric else (c.reglas->>'afc_plazo_pct')::numeric end;
  parametros:=jsonb_build_object('horas_semanales',horas,'factor_hora_extra',c.factor_hora_extra,'cargas_empleador_pct',tasa,
    'tope_gratificacion_mensual',c.tope_gratificacion_mensual,'origen_jornada',case when p.horas_semanales is null then 'Referencia legal del período' else 'Ficha contractual' end);
  evidencia:=(d->'evidencia')||jsonb_build_object('tipo_contrato',p.tipo_contrato,'afp',p.afp,'horas_semanales_contrato',p.horas_semanales,'parametros_aplicados',parametros);
  extra:=round(p.sueldo_base*7/(30*horas)*c.factor_hora_extra*(d->>'horas_extra')::numeric,2);
  grat:=case when p.gratificacion='Sin Gratificación' then 0 else round(least(((d->>'base')::numeric+extra+coalesce(p_imponible,0))*0.25,c.tope_gratificacion_mensual/30),2) end;
  cargas:=round(((d->>'base')::numeric+grat+extra+coalesce(p_imponible,0))*tasa/100,2);
  total:=round((d->>'base')::numeric+grat+(d->>'colacion')::numeric+(d->>'movilizacion')::numeric+extra+coalesce(p_imponible,0)+coalesce(p_no_imponible,0)+cargas);
  return d||jsonb_build_object('evidencia',evidencia,'parametros_aplicados',parametros,'monto_horas_extra',extra,'gratificacion',grat,'cargas_empleador',cargas,'total',total,'provision_referencial',true,'advertencia',c.reglas->>'advertencia');
end; $$;
revoke all on function private.rrhh_calcular_costo_dia(bigint,numeric,numeric,numeric) from public,anon,authenticated;

create or replace function private.rrhh_preparar_imputaciones(p_empresa text,p_periodo text)
returns integer language plpgsql security definer set search_path='' as $$
declare t record; d jsonb; cambios integer;
begin
  perform private.rrhh_completar_costeo(p_empresa,p_periodo);
  cambios:=private.rrhh_preparar_destinos(p_empresa,p_periodo);
  for t in select * from public.rrhh_imputaciones_diarias where empresa=p_empresa and fecha>=to_date(p_periodo||'-01','YYYY-MM-DD') and fecha<(to_date(p_periodo||'-01','YYYY-MM-DD')+interval '1 month') loop
    d:=private.rrhh_calcular_costo_dia(t.id,t.haber_imponible,t.haber_no_imponible,t.horas_extra_aprobadas);
    update public.rrhh_imputaciones_diarias set costo_detalle=d,costo_evidencia=d->'evidencia',
      costo_total=case when estado='Aprobada' and costo_evidencia=d->'evidencia' then costo_total else null end,
      estado=case when estado='Aprobada' and costo_evidencia is distinct from d->'evidencia' then 'Pendiente' else estado end,
      historial=case when estado='Aprobada' and costo_evidencia is distinct from d->'evidencia' then historial||jsonb_build_array(jsonb_build_object('accion','Costeo modificado; requiere aprobación','fecha',now(),'actor',auth.uid())) else historial end
    where id=t.id;
  end loop;
  return cambios;
end; $$;
revoke all on function private.rrhh_preparar_imputaciones(text,text) from public,anon;
grant execute on function private.rrhh_preparar_imputaciones(text,text) to authenticated;
notify pgrst,'reload schema';
