-- Conserva la trazabilidad de los costos generales importados desde Presto/BC3.
alter table public.presupuestos_costos_indirectos
  add column if not exists codigo_origen text,
  add column if not exists origen_importacion text not null default 'MANUAL';

create or replace function public.importar_presupuesto_bc3_completo(
  p_presupuesto_id integer,
  p_items jsonb,
  p_recursos jsonb,
  p_globales jsonb default '[]'::jsonb,
  p_moneda_base text default 'CLP',
  p_origen text default 'PRESTO_BC3'
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_resultado jsonb;
  v_global jsonb;
  v_globales_insertados integer := 0;
begin
  v_resultado := public.importar_presupuesto_bc3_detallado(
    p_presupuesto_id, p_items, p_recursos, p_moneda_base, p_origen
  );

  for v_global in select value from jsonb_array_elements(coalesce(p_globales, '[]'::jsonb))
  loop
    if not exists (
      select 1 from public.presupuestos_costos_indirectos costo
      where costo.presupuesto_id = p_presupuesto_id
        and lower(costo.concepto) = lower(v_global->>'concepto')
        and lower(coalesce(costo.tipo, '')) = lower(coalesce(v_global->>'tipo', 'Porcentaje'))
        and costo.valor = coalesce((v_global->>'valor')::numeric, 0)
    ) then
      insert into public.presupuestos_costos_indirectos (
        presupuesto_id, concepto, tipo, valor, codigo_origen, origen_importacion
      ) values (
        p_presupuesto_id,
        v_global->>'concepto',
        coalesce(nullif(v_global->>'tipo', ''), 'Porcentaje'),
        coalesce((v_global->>'valor')::numeric, 0),
        nullif(v_global->>'codigo_origen', ''),
        p_origen
      );
      v_globales_insertados := v_globales_insertados + 1;
    end if;
  end loop;

  return v_resultado || jsonb_build_object('costos_globales', v_globales_insertados);
end;
$$;

revoke all on function public.importar_presupuesto_bc3_completo(integer,jsonb,jsonb,jsonb,text,text) from public, anon;
grant execute on function public.importar_presupuesto_bc3_completo(integer,jsonb,jsonb,jsonb,text,text) to authenticated, service_role;
