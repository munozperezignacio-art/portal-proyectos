-- Conserva la identidad y los coeficientes originales de los recursos FIEBDC/BC3.
alter table public.recursos_presupuesto
  add column if not exists codigo_origen text,
  add column if not exists tipo_bc3 text,
  add column if not exists fecha_precio text,
  add column if not exists indicadores_ambientales jsonb not null default '{}'::jsonb;

alter table public.presupuestos_items_recursos
  add column if not exists factor_descomposicion numeric,
  add column if not exists cantidad_descomposicion numeric;

create index if not exists recursos_presupuesto_codigo_origen_idx
  on public.recursos_presupuesto (presupuesto_id, codigo_origen);

create or replace function public.importar_presupuesto_bc3_detallado(
  p_presupuesto_id integer,
  p_items jsonb,
  p_recursos jsonb,
  p_moneda_base text default 'CLP',
  p_origen text default 'PRESTO_BC3'
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_resultado jsonb;
  v_recurso jsonb;
  v_item_id integer;
  v_link_id integer;
  v_recurso_id integer;
begin
  v_resultado := public.importar_presupuesto_jerarquico(
    p_presupuesto_id, p_items, p_recursos, p_moneda_base, p_origen
  );

  for v_recurso in select value from jsonb_array_elements(coalesce(p_recursos, '[]'::jsonb))
  loop
    select item.id into v_item_id
    from public.presupuestos_items item
    where item.presupuesto_id = p_presupuesto_id
      and item.codigo = v_recurso->>'codigo_partida'
    order by item.id desc limit 1;

    select enlace.id, recurso.id into v_link_id, v_recurso_id
    from public.presupuestos_items_recursos enlace
    join public.recursos_presupuesto recurso on recurso.id = enlace.recurso_id
    where enlace.item_id = v_item_id
      and lower(recurso.recurso) = lower(v_recurso->>'recurso')
      and lower(coalesce(recurso.tipo, '')) = lower(coalesce(v_recurso->>'tipo', ''))
      and recurso.costo_unitario = coalesce((v_recurso->>'costo_unitario')::numeric, 0)
    order by enlace.id desc limit 1;

    if v_recurso_id is not null then
      update public.recursos_presupuesto
      set codigo_origen = nullif(v_recurso->>'codigo_recurso', ''),
          tipo_bc3 = nullif(v_recurso->>'tipo_bc3', ''),
          fecha_precio = nullif(v_recurso->>'fecha_precio', ''),
          indicadores_ambientales = coalesce(v_recurso->'indicadores_ambientales', '{}'::jsonb)
      where id = v_recurso_id;

      update public.presupuestos_items_recursos
      set factor_descomposicion = nullif((v_recurso->>'factor_descomposicion')::numeric, 0),
          cantidad_descomposicion = nullif((v_recurso->>'cantidad_descomposicion')::numeric, 0)
      where id = v_link_id;
    end if;
    v_item_id := null; v_link_id := null; v_recurso_id := null;
  end loop;

  return v_resultado || jsonb_build_object('formato', 'FIEBDC/BC3', 'detalle_recursos', true);
end;
$$;

revoke all on function public.importar_presupuesto_bc3_detallado(integer,jsonb,jsonb,text,text) from public, anon;
grant execute on function public.importar_presupuesto_bc3_detallado(integer,jsonb,jsonb,text,text) to authenticated, service_role;
