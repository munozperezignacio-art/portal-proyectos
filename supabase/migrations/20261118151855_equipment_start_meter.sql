begin;
create function private.equipment_start_meter(p_equipo integer,p_lectura numeric default null,p_anterior numeric default null) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e public.inventario_maquinaria%rowtype; reported boolean;
begin
 if auth.uid() is null then raise exception 'Sesión requerida'; end if;
 select * into e from public.inventario_maquinaria where id=p_equipo for update;
 if not found or not private.obraxis_permission(e.empresa,'maquinaria.inventario.editar') then raise exception 'Sin permiso para configurar este equipo'; end if;
 select exists(select 1 from public.maquinaria_uso_diario where empresa=e.empresa and equipo_id=e.id::text) into reported;
 if p_lectura is not null then
  if reported then raise exception 'Este equipo ya tiene reportes. No se puede cambiar su lectura de arranque.'; end if;
  if p_lectura<0 or p_lectura>999999999 or p_lectura::text in ('NaN','Infinity','-Infinity') then raise exception 'Ingresa un horómetro válido, igual o mayor que cero.'; end if;
  if p_anterior is distinct from coalesce(e.horometro_inicial,0) then raise exception 'La lectura cambió. Cierra y vuelve a abrir la configuración.'; end if;
  update public.inventario_maquinaria set horometro_inicial=p_lectura where id=e.id;
  e.horometro_inicial:=p_lectura;
 end if;
 return jsonb_build_object('lectura',coalesce(e.horometro_inicial,0),'puede_configurar',not reported);
end;$$;
revoke all on function private.equipment_start_meter(integer,numeric,numeric) from public,anon;
grant execute on function private.equipment_start_meter(integer,numeric,numeric) to authenticated;
create function public.equipment_start_meter(p_equipo integer,p_lectura numeric default null,p_anterior numeric default null) returns jsonb
language sql security invoker set search_path='' as $$ select private.equipment_start_meter(p_equipo,p_lectura,p_anterior); $$;
revoke all on function public.equipment_start_meter(integer,numeric,numeric) from public,anon;
grant execute on function public.equipment_start_meter(integer,numeric,numeric) to authenticated;
commit;
