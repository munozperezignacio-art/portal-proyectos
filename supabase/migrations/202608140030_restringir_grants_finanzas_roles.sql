do $$
declare target_table text;
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
    'obra_presupuestos',
    'roles'
  ]
  loop
    execute format('revoke all on public.%I from anon, authenticated', target_table);
    execute format('grant select, insert, update, delete on public.%I to authenticated', target_table);
  end loop;
end;
$$;
