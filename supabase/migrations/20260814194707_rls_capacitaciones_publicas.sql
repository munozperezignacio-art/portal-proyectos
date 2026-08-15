alter table public.prevencion_capacitaciones add column if not exists empresa text;
alter table public.prevencion_capacitaciones_intentos add column if not exists empresa text;

update public.prevencion_capacitaciones set empresa = 'Obraxis' where empresa is null;
update public.prevencion_capacitaciones_intentos i
set empresa = c.empresa
from public.prevencion_capacitaciones c
where i.capacitacion_id = c.id and i.empresa is null;

alter table public.prevencion_capacitaciones alter column empresa set not null;
alter table public.prevencion_capacitaciones_intentos alter column empresa set not null;
create index if not exists idx_prevencion_capacitaciones_empresa on public.prevencion_capacitaciones(empresa, created_at desc);
create index if not exists idx_prevencion_capacitaciones_intentos_empresa on public.prevencion_capacitaciones_intentos(empresa, created_at desc);

alter table public.prevencion_capacitaciones enable row level security;
alter table public.prevencion_capacitaciones_intentos enable row level security;
drop policy if exists "Acceso total capacitaciones" on public.prevencion_capacitaciones;
drop policy if exists "Allow_All_Operations_Anon_Authenticated" on public.prevencion_capacitaciones;
drop policy if exists "Acceso total intentos" on public.prevencion_capacitaciones_intentos;
drop policy if exists "Allow_All_Operations_Anon_Authenticated" on public.prevencion_capacitaciones_intentos;
create policy prevencion_capacitaciones_empresa on public.prevencion_capacitaciones for all to authenticated using (private.obraxis_actor_can_access_company(empresa)) with check (private.obraxis_actor_can_access_company(empresa));
create policy prevencion_capacitaciones_intentos_empresa on public.prevencion_capacitaciones_intentos for all to authenticated using (private.obraxis_actor_can_access_company(empresa)) with check (private.obraxis_actor_can_access_company(empresa));

revoke all on table public.prevencion_capacitaciones from anon;
revoke all on table public.prevencion_capacitaciones_intentos from anon;
grant select, insert, update, delete on table public.prevencion_capacitaciones to authenticated;
grant select, insert, update, delete on table public.prevencion_capacitaciones_intentos to authenticated;
;
