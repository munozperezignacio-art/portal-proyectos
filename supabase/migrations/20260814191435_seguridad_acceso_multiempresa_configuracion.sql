-- Endurece el acceso multiempresa y la configuraciÃ³n corporativa.

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
        or (
          lower(usuario.empresa) = 'obraxis'
          and lower(coalesce(usuario.rol_base, usuario.rol, '')) in ('superusuario', 'superadmin')
        )
      )
  );
$$;
revoke all on function private.usuario_puede_empresa(text) from public, anon;
grant execute on function private.usuario_puede_empresa(text) to authenticated, service_role;

alter table public.config_empresa enable row level security;
drop policy if exists "Allow_All_config_empresa" on public.config_empresa;
drop policy if exists config_empresa_select_empresa on public.config_empresa;
drop policy if exists config_empresa_insert_admin on public.config_empresa;
drop policy if exists config_empresa_update_admin on public.config_empresa;
drop policy if exists config_empresa_delete_admin on public.config_empresa;
create policy config_empresa_select_empresa on public.config_empresa
  for select to authenticated
  using ((select private.obraxis_actor_can_access_company(empresa)));
create policy config_empresa_insert_admin on public.config_empresa
  for insert to authenticated
  with check ((select private.obraxis_actor_can_manage_company(empresa)));
create policy config_empresa_update_admin on public.config_empresa
  for update to authenticated
  using ((select private.obraxis_actor_can_manage_company(empresa)))
  with check ((select private.obraxis_actor_can_manage_company(empresa)));
create policy config_empresa_delete_admin on public.config_empresa
  for delete to authenticated
  using ((select private.obraxis_actor_can_manage_company(empresa)));
revoke all on public.config_empresa from anon;
grant select, insert, update, delete on public.config_empresa to authenticated;

;
