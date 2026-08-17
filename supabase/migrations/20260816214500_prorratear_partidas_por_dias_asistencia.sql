alter function public.distribuir_nomina_a_obras(bigint)
  rename to distribuir_nomina_a_obras_base;

revoke all on function public.distribuir_nomina_a_obras_base(bigint) from public, anon;
grant execute on function public.distribuir_nomina_a_obras_base(bigint) to authenticated;

create or replace function public.distribuir_nomina_partidas_por_asistencia(p_nomina_id bigint)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_empresa text;
  v_periodo text;
  v_inicio date;
  v_fin date;
  v_detalles integer := 0;
  v_sin_partida integer := 0;
begin
  select empresa, periodo into v_empresa, v_periodo
  from public.rrhh_nominas_mensuales
  where id = p_nomina_id and estado = 'Cerrada';
  if v_empresa is null then raise exception 'Nómina cerrada no encontrada o sin acceso'; end if;

  v_inicio := (v_periodo || '-01')::date;
  v_fin := (v_inicio + interval '1 month - 1 day')::date;

  delete from public.obra_liquidaciones_partidas
  where nomina_id = p_nomina_id and nomina_item_id is not null;

  with
  liquidaciones as (
    select l.*, i.trabajador_rut,
      upper(regexp_replace(coalesce(i.trabajador_rut, ''), '[^0-9kK]', '', 'g')) rut_normalizado
    from public.obra_liquidaciones l
    join public.rrhh_nomina_items i on i.id = l.nomina_item_id
    where l.nomina_id = p_nomina_id and l.nomina_item_id is not null
  ),
  asistencias as (
    select distinct l.id liquidacion_id, a.fecha_marcacion fecha,
      1.0 / greatest(1, (
        select count(distinct a2.obra_id)
        from public.asistencia_personal a2
        where a2.empresa = v_empresa
          and a2.fecha_marcacion = a.fecha_marcacion
          and upper(coalesce(a2.asistencia, 'PRESENTE')) = 'PRESENTE'
          and ((l.rut_normalizado <> '' and a2.rut_normalizado = l.rut_normalizado)
            or (l.rut_normalizado = '' and lower(btrim(coalesce(a2.trabajador, ''))) = lower(btrim(l.trabajador))))
      ))::numeric peso_obra
    from liquidaciones l
    join public.asistencia_personal a
      on a.empresa = v_empresa and a.obra_id = l.obra_id
      and a.fecha_marcacion between v_inicio and v_fin
      and upper(coalesce(a.asistencia, 'PRESENTE')) = 'PRESENTE'
      and ((l.rut_normalizado <> '' and a.rut_normalizado = l.rut_normalizado)
        or (l.rut_normalizado = '' and lower(btrim(coalesce(a.trabajador, ''))) = lower(btrim(l.trabajador))))
  ),
  partidas_dia as (
    select a.liquidacion_id, a.fecha, a.peso_obra,
      r.partida_id, r.partida, r.cuadrilla_id, r.cuadrilla_nombre
    from asistencias a
    join liquidaciones l on l.id = a.liquidacion_id
    join public.avances_produccion_partidas r
      on r.empresa = l.empresa and r.obra_id = l.obra_id
      and (r.created_at at time zone 'America/Santiago')::date = a.fecha
      and r.cuadrilla_id is not null
      and exists (
        select 1 from jsonb_array_elements_text(r.cuadrilla_miembros) miembro
        where lower(btrim(miembro)) = lower(btrim(l.trabajador))
      )
    group by a.liquidacion_id, a.fecha, a.peso_obra,
      r.partida_id, r.partida, r.cuadrilla_id, r.cuadrilla_nombre
  ),
  partidas_dia_distribuidas as (
    select p.*,
      p.peso_obra / count(*) over (partition by p.liquidacion_id, p.fecha) ponderador_dia
    from partidas_dia p
  ),
  partidas_acumuladas as (
    select liquidacion_id, partida_id, partida, cuadrilla_id, cuadrilla_nombre,
      sum(ponderador_dia)::numeric ponderador,
      'Días de asistencia y avances de cuadrilla'::text criterio
    from partidas_dia_distribuidas
    group by liquidacion_id, partida_id, partida, cuadrilla_id, cuadrilla_nombre
  ),
  pendientes_generales as (
    select l.id liquidacion_id, null::integer partida_id,
      'Gastos Generales de Obra'::text partida, null::bigint cuadrilla_id,
      null::text cuadrilla_nombre,
      greatest(0, l.dias_imputados - coalesce(sum(p.ponderador), 0))::numeric ponderador,
      'Días sin avance de cuadrilla vinculable'::text criterio
    from liquidaciones l
    left join partidas_acumuladas p on p.liquidacion_id = l.id
    group by l.id, l.dias_imputados
    having greatest(0, l.dias_imputados - coalesce(sum(p.ponderador), 0)) > 0.000001
  ),
  bases as (
    select * from partidas_acumuladas
    union all
    select * from pendientes_generales
  ),
  calculo as (
    select l.empresa, l.id liquidacion_id, l.nomina_id, l.nomina_item_id,
      l.trabajador_id, l.obra_id, b.partida_id, b.partida, b.cuadrilla_id,
      b.cuadrilla_nombre, b.ponderador, b.criterio, l.monto_real,
      sum(b.ponderador) over (partition by l.id) total_ponderador,
      floor(l.monto_real * b.ponderador /
        nullif(sum(b.ponderador) over (partition by l.id), 0)) monto_base,
      row_number() over (partition by l.id order by b.ponderador desc, b.partida) orden
    from liquidaciones l join bases b on b.liquidacion_id = l.id
  ),
  ajustados as (
    select c.*, (c.monto_real - sum(c.monto_base) over
      (partition by c.liquidacion_id))::integer residuo
    from calculo c
  )
  insert into public.obra_liquidaciones_partidas (
    empresa, liquidacion_id, nomina_id, nomina_item_id, trabajador_id, obra_id,
    partida_id, partida, cuadrilla_id, cuadrilla_nombre, monto_imputado,
    porcentaje_imputacion, ponderador, criterio
  )
  select empresa, liquidacion_id, nomina_id, nomina_item_id, trabajador_id, obra_id,
    partida_id, partida, cuadrilla_id, cuadrilla_nombre,
    monto_base + case when orden <= residuo then 1 else 0 end,
    round(ponderador * 100 / nullif(total_ponderador, 0), 4),
    round(ponderador, 4), criterio
  from ajustados;

  get diagnostics v_detalles = row_count;

  update public.obra_liquidaciones l
  set partida = case when d.total = 1 then d.unica_partida
    else d.total || ' partidas según asistencia y cuadrillas' end
  from (
    select liquidacion_id, count(*) total, min(partida) unica_partida
    from public.obra_liquidaciones_partidas
    where nomina_id = p_nomina_id
    group by liquidacion_id
  ) d
  where l.id = d.liquidacion_id;

  select count(*) into v_sin_partida
  from public.obra_liquidaciones_partidas
  where nomina_id = p_nomina_id and partida_id is null;

  return jsonb_build_object(
    'imputaciones_partidas', v_detalles,
    'imputaciones_sin_partida', v_sin_partida,
    'base_partidas', 'dias_asistencia'
  );
end;
$$;

revoke all on function public.distribuir_nomina_partidas_por_asistencia(bigint) from public, anon;
grant execute on function public.distribuir_nomina_partidas_por_asistencia(bigint) to authenticated;

create or replace function public.distribuir_nomina_a_obras(p_nomina_id bigint)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_base jsonb;
  v_partidas jsonb;
begin
  v_base := public.distribuir_nomina_a_obras_base(p_nomina_id);
  v_partidas := public.distribuir_nomina_partidas_por_asistencia(p_nomina_id);
  return v_base || v_partidas;
end;
$$;

revoke all on function public.distribuir_nomina_a_obras(bigint) from public, anon;
grant execute on function public.distribuir_nomina_a_obras(bigint) to authenticated;

comment on function public.distribuir_nomina_partidas_por_asistencia(bigint) is
  'Distribuye el costo de mano de obra por partidas usando días equivalentes de asistencia y avances de las cuadrillas.';
