
create schema if not exists private;

create or replace function private.usuario_puede_empresa(p_empresa text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.usuarios usuario
    where usuario.auth_user_id = (select auth.uid())
      and (
        lower(usuario.empresa) = lower(p_empresa)
        or lower(coalesce(usuario.rol_base, usuario.rol, '')) in ('superusuario', 'superadmin')
      )
  );
$$;

revoke all on function private.usuario_puede_empresa(text) from public, anon;
grant usage on schema private to authenticated, service_role;
grant execute on function private.usuario_puede_empresa(text) to authenticated, service_role;

alter table public.presupuestos_proyectos enable row level security;
alter table public.presupuestos_items enable row level security;
alter table public.recursos_presupuesto enable row level security;
alter table public.presupuestos_items_recursos enable row level security;
alter table public.presupuestos_costos_indirectos enable row level security;
alter table public.planificacion_cronogramas enable row level security;

drop policy if exists "Allow_All_Operations_Anon_Authenticated" on public.presupuestos_proyectos;
drop policy if exists "Allow_All_Operations_Anon_Authenticated" on public.presupuestos_items;
drop policy if exists "Allow_All_Operations_Anon_Authenticated" on public.recursos_presupuesto;
drop policy if exists "Allow_All_Operations_Anon_Authenticated" on public.presupuestos_items_recursos;
drop policy if exists "Allow_All_Operations_Anon_Authenticated" on public.presupuestos_costos_indirectos;
drop policy if exists "Allow_All_Operations_Anon_Authenticated" on public.planificacion_cronogramas;

create policy presupuestos_proyectos_empresa on public.presupuestos_proyectos
for all to authenticated
using ((select private.usuario_puede_empresa(empresa)))
with check ((select private.usuario_puede_empresa(empresa)));

create policy presupuestos_items_empresa on public.presupuestos_items
for all to authenticated
using (exists (
  select 1 from public.presupuestos_proyectos proyecto
  where proyecto.id = presupuestos_items.presupuesto_id
    and (select private.usuario_puede_empresa(proyecto.empresa))
))
with check (exists (
  select 1 from public.presupuestos_proyectos proyecto
  where proyecto.id = presupuestos_items.presupuesto_id
    and (select private.usuario_puede_empresa(proyecto.empresa))
));

create policy recursos_presupuesto_empresa on public.recursos_presupuesto
for all to authenticated
using (exists (
  select 1 from public.presupuestos_proyectos proyecto
  where proyecto.id = recursos_presupuesto.presupuesto_id
    and (select private.usuario_puede_empresa(proyecto.empresa))
))
with check (exists (
  select 1 from public.presupuestos_proyectos proyecto
  where proyecto.id = recursos_presupuesto.presupuesto_id
    and (select private.usuario_puede_empresa(proyecto.empresa))
));

create policy presupuestos_items_recursos_empresa on public.presupuestos_items_recursos
for all to authenticated
using (exists (
  select 1
  from public.presupuestos_items item
  join public.presupuestos_proyectos proyecto on proyecto.id = item.presupuesto_id
  where item.id = presupuestos_items_recursos.item_id
    and (select private.usuario_puede_empresa(proyecto.empresa))
))
with check (exists (
  select 1
  from public.presupuestos_items item
  join public.presupuestos_proyectos proyecto on proyecto.id = item.presupuesto_id
  where item.id = presupuestos_items_recursos.item_id
    and (select private.usuario_puede_empresa(proyecto.empresa))
));

create policy presupuestos_costos_indirectos_empresa on public.presupuestos_costos_indirectos
for all to authenticated
using (exists (
  select 1 from public.presupuestos_proyectos proyecto
  where proyecto.id = presupuestos_costos_indirectos.presupuesto_id
    and (select private.usuario_puede_empresa(proyecto.empresa))
))
with check (exists (
  select 1 from public.presupuestos_proyectos proyecto
  where proyecto.id = presupuestos_costos_indirectos.presupuesto_id
    and (select private.usuario_puede_empresa(proyecto.empresa))
));

create policy planificacion_cronogramas_empresa on public.planificacion_cronogramas
for all to authenticated
using (exists (
  select 1 from public.presupuestos_proyectos proyecto
  where proyecto.id = planificacion_cronogramas.presupuesto_id
    and (select private.usuario_puede_empresa(proyecto.empresa))
))
with check (exists (
  select 1 from public.presupuestos_proyectos proyecto
  where proyecto.id = planificacion_cronogramas.presupuesto_id
    and (select private.usuario_puede_empresa(proyecto.empresa))
));

;
