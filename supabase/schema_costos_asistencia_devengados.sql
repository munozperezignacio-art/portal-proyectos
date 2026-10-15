-- Costeo configurable: ninguna tasa previsional se inventa a partir de datos faltantes.
create table public.rrhh_costeo_parametros (
  empresa text not null, periodo text not null check(periodo ~ '^\d{4}-\d{2}$'),
  horas_semanales numeric not null check(horas_semanales>0 and horas_semanales<=60),
  tope_gratificacion_mensual numeric not null check(tope_gratificacion_mensual>=0),
  cargas_empleador_pct numeric not null check(cargas_empleador_pct>=0 and cargas_empleador_pct<=100),
  factor_hora_extra numeric not null default 1.5 check(factor_hora_extra>=1.5 and factor_hora_extra<=5),
  actualizado_por uuid not null default auth.uid(), actualizado_en timestamptz not null default now(),
  primary key(empresa,periodo)
);
alter table public.rrhh_costeo_parametros enable row level security;
revoke all on public.rrhh_costeo_parametros from anon,authenticated;
grant select,insert,update on public.rrhh_costeo_parametros to authenticated;
create policy costeo_lectura on public.rrhh_costeo_parametros for select to authenticated using(private.rrhh_imputaciones_permiso(empresa,'ver'));
create policy costeo_insertar on public.rrhh_costeo_parametros for insert to authenticated with check(private.rrhh_imputaciones_permiso(empresa,'aprobar'));
create policy costeo_editar on public.rrhh_costeo_parametros for update to authenticated using(private.rrhh_imputaciones_permiso(empresa,'aprobar')) with check(private.rrhh_imputaciones_permiso(empresa,'aprobar'));
alter table public.rrhh_imputaciones_diarias
  add column costo_detalle jsonb,
  add column costo_evidencia jsonb,
  add column costo_total numeric,
  add column haber_imponible numeric not null default 0 check(haber_imponible>=0),
  add column haber_no_imponible numeric not null default 0 check(haber_no_imponible>=0),
  add column horas_extra_aprobadas numeric check(horas_extra_aprobadas>=0 and horas_extra_aprobadas<=24);
alter table public.rrhh_costos_centros_aprobados add column dias_detalle jsonb;

