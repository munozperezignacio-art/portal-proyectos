-- Endurecimiento RLS posterior a schema_aislamiento_obras_legacy.sql.
-- Los clientes anónimos pueden consultar el catálogo de obras requerido por
-- formularios públicos, pero no pueden modificar obras, partidas ni avances.

alter table public.obras enable row level security;
alter table public.partidas_obra enable row level security;
alter table public.avances_produccion_partidas enable row level security;

drop policy if exists "Allow_All_Operations_Anon_Authenticated" on public.obras;
drop policy if exists "Allow_All_Operations_Anon_Authenticated" on public.partidas_obra;
drop policy if exists "Allow_All_Operations_Anon_Authenticated" on public.avances_produccion_partidas;

drop policy if exists obras_anon_select on public.obras;
create policy obras_anon_select on public.obras
for select to anon using (true);

drop policy if exists obras_empresa_select on public.obras;
create policy obras_empresa_select on public.obras
for select to authenticated
using (exists (
  select 1 from public.usuarios u
  where u.auth_user_id = (select auth.uid())
    and (u.empresa = obras.empresa or lower(u.empresa) = 'obraxis')
));

drop policy if exists obras_empresa_insert on public.obras;
create policy obras_empresa_insert on public.obras
for insert to authenticated
with check (exists (
  select 1 from public.usuarios u
  where u.auth_user_id = (select auth.uid())
    and (u.empresa = obras.empresa or lower(u.empresa) = 'obraxis')
));

drop policy if exists obras_empresa_update on public.obras;
create policy obras_empresa_update on public.obras
for update to authenticated
using (exists (
  select 1 from public.usuarios u
  where u.auth_user_id = (select auth.uid())
    and (u.empresa = obras.empresa or lower(u.empresa) = 'obraxis')
))
with check (exists (
  select 1 from public.usuarios u
  where u.auth_user_id = (select auth.uid())
    and (u.empresa = obras.empresa or lower(u.empresa) = 'obraxis')
));

drop policy if exists obras_empresa_delete on public.obras;
create policy obras_empresa_delete on public.obras
for delete to authenticated
using (exists (
  select 1 from public.usuarios u
  where u.auth_user_id = (select auth.uid())
    and (u.empresa = obras.empresa or lower(u.empresa) = 'obraxis')
));

drop policy if exists partidas_empresa_select on public.partidas_obra;
create policy partidas_empresa_select on public.partidas_obra
for select to authenticated
using (exists (
  select 1 from public.usuarios u
  where u.auth_user_id = (select auth.uid())
    and (u.empresa = partidas_obra.empresa or lower(u.empresa) = 'obraxis')
));

drop policy if exists partidas_empresa_insert on public.partidas_obra;
create policy partidas_empresa_insert on public.partidas_obra
for insert to authenticated
with check (exists (
  select 1 from public.usuarios u
  where u.auth_user_id = (select auth.uid())
    and (u.empresa = partidas_obra.empresa or lower(u.empresa) = 'obraxis')
));

drop policy if exists partidas_empresa_update on public.partidas_obra;
create policy partidas_empresa_update on public.partidas_obra
for update to authenticated
using (exists (
  select 1 from public.usuarios u
  where u.auth_user_id = (select auth.uid())
    and (u.empresa = partidas_obra.empresa or lower(u.empresa) = 'obraxis')
))
with check (exists (
  select 1 from public.usuarios u
  where u.auth_user_id = (select auth.uid())
    and (u.empresa = partidas_obra.empresa or lower(u.empresa) = 'obraxis')
));

drop policy if exists partidas_empresa_delete on public.partidas_obra;
create policy partidas_empresa_delete on public.partidas_obra
for delete to authenticated
using (exists (
  select 1 from public.usuarios u
  where u.auth_user_id = (select auth.uid())
    and (u.empresa = partidas_obra.empresa or lower(u.empresa) = 'obraxis')
));

drop policy if exists avances_empresa_select on public.avances_produccion_partidas;
create policy avances_empresa_select on public.avances_produccion_partidas
for select to authenticated
using (exists (
  select 1 from public.usuarios u
  where u.auth_user_id = (select auth.uid())
    and (u.empresa = avances_produccion_partidas.empresa or lower(u.empresa) = 'obraxis')
));

drop policy if exists avances_empresa_insert on public.avances_produccion_partidas;
create policy avances_empresa_insert on public.avances_produccion_partidas
for insert to authenticated
with check (exists (
  select 1 from public.usuarios u
  where u.auth_user_id = (select auth.uid())
    and (u.empresa = avances_produccion_partidas.empresa or lower(u.empresa) = 'obraxis')
));

drop policy if exists avances_empresa_update on public.avances_produccion_partidas;
create policy avances_empresa_update on public.avances_produccion_partidas
for update to authenticated
using (exists (
  select 1 from public.usuarios u
  where u.auth_user_id = (select auth.uid())
    and (u.empresa = avances_produccion_partidas.empresa or lower(u.empresa) = 'obraxis')
))
with check (exists (
  select 1 from public.usuarios u
  where u.auth_user_id = (select auth.uid())
    and (u.empresa = avances_produccion_partidas.empresa or lower(u.empresa) = 'obraxis')
));

drop policy if exists avances_empresa_delete on public.avances_produccion_partidas;
create policy avances_empresa_delete on public.avances_produccion_partidas
for delete to authenticated
using (exists (
  select 1 from public.usuarios u
  where u.auth_user_id = (select auth.uid())
    and (u.empresa = avances_produccion_partidas.empresa or lower(u.empresa) = 'obraxis')
));

revoke all privileges on public.obras, public.partidas_obra, public.avances_produccion_partidas from anon;
revoke truncate, references, trigger on public.obras, public.partidas_obra, public.avances_produccion_partidas from authenticated;
grant select on public.obras to anon;
grant select, insert, update, delete on public.obras, public.partidas_obra, public.avances_produccion_partidas to authenticated;
