begin;
alter table public.inventario_maquinaria add column proveedor_nombre text;
create function private.validate_equipment_supplier() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 new.proveedor_nombre:=nullif(btrim(new.proveedor_nombre),'');
 if lower(btrim(coalesce(new.tipo_activo,'')))='arrendado' and new.proveedor_nombre is null then
  if TG_OP='INSERT' then raise exception 'Indica el nombre del proveedor del equipo arrendado';
  elsif new.tipo_activo is distinct from old.tipo_activo or new.proveedor_nombre is distinct from old.proveedor_nombre then raise exception 'Indica el nombre del proveedor del equipo arrendado'; end if;
 end if;
 if length(new.proveedor_nombre)>200 then raise exception 'El nombre del proveedor no puede superar 200 caracteres'; end if;
 return new;
end;$$;
revoke all on function private.validate_equipment_supplier() from public,anon,authenticated;
create trigger validate_equipment_supplier before insert or update of tipo_activo,proveedor_nombre on public.inventario_maquinaria for each row execute function private.validate_equipment_supplier();
commit;
