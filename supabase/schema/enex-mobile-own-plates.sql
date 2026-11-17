-- Permite consultar las patentes propias aunque no haya movimientos pendientes.
drop policy if exists enex_read_own_vehicles on public.enex_owners;
create policy enex_read_own_vehicles on public.enex_owners for select to authenticated
using (owner_id = (select auth.uid()) and exists (select 1 from public.usuarios u
  where u.auth_user_id = (select auth.uid()) and u.empresa = enex_owners.empresa));
