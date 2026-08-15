alter table public.reporte_maquinaria add column if not exists empresa text;
alter table public.inventario_materiales add column if not exists empresa text;
alter table public.planificacion_tareas add column if not exists empresa text;
alter table public.reporte_maquinaria alter column empresa set not null;
alter table public.inventario_materiales alter column empresa set not null;
alter table public.planificacion_tareas alter column empresa set not null;
create index if not exists reporte_maquinaria_empresa_obra_idx on public.reporte_maquinaria(empresa,obra_nombre,created_at desc);
create index if not exists inventario_materiales_empresa_obra_idx on public.inventario_materiales(empresa,obra_nombre,created_at desc);
create index if not exists planificacion_tareas_empresa_obra_idx on public.planificacion_tareas(empresa,obra_nombre,fecha_inicio);

alter table public.reporte_maquinaria enable row level security;
alter table public.inventario_materiales enable row level security;
alter table public.planificacion_tareas enable row level security;
drop policy if exists "Allow_All_Operations_Anon_Authenticated" on public.reporte_maquinaria;
drop policy if exists "Allow_All_Operations_Anon_Authenticated" on public.inventario_materiales;
drop policy if exists "Allow_All_Operations_Anon_Authenticated" on public.planificacion_tareas;
create policy reporte_maquinaria_empresa on public.reporte_maquinaria for all to authenticated using ((select private.obraxis_actor_can_access_company(empresa))) with check ((select private.obraxis_actor_can_access_company(empresa)));
create policy inventario_materiales_empresa on public.inventario_materiales for all to authenticated using ((select private.obraxis_actor_can_access_company(empresa))) with check ((select private.obraxis_actor_can_access_company(empresa)));
create policy planificacion_tareas_empresa on public.planificacion_tareas for all to authenticated using ((select private.obraxis_actor_can_access_company(empresa))) with check ((select private.obraxis_actor_can_access_company(empresa)));
revoke all on public.reporte_maquinaria,public.inventario_materiales,public.planificacion_tareas from anon;
grant select,insert,update,delete on public.reporte_maquinaria,public.inventario_materiales,public.planificacion_tareas to authenticated;

;
