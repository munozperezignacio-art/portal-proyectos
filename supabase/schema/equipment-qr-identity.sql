-- Only the edge endpoint may resolve an exact RUT. Never expose a directory.
create function public.equipo_qr_persona(p_empresa text,p_rut text) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',p.id,'nombre',p.nombre,'cargo',p.cargo,'rut',p.rut)),'[]'::jsonb)
 from (select id,nombre,cargo,rut from public.maestro_personal
 where empresa=p_empresa and lower(coalesce(estado,'activo'))='activo'
 and regexp_replace(upper(rut),'[^0-9K]','','g')=p_rut limit 2) p;
$$;
revoke all on function public.equipo_qr_persona(text,text) from public,anon,authenticated;
grant execute on function public.equipo_qr_persona(text,text) to service_role;
alter table public.maquinaria_mantenciones add column qr_solicitud uuid, add column qr_datos jsonb;
create unique index maquinaria_mantencion_qr_solicitud on public.maquinaria_mantenciones(empresa,qr_solicitud) where qr_solicitud is not null;
create function public.equipo_qr_mantencion(p_equipo integer,p_datos jsonb,p_solicitud uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare e public.inventario_maquinaria%rowtype; r public.maquinaria_mantenciones%rowtype; meter numeric; d date;
begin
 select * into strict e from public.inventario_maquinaria where id=p_equipo for update;
 select * into r from public.maquinaria_mantenciones where empresa=e.empresa and qr_solicitud=p_solicitud;
 if found then
  if r.equipo_id<>p_equipo or r.qr_datos<>p_datos then raise exception 'La solicitud ya existe con otros datos'; end if;
  return jsonb_build_object('id',r.id);
 end if;
 meter:=(p_datos->>'horometro')::numeric; d:=(p_datos->>'fecha')::date;
 if p_solicitud is null or meter is null or meter<0 or meter::text in ('NaN','Infinity','-Infinity') or d is null or d>(now() at time zone 'America/Santiago')::date or length(btrim(coalesce(p_datos->>'descripcion','')))<3 or coalesce(p_datos->>'tipo','') not in ('Preventiva','Correctiva') then raise exception 'Revisa fecha, lectura, tipo y descripción'; end if;
 insert into public.maquinaria_mantenciones(equipo_id,equipo_patente,equipo_tipo,empresa,obra_nombre,fecha,tipo,horometro,descripcion,responsable,registrado_por,qr_solicitud,qr_datos)
 values(e.id,e.patente,e.tipo,e.empresa,e.obra_nombre,d,p_datos->>'tipo',meter,p_datos->>'descripcion',p_datos->>'nombre',p_datos->>'autor_declarado',p_solicitud,p_datos) returning * into r;
 return jsonb_build_object('id',r.id);
end;$$;
revoke all on function public.equipo_qr_mantencion(integer,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.equipo_qr_mantencion(integer,jsonb,uuid) to service_role;
