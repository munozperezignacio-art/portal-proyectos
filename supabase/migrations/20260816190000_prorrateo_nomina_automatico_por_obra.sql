alter table public.obra_liquidaciones
  add column if not exists nomina_id bigint references public.rrhh_nominas_mensuales(id) on delete restrict,
  add column if not exists nomina_item_id bigint references public.rrhh_nomina_items(id) on delete restrict,
  add column if not exists trabajador_id integer references public.maestro_personal(id) on delete restrict,
  add column if not exists monto_liquidacion_total numeric not null default 0,
  add column if not exists dias_imputados numeric not null default 0,
  add column if not exists porcentaje_imputacion numeric not null default 0,
  add column if not exists criterio_imputacion text;

create unique index if not exists obra_liquidaciones_nomina_item_obra_uidx
  on public.obra_liquidaciones (nomina_item_id, obra_id)
  where nomina_item_id is not null and obra_id is not null;

create index if not exists obra_liquidaciones_nomina_idx
  on public.obra_liquidaciones (nomina_id, nomina_item_id);

create or replace function public.distribuir_nomina_a_obras(p_nomina_id bigint)
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
  v_creadas integer := 0;
  v_sin_destino integer := 0;
begin
  select empresa, periodo into v_empresa, v_periodo
  from public.rrhh_nominas_mensuales
  where id = p_nomina_id and estado = 'Cerrada';

  if v_empresa is null then raise exception 'Nómina cerrada no encontrada o sin acceso'; end if;
  v_inicio := (v_periodo || '-01')::date;
  v_fin := (v_inicio + interval '1 month - 1 day')::date;
  delete from public.obra_liquidaciones where nomina_id = p_nomina_id;

  with
  items as (
    select i.id item_id, i.trabajador_id, i.trabajador_nombre, i.trabajador_rut,
      greatest(0, round(coalesce(nullif(i.calculo ->> 'employerCost', '')::numeric,
        nullif(i.calculo ->> 'totalAssets', '')::numeric, i.sueldo_liquido, 0))) monto_total,
      upper(regexp_replace(coalesce(i.trabajador_rut, ''), '[^0-9kK]', '', 'g')) rut_normalizado,
      i.obra_nombre obra_ficha
    from public.rrhh_nomina_items i where i.nomina_id = p_nomina_id
  ),
  dias_habiles as (
    select i.*, d::date fecha from items i
    cross join lateral generate_series(v_inicio, v_fin, interval '1 day') d
    where extract(isodow from d) between 1 and 5
  ),
  asistencias as (
    select distinct d.item_id, d.fecha, a.obra_id, coalesce(a.obra_nombre, o.nombre) obra_nombre
    from dias_habiles d
    join public.asistencia_personal a on a.empresa = v_empresa and a.fecha_marcacion = d.fecha
      and upper(coalesce(a.asistencia, 'PRESENTE')) = 'PRESENTE'
      and ((d.rut_normalizado <> '' and a.rut_normalizado = d.rut_normalizado)
        or (d.rut_normalizado = '' and lower(btrim(coalesce(a.trabajador, ''))) = lower(btrim(d.trabajador_nombre))))
    join public.obras o on o.id = a.obra_id and o.empresa = v_empresa
  ),
  asistencia_con_peso as (
    select a.*, 1.0 / count(*) over (partition by a.item_id, a.fecha) peso from asistencias a
  ),
  asignaciones as (
    select d.item_id, d.fecha, o.id obra_id, o.nombre obra_nombre, 1.0::numeric peso
    from dias_habiles d
    join public.rrhh_asignaciones_personal ap on ap.empresa = v_empresa and ap.trabajador_id = d.trabajador_id
      and ap.obra_nombre is not null and ap.fecha_inicio <= d.fecha and coalesce(ap.fecha_termino, v_fin) >= d.fecha
    join public.obras o on o.empresa = v_empresa and lower(btrim(o.nombre)) = lower(btrim(ap.obra_nombre))
    where not exists (select 1 from asistencias a where a.item_id = d.item_id and a.fecha = d.fecha)
  ),
  base_diaria as (
    select item_id, fecha, obra_id, obra_nombre, peso, 'Asistencia'::text criterio from asistencia_con_peso
    union all
    select item_id, fecha, obra_id, obra_nombre, peso, 'Asignación'::text criterio from asignaciones
  ),
  base_obra as (
    select item_id, obra_id, obra_nombre, sum(peso)::numeric dias,
      case when bool_or(criterio = 'Asistencia') then 'Asistencia y asignaciones' else 'Historial de asignaciones' end criterio
    from base_diaria group by item_id, obra_id, obra_nombre
  ),
  fallback as (
    select i.item_id, o.id obra_id, o.nombre obra_nombre, 1::numeric dias,
      'Ficha vigente sin detalle diario'::text criterio
    from items i join public.obras o on o.empresa = v_empresa and lower(btrim(o.nombre)) = lower(btrim(i.obra_ficha))
    where not exists (select 1 from base_obra b where b.item_id = i.item_id)
  ),
  bases as (select * from base_obra union all select * from fallback),
  calculo as (
    select b.*, i.trabajador_id, i.trabajador_nombre, i.monto_total,
      sum(b.dias) over (partition by b.item_id) total_dias,
      floor(i.monto_total * b.dias / nullif(sum(b.dias) over (partition by b.item_id), 0)) monto_base,
      row_number() over (partition by b.item_id order by b.dias desc, b.obra_id) orden
    from bases b join items i on i.item_id = b.item_id
  ),
  ajuste as (
    select c.*, (c.monto_total - sum(c.monto_base) over (partition by c.item_id))::integer residuo
    from calculo c
  )
  insert into public.obra_liquidaciones (
    empresa, obra_id, obra_nombre, trabajador, periodo, num_folio, monto_real, partida,
    nomina_id, nomina_item_id, trabajador_id, monto_liquidacion_total,
    dias_imputados, porcentaje_imputacion, criterio_imputacion
  )
  select v_empresa, a.obra_id, a.obra_nombre, a.trabajador_nombre, v_periodo,
    'NOM-' || p_nomina_id || '-' || a.item_id,
    a.monto_base + case when a.orden <= a.residuo then 1 else 0 end,
    'Gastos Generales', p_nomina_id, a.item_id, a.trabajador_id, a.monto_total,
    round(a.dias, 2), round(a.dias * 100 / nullif(a.total_dias, 0), 4), a.criterio
  from ajuste a;

  get diagnostics v_creadas = row_count;
  select count(*) into v_sin_destino from public.rrhh_nomina_items i
  where i.nomina_id = p_nomina_id
    and not exists (select 1 from public.obra_liquidaciones l where l.nomina_item_id = i.id);

  return jsonb_build_object('nomina_id', p_nomina_id, 'imputaciones_creadas', v_creadas,
    'trabajadores_sin_destino', v_sin_destino);
end;
$$;

revoke all on function public.distribuir_nomina_a_obras(bigint) from public, anon;
grant execute on function public.distribuir_nomina_a_obras(bigint) to authenticated;

comment on function public.distribuir_nomina_a_obras(bigint) is
  'Distribuye el costo de una nómina cerrada entre obras según asistencia diaria y, subsidiariamente, historial de asignaciones.';
