-- El borrado desde una obra elimina también el ítem maestro y sus dependencias.
create or replace function public.eliminar_partida_presupuesto_obra(
  p_partida_obra_id bigint,
  p_incluir_descendientes boolean default false
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_master_id integer;
  v_presupuesto_id integer;
  v_work_deleted integer := 0;
  v_master_deleted integer := 0;
  v_resources_deleted integer := 0;
begin
  if (select auth.uid()) is null then raise exception 'Sesión requerida.'; end if;

  select obra.presupuesto_item_id, item.presupuesto_id
    into v_master_id, v_presupuesto_id
  from public.partidas_obra obra
  left join public.presupuestos_items item on item.id = obra.presupuesto_item_id
  where obra.id = p_partida_obra_id;

  if not found then raise exception 'Partida de obra no encontrada o sin autorización.'; end if;

  if v_master_id is null then
    delete from public.partidas_obra where id = p_partida_obra_id;
    get diagnostics v_work_deleted = row_count;
    return jsonb_build_object('partidas_obra', v_work_deleted, 'items_maestros', 0, 'recursos_huerfanos', 0);
  end if;

  create temporary table tmp_items_eliminar (id integer primary key) on commit drop;
  if p_incluir_descendientes then
    insert into tmp_items_eliminar
    with recursive descendientes as (
      select id from public.presupuestos_items where id = v_master_id
      union all
      select hijo.id from public.presupuestos_items hijo join descendientes padre on hijo.parent_id = padre.id
    ) select id from descendientes;
  else
    if exists (select 1 from public.presupuestos_items where parent_id = v_master_id) then
      raise exception 'El capítulo contiene elementos. Debe eliminarse con sus descendientes.';
    end if;
    insert into tmp_items_eliminar values (v_master_id);
  end if;

  delete from public.partidas_obra obra
  using tmp_items_eliminar objetivo
  where obra.presupuesto_item_id = objetivo.id;
  get diagnostics v_work_deleted = row_count;

  delete from public.presupuestos_items item
  using tmp_items_eliminar objetivo
  where item.id = objetivo.id;
  get diagnostics v_master_deleted = row_count;

  delete from public.recursos_presupuesto recurso
  where recurso.presupuesto_id = v_presupuesto_id
    and not exists (select 1 from public.presupuestos_items_recursos enlace where enlace.recurso_id = recurso.id);
  get diagnostics v_resources_deleted = row_count;

  if not exists (select 1 from public.presupuestos_items where presupuesto_id = v_presupuesto_id) then
    delete from public.presupuestos_costos_indirectos where presupuesto_id = v_presupuesto_id;
  end if;

  return jsonb_build_object('partidas_obra', v_work_deleted, 'items_maestros', v_master_deleted, 'recursos_huerfanos', v_resources_deleted);
end;
$$;

revoke all on function public.eliminar_partida_presupuesto_obra(bigint,boolean) from public, anon;
grant execute on function public.eliminar_partida_presupuesto_obra(bigint,boolean) to authenticated, service_role;