create or replace function private.rrhh_calcular_costo_dia(p_id bigint,p_imponible numeric,p_no_imponible numeric,p_horas numeric default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare t public.rrhh_imputaciones_diarias; p public.maestro_personal; c public.rrhh_costeo_parametros;
  hx numeric; base numeric; grat numeric; extra numeric; col numeric; mov numeric; cargas numeric; evidencia jsonb;
begin
  select * into t from public.rrhh_imputaciones_diarias where id=p_id;
  select * into p from public.maestro_personal where id=t.trabajador_id and empresa=t.empresa for share;
  select * into c from public.rrhh_costeo_parametros where empresa=t.empresa and periodo=to_char(t.fecha,'YYYY-MM') for share;
  select coalesce(sum(greatest(coalesce(a.horas_extras_auto,0),coalesce(a.horas_extras_manual,0))),0) into hx
    from public.asistencia_personal a where a.empresa=t.empresa and a.fecha_marcacion=t.fecha
      and upper(coalesce(a.asistencia,''))='PRESENTE' and coalesce(p.rut,'')<>''
      and upper(regexp_replace(coalesce(a.rut_normalizado,a.rut,''),'[^0-9kK]','','g'))=upper(regexp_replace(p.rut,'[^0-9kK]','','g'));
  evidencia:=jsonb_build_object('sueldo',p.sueldo_base,'gratificacion',p.gratificacion,'colacion',p.colacion,'movilizacion',p.movilizacion,
    'horas_detectadas',hx,'parametros',to_jsonb(c)-'actualizado_en'-'actualizado_por');
  if c.empresa is null or coalesce(p.sueldo_base,0)<=0 then
    return jsonb_build_object('listo',false,'motivo','Configure parámetros de costeo del mes y sueldo del trabajador','evidencia',evidencia); end if;
  if t.fecha<coalesce(p.fecha_inicio_contrato,t.fecha) or t.fecha>coalesce(p.fecha_vencimiento_contrato,t.fecha) then
    return jsonb_build_object('listo',false,'motivo','Día fuera del contrato vigente','evidencia',evidencia); end if;
  base:=round(p.sueldo_base/30,2);
  grat:=case when p.gratificacion='Sin Gratificación' then 0 else round(least(p.sueldo_base*0.25,c.tope_gratificacion_mensual)/30,2) end;
  hx:=coalesce(p_horas,hx);
  extra:=round(p.sueldo_base*7/(30*c.horas_semanales)*c.factor_hora_extra*hx,2);
  col:=round(coalesce(p.colacion,0)/30,2); mov:=round(coalesce(p.movilizacion,0)/30,2);
  cargas:=round((base+grat+extra+coalesce(p_imponible,0))*c.cargas_empleador_pct/100,2);
  return jsonb_build_object('listo',true,'evidencia',evidencia,'base',base,'gratificacion',grat,'colacion',col,'movilizacion',mov,
    'horas_extra',hx,'monto_horas_extra',extra,'haber_imponible',coalesce(p_imponible,0),'haber_no_imponible',coalesce(p_no_imponible,0),'cargas_empleador',cargas,
    'total',round(base+grat+col+mov+extra+coalesce(p_imponible,0)+coalesce(p_no_imponible,0)+cargas));
end; $$;
revoke all on function private.rrhh_calcular_costo_dia(bigint,numeric,numeric,numeric) from public,anon,authenticated;

alter function private.rrhh_preparar_imputaciones(text,text) rename to rrhh_preparar_destinos;
create or replace function private.rrhh_preparar_imputaciones(p_empresa text,p_periodo text)
returns integer language plpgsql security definer set search_path='' as $$
declare t record; d jsonb; cambios integer;
begin
  cambios:=private.rrhh_preparar_destinos(p_empresa,p_periodo);
  for t in select * from public.rrhh_imputaciones_diarias where empresa=p_empresa and to_char(fecha,'YYYY-MM')=p_periodo loop
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

alter function private.rrhh_aprobar_imputaciones(text,jsonb) rename to rrhh_aprobar_destinos;
create or replace function private.rrhh_aprobar_imputaciones(p_empresa text,p_decisiones jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare d jsonb; r public.rrhh_imputaciones_diarias; c jsonb; periodo text; total integer;
begin
  if not private.rrhh_imputaciones_permiso(p_empresa,'aprobar') then raise exception 'Sin permiso para aprobar costos'; end if;
  if jsonb_typeof(p_decisiones)<>'array' or jsonb_array_length(p_decisiones) not between 1 and 1000 then raise exception 'Lote inválido'; end if;
  for periodo in select distinct to_char(t.fecha,'YYYY-MM') from public.rrhh_imputaciones_diarias t join jsonb_array_elements(p_decisiones) decision on t.id=(decision->>'id')::bigint where t.empresa=p_empresa order by 1 loop
    perform private.rrhh_preparar_imputaciones(p_empresa,periodo);
  end loop;
  for d in select * from jsonb_array_elements(p_decisiones) loop
    select * into r from public.rrhh_imputaciones_diarias where id=(d->>'id')::bigint and empresa=p_empresa for update;
    if not found then raise exception 'Registro sin acceso'; end if;
    if r.costo_evidencia is distinct from d->'costo_evidencia' then raise exception 'Cambió el sueldo, las horas extras o los parámetros. Actualice y revise.'; end if;
    if coalesce((d->>'haber_imponible')::numeric,0)<0 or coalesce((d->>'haber_no_imponible')::numeric,0)<0 or (d->>'horas_extra')::numeric not between 0 and 24 then raise exception 'Haberes u horas inválidos'; end if;
    c:=private.rrhh_calcular_costo_dia(r.id,coalesce((d->>'haber_imponible')::numeric,r.haber_imponible),coalesce((d->>'haber_no_imponible')::numeric,r.haber_no_imponible),coalesce((d->>'horas_extra')::numeric,(r.costo_detalle->>'horas_extra')::numeric));
    if not coalesce((c->>'listo')::boolean,false) then raise exception '%',c->>'motivo'; end if;
    if r.fecha>(now() at time zone 'America/Santiago')::date then raise exception 'No se puede devengar un costo diario futuro'; end if;
  end loop;
  total:=private.rrhh_aprobar_destinos(p_empresa,p_decisiones);
  for d in select * from jsonb_array_elements(p_decisiones) loop
    select * into r from public.rrhh_imputaciones_diarias where id=(d->>'id')::bigint and empresa=p_empresa;
    c:=private.rrhh_calcular_costo_dia(r.id,coalesce((d->>'haber_imponible')::numeric,r.haber_imponible),coalesce((d->>'haber_no_imponible')::numeric,r.haber_no_imponible),coalesce((d->>'horas_extra')::numeric,(r.costo_detalle->>'horas_extra')::numeric));
    update public.rrhh_imputaciones_diarias set costo_detalle=c,costo_total=(c->>'total')::numeric,
      haber_imponible=(c->>'haber_imponible')::numeric,haber_no_imponible=(c->>'haber_no_imponible')::numeric,horas_extra_aprobadas=(c->>'horas_extra')::numeric,
      historial=historial||jsonb_build_array(jsonb_build_object('accion','Costo devengado aprobado','fecha',now(),'actor',auth.uid(),'desglose',c-'evidencia')) where id=r.id;
  end loop;
  return total;
end; $$;
revoke all on function private.rrhh_aprobar_imputaciones(text,jsonb) from public,anon;
grant execute on function private.rrhh_aprobar_imputaciones(text,jsonb) to authenticated;

-- La nómina final es un reemplazo identificable por trabajador/mes, nunca otro cargo acumulable.
alter function private.rrhh_distribuir_nomina_aprobada(bigint) rename to rrhh_distribuir_nomina_anterior;
create or replace function private.rrhh_distribuir_nomina_aprobada(p_nomina_id bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare n public.rrhh_nominas_mensuales; resultado jsonb;
begin
  select * into n from public.rrhh_nominas_mensuales where id=p_nomina_id for update;
  if not found or not private.rrhh_imputaciones_permiso(n.empresa,'aprobar') then raise exception 'Nómina sin acceso'; end if;
  if exists(select 1 from public.rrhh_nomina_items where nomina_id=n.id and not (calculo ? 'employerCost')) then raise exception 'Regenere la nómina con el costo empleador antes de conciliar'; end if;
  resultado:=private.rrhh_distribuir_nomina_anterior(n.id);
  if coalesce((resultado->>'distribuida')::boolean,false) then
    -- Conserva horas/haberes en su día y destino. Solo el saldo mensual se reparte.
    with dias as (
      select i.id item_id,t.id,t.fecha,t.centro_aprobado_id centro,t.costo_total provision,
        round((i.calculo->>'employerCost')::numeric) total,
        sum(t.costo_total) over(partition by i.id) total_provision,count(*) over(partition by i.id) dias
      from public.rrhh_nomina_items i join public.rrhh_imputaciones_diarias t on t.trabajador_id=i.trabajador_id
      where i.nomina_id=n.id and t.empresa=n.empresa and to_char(t.fecha,'YYYY-MM')=n.periodo and t.estado='Aprobada'
    ), valores as (
      select d.*,case when total>=total_provision then provision+(total-total_provision)/dias
        when total_provision>0 then total*provision/total_provision else total/dias end bruto from dias d
    ), redondeados as (
      select v.*,floor(bruto) base,row_number() over(partition by item_id order by fecha,id) orden,
        total-sum(floor(bruto)) over(partition by item_id) residuo from valores v
    ), montos as (select r.*,base+case when orden<=residuo then 1 else 0 end monto from redondeados r),
    centros as (select item_id,centro,sum(monto) monto,jsonb_agg(jsonb_build_object('fecha',fecha,'id',id,'monto',monto) order by fecha,id) detalle from montos group by item_id,centro)
    update public.rrhh_costos_centros_aprobados c set monto=b.monto,dias_detalle=b.detalle from centros b where c.nomina_item_id=b.item_id and c.centro_gestion_id=b.centro and c.nomina_id=n.id;
    update public.obra_liquidaciones l set monto_real=c.monto from public.rrhh_costos_centros_aprobados c join public.obras o on o.centro_gestion_id=c.centro_gestion_id and o.empresa=c.empresa
      where c.nomina_id=n.id and l.nomina_item_id=c.nomina_item_id and l.obra_id=o.id and l.nomina_id=n.id;
    perform public.distribuir_nomina_partidas_por_asistencia(n.id);
  end if;
  return resultado;
end; $$;
revoke all on function private.rrhh_distribuir_nomina_aprobada(bigint) from public,anon;
grant execute on function private.rrhh_distribuir_nomina_aprobada(bigint) to authenticated;
-- Evita que se salten los nuevos controles mediante nombres anteriores.
revoke all on function private.rrhh_preparar_destinos(text,text),private.rrhh_aprobar_destinos(text,jsonb),private.rrhh_distribuir_nomina_anterior(bigint) from public,anon,authenticated;

create view public.rrhh_costos_personal_vigentes with (security_invoker=true) as
with finales as (
  select c.*,i.trabajador_id,i.trabajador_nombre,n.periodo,
    coalesce(c.dias_detalle,(select jsonb_agg(jsonb_build_object('fecha',t.fecha,'id',t.id) order by t.fecha,t.id) from public.rrhh_imputaciones_diarias t
      where t.empresa=c.empresa and t.trabajador_id=i.trabajador_id and to_char(t.fecha,'YYYY-MM')=n.periodo and t.centro_aprobado_id=c.centro_gestion_id and t.estado='Aprobada')) dias_json
  from public.rrhh_costos_centros_aprobados c join public.rrhh_nomina_items i on i.id=c.nomina_item_id
  join public.rrhh_nominas_mensuales n on n.id=c.nomina_id and n.estado in ('Cerrada','Pagada')
), dias_finales as (
  select f.*,d.value->>'fecha' fecha,row_number() over(partition by f.nomina_item_id,f.centro_gestion_id order by d.value->>'fecha') orden,
    jsonb_array_length(f.dias_json) cantidad_dias from finales f cross join lateral jsonb_array_elements(f.dias_json) d
), efectivos as (
  select 'D-'||t.id id,t.empresa,t.trabajador_id,p.nombre trabajador,t.fecha,t.centro_aprobado_id centro_gestion_id,t.costo_total monto_real,
    null::bigint nomina_id,null::bigint nomina_item_id,'Provisión aprobada'::text fuente,t.costo_detalle desglose
  from public.rrhh_imputaciones_diarias t join public.maestro_personal p on p.id=t.trabajador_id and p.empresa=t.empresa
  where t.estado='Aprobada' and t.costo_total is not null
    and not exists(select 1 from finales f where f.empresa=t.empresa and f.trabajador_id=t.trabajador_id and f.periodo=to_char(t.fecha,'YYYY-MM'))
    and not exists(select 1 from public.obra_liquidaciones l where l.empresa=t.empresa and l.trabajador_id=t.trabajador_id and l.periodo=to_char(t.fecha,'YYYY-MM') and l.nomina_item_id is not null)
  union all
  select 'N-'||nomina_item_id||'-'||centro_gestion_id||'-'||orden,empresa,trabajador_id,trabajador_nombre,fecha::date,centro_gestion_id,
    coalesce((dias_json->(orden::integer-1)->>'monto')::numeric,floor(monto/cantidad_dias)+case when orden<=mod(monto,cantidad_dias) then 1 else 0 end),nomina_id,nomina_item_id,'Nómina conciliada','{}'::jsonb from dias_finales
)
select e.*,o.id obra_id,o.nombre obra_nombre,to_char(e.fecha,'YYYY-MM') periodo,
  coalesce((select jsonb_agg(jsonb_build_object('partida_id',a.partida_id,'partida',a.partida,'monto_imputado',e.monto_real/cnt.n)) from (
    select distinct a.partida_id,a.partida from public.avances_produccion_partidas a where a.empresa=e.empresa and a.obra_id=o.id
      and (a.created_at at time zone 'America/Santiago')::date=e.fecha and a.cuadrilla_id is not null
      and exists(select 1 from jsonb_array_elements_text(a.cuadrilla_miembros) m where lower(btrim(m))=lower(btrim(e.trabajador)))
  ) a cross join lateral (select count(*) n from (select distinct a.partida_id,a.partida from public.avances_produccion_partidas a where a.empresa=e.empresa and a.obra_id=o.id and (a.created_at at time zone 'America/Santiago')::date=e.fecha and a.cuadrilla_id is not null and exists(select 1 from jsonb_array_elements_text(a.cuadrilla_miembros) m where lower(btrim(m))=lower(btrim(e.trabajador)))) x) cnt),'[]'::jsonb) obra_liquidaciones_partidas
from efectivos e left join public.obras o on o.empresa=e.empresa and o.centro_gestion_id=e.centro_gestion_id;
revoke all on public.rrhh_costos_personal_vigentes from public,anon;
grant select on public.rrhh_costos_personal_vigentes to authenticated;
notify pgrst,'reload schema';

alter table public.obras add column if not exists presupuesto_costo_control numeric check(presupuesto_costo_control>0);
comment on column public.obras.presupuesto_costo_control is 'Presupuesto de costos aprobado en CLP para control EVM; no es la venta contractual.';

-- Toda asistencia nueva genera un pendiente, aun si se registró desde el portal QR.
create or replace function private.rrhh_proponer_costo_asistencia()
returns trigger language plpgsql security definer set search_path='' as $$
declare p record;
begin
  if new.fecha_marcacion is null then return null; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.empresa||to_char(new.fecha_marcacion,'YYYY-MM'),0));
  for p in select id,centro_gestion_defecto_id from public.maestro_personal mp where mp.empresa=new.empresa and coalesce(mp.rut,'')<>''
    and upper(regexp_replace(mp.rut,'[^0-9kK]','','g'))=upper(regexp_replace(coalesce(new.rut_normalizado,new.rut,''),'[^0-9kK]','','g')) loop
    insert into public.rrhh_imputaciones_diarias(empresa,trabajador_id,fecha,origen,evidencia,centro_propuesto_id)
    values(new.empresa,p.id,new.fecha_marcacion,'Por revisar','{}',p.centro_gestion_defecto_id)
    on conflict(empresa,trabajador_id,fecha) do nothing;
  end loop;
  return null;
end; $$;
revoke all on function private.rrhh_proponer_costo_asistencia() from public,anon,authenticated;
create trigger rrhh_propone_costo after insert or update on public.asistencia_personal for each row execute function private.rrhh_proponer_costo_asistencia();

create or replace function private.rrhh_invalidar_imputacion_asistencia()
returns trigger language plpgsql security definer set search_path='' as $$
declare v record;
begin
  for v in select empresa,fecha_marcacion,rut from (
    select old.empresa,old.fecha_marcacion,coalesce(old.rut_normalizado,old.rut) rut where TG_OP<>'INSERT'
    union select new.empresa,new.fecha_marcacion,coalesce(new.rut_normalizado,new.rut) rut where TG_OP<>'DELETE'
  ) x loop
    perform pg_advisory_xact_lock(hashtextextended(v.empresa||to_char(v.fecha_marcacion,'YYYY-MM'),0));
    update public.rrhh_imputaciones_diarias t set estado='Pendiente',evidencia='{"invalidada":true}',
      centro_aprobado_id=null,aprobado_por=null,aprobado_en=null,
      historial=historial||jsonb_build_array(jsonb_build_object('accion','Asistencia modificada; revisar y recalcular costos','fecha',now(),'actor',auth.uid(),'centro_anterior',t.centro_aprobado_id))
    from public.maestro_personal p where t.trabajador_id=p.id and t.empresa=v.empresa and t.fecha=v.fecha_marcacion
      and coalesce(v.rut,'')<>'' and upper(regexp_replace(coalesce(p.rut,''),'[^0-9kK]','','g'))=upper(regexp_replace(v.rut,'[^0-9kK]','','g'));
  end loop;
  return null;
end; $$;
revoke all on function private.rrhh_invalidar_imputacion_asistencia() from public,anon,authenticated;
