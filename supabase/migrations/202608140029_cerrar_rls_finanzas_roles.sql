do $$
declare
  target_table text;
  existing_policy record;
begin
  foreach target_table in array array[
    'facturacion_centros_gestion',
    'facturacion_config',
    'facturacion_documentos',
    'facturacion_folios',
    'facturacion_ordenes_compra',
    'facturacion_proveedores',
    'facturacion_recepciones',
    'facturacion_secciones',
    'obra_presupuestos'
  ]
  loop
    execute format('alter table public.%I enable row level security', target_table);
    for existing_policy in
      select policyname
      from pg_policies
      where schemaname = 'public' and tablename = target_table
    loop
      execute format('drop policy %I on public.%I', existing_policy.policyname, target_table);
    end loop;

    execute format(
      'create policy %I on public.%I for all to authenticated using ((select private.obraxis_actor_can_access_company(empresa))) with check ((select private.obraxis_actor_can_access_company(empresa)))',
      target_table || '_empresa',
      target_table
    );
    execute format('revoke all on public.%I from anon, authenticated', target_table);
    execute format('grant select, insert, update, delete on public.%I to authenticated', target_table);
  end loop;
end;
$$;

alter table public.roles enable row level security;

do $$
declare existing_policy record;
begin
  for existing_policy in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'roles'
  loop
    execute format('drop policy %I on public.roles', existing_policy.policyname);
  end loop;
end;
$$;

create policy roles_select_empresa
on public.roles for select to authenticated
using ((select private.obraxis_actor_can_access_company(empresa)));

create policy roles_insert_empresa
on public.roles for insert to authenticated
with check ((select private.obraxis_actor_can_manage_company(empresa)));

create policy roles_update_empresa
on public.roles for update to authenticated
using ((select private.obraxis_actor_can_manage_company(empresa)))
with check ((select private.obraxis_actor_can_manage_company(empresa)));

create policy roles_delete_empresa
on public.roles for delete to authenticated
using ((select private.obraxis_actor_can_manage_company(empresa)));

revoke all on public.roles from anon, authenticated;
grant select, insert, update, delete on public.roles to authenticated;
