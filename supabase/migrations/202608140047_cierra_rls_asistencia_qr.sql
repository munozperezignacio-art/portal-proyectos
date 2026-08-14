-- La función asistencia-publica usa service_role y token específico de obra.
-- El navegador autenticado conserva acceso únicamente a su empresa.
alter table public.obras enable row level security;
alter table public.maestro_personal enable row level security;
alter table public.asistencia_personal enable row level security;

do $$
declare policy_row record;
begin
  for policy_row in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in ('obras', 'maestro_personal', 'asistencia_personal')
  loop
    execute format('drop policy if exists %I on %I.%I', policy_row.policyname, policy_row.schemaname, policy_row.tablename);
  end loop;
end $$;

create policy obras_empresa on public.obras
  for all to authenticated
  using (private.obraxis_actor_can_access_company(empresa))
  with check (private.obraxis_actor_can_access_company(empresa));

create policy maestro_personal_empresa on public.maestro_personal
  for all to authenticated
  using (private.obraxis_actor_can_access_company(empresa))
  with check (private.obraxis_actor_can_access_company(empresa));

create policy asistencia_personal_empresa on public.asistencia_personal
  for all to authenticated
  using (private.obraxis_actor_can_access_company(empresa))
  with check (private.obraxis_actor_can_access_company(empresa));

revoke all on table public.obras from anon;
revoke all on table public.maestro_personal from anon;
revoke all on table public.asistencia_personal from anon;

grant select, insert, update, delete on table public.obras to authenticated;
grant select, insert, update, delete on table public.maestro_personal to authenticated;
grant select, insert, update, delete on table public.asistencia_personal to authenticated;

