alter table public.recursos_presupuesto
  add column if not exists categoria text;

update public.recursos_presupuesto
set categoria = 'Sin categoría'
where nullif(trim(categoria), '') is null;

alter table public.recursos_presupuesto
  alter column categoria set default 'Sin categoría',
  alter column categoria set not null;

create index if not exists recursos_presupuesto_categoria_idx
  on public.recursos_presupuesto (presupuesto_id, categoria);

create or replace function public.importar_presupuesto_excel_v2(
  p_presupuesto_id integer,
  p_partidas jsonb,
  p_recursos jsonb,
  p_moneda_base text default 'CLP'
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_resultado jsonb;
  v_recurso jsonb;
begin
  v_resultado := public.importar_presupuesto_excel(p_presupuesto_id, p_partidas, p_recursos, p_moneda_base);

  for v_recurso in select value from jsonb_array_elements(coalesce(p_recursos, '[]'::jsonb))
  loop
    update public.recursos_presupuesto recurso
    set categoria = coalesce(nullif(trim(v_recurso->>'categoria'), ''), 'Sin categoría')
    where recurso.presupuesto_id = p_presupuesto_id
      and lower(recurso.recurso) = lower(v_recurso->>'recurso')
      and lower(recurso.tipo) = lower(v_recurso->>'tipo')
      and lower(split_part(recurso.unidad, '|', 1)) = lower(v_recurso->>'unidad')
      and recurso.costo_unitario = coalesce((v_recurso->>'costo_unitario')::numeric, 0);
  end loop;

  return v_resultado || jsonb_build_object('categorias_actualizadas', true);
end;
$$;

revoke all on function public.importar_presupuesto_excel_v2(integer,jsonb,jsonb,text) from public, anon;
grant execute on function public.importar_presupuesto_excel_v2(integer,jsonb,jsonb,text) to authenticated, service_role;
