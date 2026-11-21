-- Optional mode preserves existing allocations and closed payroll snapshots.
create or replace function private.rrhh_asignaciones_validas(p_rows jsonb) returns boolean
language plpgsql immutable security invoker set search_path='' as $$
declare r jsonb;
begin
  if p_rows is null or jsonb_typeof(p_rows)<>'array' then return false; end if;
  if jsonb_array_length(p_rows)>50 then return false; end if;
  for r in select value from jsonb_array_elements(p_rows) loop
    if jsonb_typeof(r)<>'object' or not (r ?& array['nombre','monto','tipo','desde']) then return false; end if;
    if jsonb_typeof(r->'nombre')<>'string' or length(trim(r->>'nombre')) not between 1 and 160
      or jsonb_typeof(r->'monto')<>'number' or (r->>'monto')::numeric not between 1 and 1000000000
      or (r->>'monto')::numeric<>trunc((r->>'monto')::numeric)
      or coalesce(r->>'tipo','') not in ('imponible','no_imponible')
      or coalesce(r->>'desde','') !~ '^[12][0-9]{3}-(0[1-9]|1[0-2])$'
      or (r->>'hasta' is not null and (r->>'hasta' !~ '^[12][0-9]{3}-(0[1-9]|1[0-2])$' or r->>'hasta'<r->>'desde')) then return false; end if;
    if r->'nombre'='null'::jsonb or r->'monto'='null'::jsonb then return false; end if;
    if r ? 'calculo' and (jsonb_typeof(r->'calculo')<>'string' or coalesce(r->>'calculo','') not in ('marcajes','completo')) then return false; end if;
  end loop;
  return true;
end; $$;
revoke all on function private.rrhh_asignaciones_validas(jsonb) from public,anon;
grant execute on function private.rrhh_asignaciones_validas(jsonb) to authenticated;

create or replace function private.rrhh_calcular_costo_dia(p_id bigint,p_imponible numeric,p_no_imponible numeric,p_horas numeric default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d jsonb; items jsonb; imp numeric; noimp numeric;
begin
  select coalesce(jsonb_agg(a),'[]'),
    coalesce(sum(case when a->>'tipo'='imponible' then amount else 0 end),0),
    coalesce(sum(case when a->>'tipo'='no_imponible' then amount else 0 end),0)
  into items,imp,noimp from public.rrhh_imputaciones_diarias t
  join public.maestro_personal p on p.id=t.trabajador_id and p.empresa=t.empresa
  cross join lateral jsonb_array_elements(p.otras_asignaciones) a
  cross join lateral (select round((a->>'monto')::numeric /
    case when a->>'calculo'='completo' then extract(day from date_trunc('month',t.fecha)+interval '1 month - 1 day') else 30 end *
    case when a->>'calculo'='marcajes' and not exists(
      select 1 from public.asistencia_personal m where m.empresa=t.empresa
        and regexp_replace(upper(m.rut),'[^0-9K]','','g')=regexp_replace(upper(p.rut),'[^0-9K]','','g')
        and nullif(regexp_replace(upper(p.rut),'[^0-9K]','','g'),'') is not null
        and m.fecha_marcacion=t.fecha and m.asistencia ~* '^(presente|asisti|trabaj)'
    ) then 0 else 1 end,2) amount) calc
  where t.id=p_id and a->>'desde'<=to_char(t.fecha,'YYYY-MM') and (a->>'hasta' is null or a->>'hasta'>=to_char(t.fecha,'YYYY-MM'));
  d:=private.rrhh_calcular_costo_dia_sin_asignaciones(p_id,coalesce(p_imponible,0)+imp,coalesce(p_no_imponible,0)+noimp,p_horas);
  return d||jsonb_build_object('haber_imponible',coalesce(p_imponible,0),'haber_no_imponible',coalesce(p_no_imponible,0),
    'asignaciones_imponibles',imp,'asignaciones_no_imponibles',noimp,'otras_asignaciones',items,
    'evidencia',coalesce(d->'evidencia','{}')||jsonb_build_object('otras_asignaciones',items));
end; $$;
revoke all on function private.rrhh_calcular_costo_dia(bigint,numeric,numeric,numeric) from public,anon,authenticated;
notify pgrst,'reload schema';
