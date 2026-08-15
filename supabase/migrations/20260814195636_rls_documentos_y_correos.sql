alter table public.config_correos add column if not exists empresa text;
update public.config_correos set empresa='Obraxis' where empresa is null;
alter table public.config_correos alter column empresa set not null;
create index if not exists idx_config_correos_empresa_tipo on public.config_correos(empresa,tipo);

alter table public.config_correos enable row level security;
drop policy if exists "Allow_All_Operations_Anon_Authenticated" on public.config_correos;
create policy config_correos_empresa on public.config_correos for all to authenticated using (private.obraxis_actor_can_access_company(empresa)) with check (private.obraxis_actor_can_access_company(empresa));

alter table public.estados_pago_obra enable row level security;
drop policy if exists "Allow_All_Operations_Anon_Authenticated" on public.estados_pago_obra;
create policy estados_pago_obra_empresa on public.estados_pago_obra for all to authenticated using (private.obraxis_actor_can_access_company(empresa)) with check (private.obraxis_actor_can_access_company(empresa));
create index if not exists idx_estados_pago_obra_empresa_obra on public.estados_pago_obra(empresa,obra_nombre,numero);

alter table public.libro_obra_digital enable row level security;
drop policy if exists "Allow_All_Operations_Anon_Authenticated" on public.libro_obra_digital;
create policy libro_obra_digital_empresa on public.libro_obra_digital for all to authenticated using (private.obraxis_actor_can_access_company(empresa)) with check (private.obraxis_actor_can_access_company(empresa));
create index if not exists idx_libro_obra_digital_empresa_obra on public.libro_obra_digital(empresa,obra_nombre,fecha desc);

revoke all on table public.config_correos,public.estados_pago_obra,public.libro_obra_digital from anon;
grant select,insert,update,delete on table public.config_correos,public.estados_pago_obra,public.libro_obra_digital to authenticated;
;
