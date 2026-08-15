-- Auditoría estructural no destructiva para ejecutar contra una base Obraxis.
-- Falla si una tabla pública queda sin RLS, aparece una política abierta o una
-- clave foránea carece de un índice que comience por las mismas columnas.

do $$
declare
  failures text;
begin
  select string_agg(format('%I.%I', n.nspname, c.relname), ', ')
    into failures
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and not c.relrowsecurity;

  if failures is not null then
    raise exception 'Tablas públicas sin RLS: %', failures;
  end if;

  select string_agg(format('%I.%I [%I]', schemaname, tablename, policyname), ', ')
    into failures
  from pg_policies
  where schemaname = 'public'
    and (
      coalesce(qual, '') ~* '^\s*(true|\(true\))\s*$'
      or coalesce(with_check, '') ~* '^\s*(true|\(true\))\s*$'
    );

  if failures is not null then
    raise exception 'Políticas RLS abiertas: %', failures;
  end if;

  select string_agg(format('%I.%I [%I]', n.nspname, c.relname, con.conname), ', ')
    into failures
  from pg_constraint con
  join pg_class c on c.oid = con.conrelid
  join pg_namespace n on n.oid = c.relnamespace
  where con.contype = 'f'
    and n.nspname = 'public'
    and not exists (
      select 1
      from pg_index i
      where i.indrelid = con.conrelid
        and i.indisvalid
        and (i.indkey::smallint[])[0:cardinality(con.conkey) - 1] @> con.conkey
    );

  if failures is not null then
    raise exception 'Claves foráneas sin índice: %', failures;
  end if;

  select string_agg(format('%I.%I', n.nspname, c.relname), ', ')
    into failures
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relkind in ('r', 'p')
    and c.relrowsecurity
    and not exists (select 1 from pg_policy p where p.polrelid = c.oid)
    and c.relname not in (
      'auth_login_intentos',
      'correo_sistema_intentos',
      'formulario_publico_intentos',
      'subcontrato_portal_intentos'
    );

  if failures is not null then
    raise exception 'Tablas RLS sin política fuera de la lista privada: %', failures;
  end if;
end $$;
