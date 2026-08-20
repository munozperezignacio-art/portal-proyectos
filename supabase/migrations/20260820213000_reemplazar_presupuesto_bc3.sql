-- Reemplaza un presupuesto BC3 completo dentro de una sola transacción.
create or replace function public.reemplazar_presupuesto_bc3_completo(
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
  v_anteriores integer;
  v_empresa text;
begin
  if (select auth.uid()) is null then raise exception 'Sesión requerida.'; end if;

  select proyecto.empresa into v_empresa
  from public.presupuestos_proyectos proyecto where proyecto.id = p_presupuesto_id;
  if v_empresa is null then raise exception 'Presupuesto no encontrado.'; end if;
  if not exists (
    select 1 from public.usuarios usuario
    where usuario.auth_user_id = (select auth.uid())
      and (lower(usuario.empresa) = lower(v_empresa)
        or lower(coalesce(usuario.rol_base, usuario.rol, '')) in ('superusuario','superadmin'))
  ) then raise exception 'No autorizado para reemplazar este presupuesto.'; end if;

  select count(*) into v_anteriores
  from public.presupuestos_items where presupuesto_id = p_presupuesto_id;

  delete from public.partidas_obra obra
  where obra.presupuesto_item_id in (
    select item.id from public.presupuestos_items item where item.presupuesto_id = p_presupuesto_id
  );
  delete from public.presupuestos_items where presupuesto_id = p_presupuesto_id;
  delete from public.recursos_presupuesto where presupuesto_id = p_presupuesto_id;
  delete from public.presupuestos_costos_indirectos where presupuesto_id = p_presupuesto_id;

  v_resultado := public.importar_presupuesto_bc3_completo(
    p_presupuesto_id, p_items, p_recursos, p_globales, p_moneda_base, p_origen
  );
  return v_resultado || jsonb_build_object('modo', 'REEMPLAZAR', 'elementos_reemplazados', v_anteriores);
end;
$$;

revoke all on function public.reemplazar_presupuesto_bc3_completo(integer,jsonb,jsonb,jsonb,text,text) from public, anon;
grant execute on function public.reemplazar_presupuesto_bc3_completo(integer,jsonb,jsonb,jsonb,text,text) to authenticated, service_role;
