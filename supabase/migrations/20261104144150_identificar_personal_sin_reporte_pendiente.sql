-- Distribución diaria de personal: cuadrilla explícita o toda la dotación
-- cuando el reporte no tiene cuadrilla. Una partida se cuenta una sola vez.
-- Conserva los importes y la exclusión de provisiones ya conciliadas.
create or replace view public.rrhh_costos_personal_vigentes with (security_invoker=true) as
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
  coalesce(distribucion.detalle,'[]'::jsonb) obra_liquidaciones_partidas,
  case when distribucion.detalle is not null then 'Distribuida'
    when not exists(select 1 from public.avances_produccion_partidas a
      where a.empresa=e.empresa and a.obra_id=o.id and a.cantidad>0
        and (a.created_at at time zone 'America/Santiago')::date=e.fecha)
      then 'Pendiente de aprobación: sin reporte de avance'
    else 'Pendiente de revisión: cuadrilla, partida o presupuesto'
  end estado_imputacion_partidas
from efectivos e
left join public.obras o on o.empresa=e.empresa and o.centro_gestion_id=e.centro_gestion_id
left join lateral (
  with reportes as (
    select a.*
    from public.avances_produccion_partidas a
    where a.empresa=e.empresa and a.obra_id=o.id
      -- La fecha del reporte se almacena en created_at (mediodía UTC al guardar).
      and (a.created_at at time zone 'America/Santiago')::date=e.fecha
      and a.cantidad>0
      and (a.cuadrilla_id is null or exists(
        select 1 from jsonb_array_elements_text(
          case when jsonb_typeof(a.cuadrilla_miembros)='array' then a.cuadrilla_miembros else '[]'::jsonb end
        ) m where lower(btrim(m.value))=lower(btrim(e.trabajador))
      ))
  ), resueltos as (
    select a.id reporte_id,p.id partida_id,p.partida,
      p.cantidad_presupuestada*p.costo_por_dia presupuesto,
      a.cuadrilla_id is null sin_cuadrilla
    from reportes a
    left join lateral (
      select b.* from public.partidas_obra b
      where b.empresa=e.empresa and b.obra_id=o.id and not coalesce(b.es_titulo,false)
        and coalesce(b.unidad,'') not in ('TITULO','GRUPO')
        and (b.id=a.partida_id or (a.partida_id is null
          and lower(btrim(b.partida))=lower(btrim(a.partida))
          and (select count(*) from public.partidas_obra x
            where x.empresa=e.empresa and x.obra_id=o.id and not coalesce(x.es_titulo,false)
              and coalesce(x.unidad,'') not in ('TITULO','GRUPO')
              and lower(btrim(x.partida))=lower(btrim(a.partida)))=1))
    ) p on true
  ), partidas as (
    select partida_id,partida,max(presupuesto) presupuesto,bool_or(sin_cuadrilla) sin_cuadrilla
    from resueltos where partida_id is not null group by partida_id,partida
  ), pesos as (
    select *,count(*) over() cantidad_partidas,
      case when count(*) over()=1 then 1::numeric
        else presupuesto/nullif(sum(presupuesto) over(),0) end factor,
      bool_and(coalesce(presupuesto>0,false)) over() presupuestos_validos
    from partidas
  ), acumulados as (
    select *,sum(factor) over(order by partida_id) acumulado,
      row_number() over(order by partida_id) orden
    from pesos
    where (cantidad_partidas=1 or presupuestos_validos)
      and not exists(select 1 from resueltos where partida_id is null)
  ), montos as (
    select *,case when orden=cantidad_partidas then e.monto_real else round(e.monto_real*acumulado,2) end
      -coalesce(lag(round(e.monto_real*acumulado,2)) over(order by partida_id),0) monto
    from acumulados
  )
  select jsonb_agg(jsonb_build_object(
    'partida_id',partida_id,'partida',partida,'monto_imputado',monto,
    'factor',factor,'presupuesto_partida',presupuesto,
    'criterio',case when sin_cuadrilla then 'Dotación de obra: reporte sin cuadrilla' else 'Integrante de cuadrilla reportada' end
  ) order by partida_id) detalle from montos
) distribucion on true;
notify pgrst,'reload schema';
