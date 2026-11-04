alter table public.maestro_personal add column otras_asignaciones jsonb not null default '[]'::jsonb;

create function private.rrhh_asignaciones_validas(p_rows jsonb) returns boolean
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
  end loop;
  return true;
end; $$;
revoke all on function private.rrhh_asignaciones_validas(jsonb) from public,anon;
grant execute on function private.rrhh_asignaciones_validas(jsonb) to authenticated;
alter table public.maestro_personal add constraint maestro_personal_asignaciones_validas check(private.rrhh_asignaciones_validas(otras_asignaciones));

-- Preserve the existing salary, employer-charge and payroll replacement rules.
alter function private.rrhh_calcular_costo_dia(bigint,numeric,numeric,numeric) rename to rrhh_calcular_costo_dia_sin_asignaciones;
revoke all on function private.rrhh_calcular_costo_dia_sin_asignaciones(bigint,numeric,numeric,numeric) from public,anon,authenticated;
create function private.rrhh_calcular_costo_dia(p_id bigint,p_imponible numeric,p_no_imponible numeric,p_horas numeric default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d jsonb; items jsonb; imp numeric; noimp numeric;
begin
  select coalesce(jsonb_agg(a),'[]'),coalesce(sum(case when a->>'tipo'='imponible' then round((a->>'monto')::numeric/30,2) else 0 end),0),
    coalesce(sum(case when a->>'tipo'='no_imponible' then round((a->>'monto')::numeric/30,2) else 0 end),0)
  into items,imp,noimp from public.rrhh_imputaciones_diarias t
  join public.maestro_personal p on p.id=t.trabajador_id and p.empresa=t.empresa
  cross join lateral jsonb_array_elements(p.otras_asignaciones) a
  where t.id=p_id and a->>'desde'<=to_char(t.fecha,'YYYY-MM') and (a->>'hasta' is null or a->>'hasta'>=to_char(t.fecha,'YYYY-MM'));
  d:=private.rrhh_calcular_costo_dia_sin_asignaciones(p_id,coalesce(p_imponible,0)+imp,coalesce(p_no_imponible,0)+noimp,p_horas);
  -- Keep discretionary daily inputs separate to avoid double counting on approval.
  return d||jsonb_build_object('haber_imponible',coalesce(p_imponible,0),'haber_no_imponible',coalesce(p_no_imponible,0),
    'asignaciones_imponibles',imp,'asignaciones_no_imponibles',noimp,'otras_asignaciones',items,
    'evidencia',coalesce(d->'evidencia','{}')||jsonb_build_object('otras_asignaciones',items));
end; $$;
revoke all on function private.rrhh_calcular_costo_dia(bigint,numeric,numeric,numeric) from public,anon,authenticated;
notify pgrst,'reload schema';
