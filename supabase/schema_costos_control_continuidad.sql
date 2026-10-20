alter table public.maquinaria_periodos_costo add column if not exists asignacion_id bigint;
update public.maquinaria_periodos_costo set asignacion_id=id where asignacion_id is null;
create or replace function private.historial_maquinaria_costo() returns trigger
language plpgsql security definer set search_path='' as $$
declare destino bigint; cambio date; anterior public.maquinaria_periodos_costo; grupo bigint; nuevo_periodo bigint;
begin
 if auth.uid() is not null and not private.obraxis_actor_can_access_company(coalesce(new.empresa,old.empresa)) then raise exception 'Empresa no autorizada'; end if;
 if TG_OP='UPDATE' and row(new.empresa,new.obra_nombre,new.costo_interno,new.unidad_costo_interno,new.fecha_asig,new.fecha_cambio_asignacion)
   is not distinct from row(old.empresa,old.obra_nombre,old.costo_interno,old.unidad_costo_interno,old.fecha_asig,old.fecha_cambio_asignacion) then return new; end if;
 cambio:=(now() at time zone 'America/Santiago')::date;
 if TG_OP='INSERT' then cambio:=coalesce(new.fecha_asig,cambio);
 elsif TG_OP='UPDATE' then
   if new.empresa is distinct from old.empresa then raise exception 'No se permite cambiar la empresa de un equipo con historial'; end if;
   if new.fecha_cambio_asignacion is distinct from old.fecha_cambio_asignacion then cambio:=coalesce(new.fecha_cambio_asignacion,cambio);
   elsif new.obra_nombre is distinct from old.obra_nombre and new.fecha_asig is distinct from old.fecha_asig then cambio:=coalesce(new.fecha_asig,cambio); end if;
 end if;
 if TG_OP<>'INSERT' then
   select * into anterior from public.maquinaria_periodos_costo where empresa=old.empresa and equipo_id=old.id and hasta is null order by desde desc,id desc limit 1 for update;
   if found then
     if TG_OP='UPDATE' and new.fecha_asig is not distinct from old.fecha_asig and exists(select 1 from public.obras o where o.id=anterior.obra_id and o.empresa=new.empresa and o.nombre=new.obra_nombre) then grupo:=coalesce(anterior.asignacion_id,anterior.id); end if;
     if cambio<anterior.desde then raise exception 'El cambio antecede al período vigente. Revisa la fecha para conservar el historial.'; end if;
     update public.maquinaria_periodos_costo set hasta=cambio where id=anterior.id;
   end if;
 end if;
 if TG_OP='DELETE' then return old; end if;
 select id into destino from public.obras where empresa=new.empresa and nombre=new.obra_nombre;
 if destino is not null then
   insert into public.maquinaria_periodos_costo(empresa,equipo_id,obra_id,desde,tarifa,equipo_tipo,equipo_patente)
   values(new.empresa,new.id,destino,cambio,case when lower(new.unidad_costo_interno) in ('$/día','$/dia') then new.costo_interno end,new.tipo,new.patente) returning id into nuevo_periodo;
   update public.maquinaria_periodos_costo set asignacion_id=coalesce(grupo,nuevo_periodo) where id=nuevo_periodo;
 end if;
 return new;
end $$;
revoke all on function private.historial_maquinaria_costo() from public,anon,authenticated;

