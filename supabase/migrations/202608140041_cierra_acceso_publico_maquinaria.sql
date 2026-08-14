alter table public.inventario_maquinaria alter column empresa set not null;
alter table public.maquinaria_uso_diario alter column empresa set not null;
alter table public.maquinaria_reservas alter column empresa set not null;
create index if not exists maquinaria_uso_empresa_equipo_fecha_idx on public.maquinaria_uso_diario(empresa,equipo_id,fecha desc);
create index if not exists maquinaria_reservas_empresa_fechas_idx on public.maquinaria_reservas(empresa,fecha_inicio,fecha_fin);

alter table public.inventario_maquinaria enable row level security;
alter table public.maquinaria_uso_diario enable row level security;
alter table public.maquinaria_reservas enable row level security;
drop policy if exists "Allow_All_Operations_Anon_Authenticated" on public.inventario_maquinaria;
drop policy if exists "Permitir insert total en maquinaria_uso_diario" on public.maquinaria_uso_diario;
drop policy if exists "Permitir select total en maquinaria_uso_diario" on public.maquinaria_uso_diario;
drop policy if exists "Permitir insert total en maquinaria_reservas" on public.maquinaria_reservas;
drop policy if exists "Permitir select total en maquinaria_reservas" on public.maquinaria_reservas;

create policy inventario_maquinaria_empresa on public.inventario_maquinaria for all to authenticated
  using ((select private.obraxis_actor_can_access_company(empresa)))
  with check ((select private.obraxis_actor_can_access_company(empresa)));
create policy maquinaria_uso_empresa on public.maquinaria_uso_diario for all to authenticated
  using ((select private.obraxis_actor_can_access_company(empresa)))
  with check ((select private.obraxis_actor_can_access_company(empresa)));
create policy maquinaria_reservas_empresa on public.maquinaria_reservas for all to authenticated
  using ((select private.obraxis_actor_can_access_company(empresa)))
  with check ((select private.obraxis_actor_can_access_company(empresa)));

revoke all on public.inventario_maquinaria, public.maquinaria_uso_diario, public.maquinaria_reservas from anon;
grant select,insert,update,delete on public.inventario_maquinaria, public.maquinaria_uso_diario, public.maquinaria_reservas to authenticated;
