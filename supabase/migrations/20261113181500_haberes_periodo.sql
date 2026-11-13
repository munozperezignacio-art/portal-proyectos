create or replace function private.validar_haber_obra() returns trigger language plpgsql security invoker set search_path='' as $$
declare nom_estado text;
begin
 if new.referencia like '%/%' then
   if new.referencia !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}/[0-9]{4}-[0-9]{2}-[0-9]{2}$' or substring(new.referencia,12,7)<>new.periodo then raise exception 'Revisa el período del haber';end if;
   if split_part(new.referencia,'/',1)::date > split_part(new.referencia,'/',2)::date then raise exception 'Revisa el orden de las fechas';end if;
 elsif new.referencia=new.periodo and new.periodo ~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then null;
 elsif new.referencia ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and left(new.referencia,7)=new.periodo then perform new.referencia::date;
 else raise exception 'Período no válido';end if;
 select estado into nom_estado from public.rrhh_nominas_mensuales where empresa=new.empresa and periodo=new.periodo for share;
 if nom_estado is not null and nom_estado<>'Borrador' then raise exception 'Esta nómina no está abierta';end if;
 if not exists(select 1 from public.maestro_personal m join public.obras o on o.id=new.obra_id and o.empresa=m.empresa where m.empresa=new.empresa and m.id=new.trabajador_id and (m.obra_nombre=o.nombre or m.centro_gestion_id=o.centro_gestion_id or exists(select 1 from public.rrhh_personal_centros_detalle a where a.empresa=o.empresa and a.trabajador_id=m.id and a.centro_gestion_id=o.centro_gestion_id))) then raise exception 'Trabajador no asignado a la obra';end if;
 return new;
end;$$;
