alter table public.costos_reales_obra enable row level security;

drop policy if exists "costos_reales_empresa_insert" on public.costos_reales_obra;
drop policy if exists "costos_reales_empresa_update" on public.costos_reales_obra;
drop policy if exists "costos_reales_empresa_delete" on public.costos_reales_obra;

create policy "costos_reales_empresa_insert"
on public.costos_reales_obra
for insert
to authenticated
with check (
  exists (
    select 1
    from public.usuarios u
    where u.auth_user_id = (select auth.uid())
      and (
        u.empresa = costos_reales_obra.empresa
        or lower(u.empresa) = 'obraxis'
      )
  )
);

create policy "costos_reales_empresa_update"
on public.costos_reales_obra
for update
to authenticated
using (
  exists (
    select 1
    from public.usuarios u
    where u.auth_user_id = (select auth.uid())
      and (
        u.empresa = costos_reales_obra.empresa
        or lower(u.empresa) = 'obraxis'
      )
  )
)
with check (
  exists (
    select 1
    from public.usuarios u
    where u.auth_user_id = (select auth.uid())
      and (
        u.empresa = costos_reales_obra.empresa
        or lower(u.empresa) = 'obraxis'
      )
  )
);

create policy "costos_reales_empresa_delete"
on public.costos_reales_obra
for delete
to authenticated
using (
  exists (
    select 1
    from public.usuarios u
    where u.auth_user_id = (select auth.uid())
      and (
        u.empresa = costos_reales_obra.empresa
        or lower(u.empresa) = 'obraxis'
      )
  )
);
