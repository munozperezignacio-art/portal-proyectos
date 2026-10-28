-- Read-only deployment checks; fixture coverage is run with local PostgreSQL.
do $$
begin
  if private.formulario_centros_permitidos('__scope_test_company__', '{"control_documental":{"centros_gestion_ids":[17]}}') <> '[17]'::jsonb then
    raise exception 'Explicit scope must be preserved';
  end if;
  if private.formulario_centros_permitidos('__scope_test_company__', '{"control_documental":{"todas_las_obras":true}}') <> '[]'::jsonb then
    raise exception 'Dynamic scope must not expose another company';
  end if;
  if public.formulario_centros_gestion('__invalid_scope_test_token__') <> '[]'::jsonb then
    raise exception 'Unknown token must return nothing';
  end if;
  if has_function_privilege('anon','public.formulario_centros_gestion(text)','execute') then
    raise exception 'Public RPC must remain service-role only';
  end if;
end;
$$;
