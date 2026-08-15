alter table public.condiciones_pago_obra enable row level security;
drop policy if exists "Allow_All_Operations_Anon_Authenticated" on public.condiciones_pago_obra;

create policy condiciones_pago_select_empresa on public.condiciones_pago_obra
  for select to authenticated
  using ((select private.obraxis_actor_can_access_company(empresa)));
create policy condiciones_pago_insert_admin on public.condiciones_pago_obra
  for insert to authenticated
  with check ((select private.obraxis_actor_can_manage_company(empresa)));
create policy condiciones_pago_update_admin on public.condiciones_pago_obra
  for update to authenticated
  using ((select private.obraxis_actor_can_manage_company(empresa)))
  with check ((select private.obraxis_actor_can_manage_company(empresa)));
create policy condiciones_pago_delete_admin on public.condiciones_pago_obra
  for delete to authenticated
  using ((select private.obraxis_actor_can_manage_company(empresa)));

revoke all on public.condiciones_pago_obra from anon;
grant select, insert, update, delete on public.condiciones_pago_obra to authenticated;

;
