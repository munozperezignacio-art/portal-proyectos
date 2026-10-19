begin;
do $$
declare cost_id bigint;
begin
  insert into public.costos_reales_obra(empresa,obra_nombre,nombre,monto,imputaciones,proveedor_rut,proveedor_nombre)
  values('__TEST_PROVEEDOR_ROLLBACK__','Prueba aislada','Arriendo prueba',800000,'[{"partida":"A","porcentaje":100}]','12.345.678-5','Proveedor de prueba') returning id into cost_id;
  update public.costos_reales_obra set proveedor_nombre='Proveedor actualizado' where id=cost_id;
  if not exists(select 1 from public.costos_reales_obra where id=cost_id and proveedor_nombre='Proveedor actualizado' and proveedor_rut='12.345.678-5' and monto=800000 and imputaciones='[{"partida":"A","porcentaje":100}]'::jsonb) then raise exception 'No conserva proveedor o altera costo e imputaciones'; end if;
  update public.costos_reales_obra set proveedor_nombre=null,proveedor_rut=null where id=cost_id;
end; $$;
rollback;
select 'OK: proveedor guardado y editado sin alterar monto/imputaciones; prueba revertida' as resultado;
