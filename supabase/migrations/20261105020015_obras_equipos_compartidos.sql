-- Null upper bounds belong to the inventory's primary assignment. Historical
-- open-ended ranges use infinity so ordinary inventory transfers do not close them.
create or replace function private.validar_periodo_equipo() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.inventario_maquinaria where empresa=new.empresa and id=new.equipo_id for update;
 if exists(select 1 from public.maquinaria_periodos_costo p where p.empresa=new.empresa and p.equipo_id=new.equipo_id and p.obra_id=new.obra_id and p.id<>new.id
 and daterange(p.desde,p.hasta,'[)') && daterange(new.desde,new.hasta,'[)')) then
 raise exception 'Ya hay una asignación en esta obra para el equipo % en esas fechas.',new.equipo_patente;
 end if;return new;
end $$;
create or replace function private.asignar_equipos_historicos(p_empresa text,p_obra bigint,p_equipos integer[],p_inicio date,p_termino date) returns integer
language plpgsql security definer set search_path='' as $$
declare e public.inventario_maquinaria;n integer:=0; tramo daterange; nuevo bigint;
begin
 if auth.uid() is null or not coalesce(private.maquinaria_puede_editar_grupos(p_empresa),false) then raise exception 'Sin permiso para editar maquinaria' using errcode='42501'; end if;
 if p_inicio is null or p_inicio>(now() at time zone 'America/Santiago')::date or p_termino<p_inicio or p_termino>(now() at time zone 'America/Santiago')::date then raise exception 'Revisa las fechas históricas'; end if;
 if coalesce(cardinality(p_equipos),0) not between 1 and 500 then raise exception 'Selecciona entre 1 y 500 equipos'; end if;
 perform 1 from public.obras where empresa=p_empresa and id=p_obra for share;if not found then raise exception 'Obra no disponible'; end if;
 for e in select * from public.inventario_maquinaria where empresa=p_empresa and id=any(p_equipos) order by id for update loop
  for tramo in select unnest(datemultirange(daterange(p_inicio,coalesce(p_termino+1,'infinity'::date),'[)'))-
   coalesce(range_agg(daterange(desde,hasta,'[)')),'{}'::datemultirange)) from public.maquinaria_periodos_costo where empresa=p_empresa and equipo_id=e.id and obra_id=p_obra loop
    insert into public.maquinaria_periodos_costo(empresa,equipo_id,obra_id,desde,hasta,tarifa,equipo_tipo,equipo_patente) values(p_empresa,e.id,p_obra,lower(tramo),upper(tramo),case when lower(e.unidad_costo_interno) in ('$/día','$/dia') then e.costo_interno end,e.tipo,e.patente) returning id into nuevo;
    update public.maquinaria_periodos_costo set asignacion_id=nuevo where id=nuevo;
  end loop;n:=n+1;
 end loop;
 if n<>cardinality(p_equipos) then raise exception 'Equipos repetidos o no disponibles';end if;return n;
end $$;
create function private.baja_equipo_obra(p_empresa text,p_obra bigint,p_periodo bigint,p_fecha date) returns void
language plpgsql security definer set search_path='' as $$
declare p public.maquinaria_periodos_costo;
begin
 if auth.uid() is null or not coalesce(private.maquinaria_puede_editar_grupos(p_empresa) or private.obraxis_permission(p_empresa,'obras.gestion.configurar'),false) or not coalesce(private.obraxis_actor_can_access_company(p_empresa),false) then raise exception 'Sin permiso para dar de baja el equipo';end if;
 select * into strict p from public.maquinaria_periodos_costo where empresa=p_empresa and obra_id=p_obra and id=p_periodo;
 perform 1 from public.inventario_maquinaria where empresa=p_empresa and id=p.equipo_id for update;
 select * into strict p from public.maquinaria_periodos_costo where id=p_periodo for update;
 if p_fecha is null or p_fecha<p.desde or p_fecha>=p.hasta or p_fecha>(now() at time zone 'America/Santiago')::date then raise exception 'La fecha de baja debe estar dentro de la asignación y no ser futura';end if;
 if p.hasta is null then
  update public.inventario_maquinaria set obra_nombre=null,fecha_asig=null,fecha_hasta_estimada=null,fecha_cambio_asignacion=p_fecha where empresa=p_empresa and id=p.equipo_id and obra_nombre=(select nombre from public.obras where id=p_obra and empresa=p_empresa);
 end if;
 update public.maquinaria_periodos_costo set hasta=p_fecha where id=p.id;
end $$;
revoke all on function private.baja_equipo_obra(text,bigint,bigint,date) from public,anon;
grant execute on function private.baja_equipo_obra(text,bigint,bigint,date) to authenticated;
create function public.baja_equipo_obra(p_empresa text,p_obra bigint,p_periodo bigint,p_fecha date) returns void language sql security invoker set search_path='' as $$ select private.baja_equipo_obra(p_empresa,p_obra,p_periodo,p_fecha) $$;
revoke all on function public.baja_equipo_obra(text,bigint,bigint,date) from public,anon;
grant execute on function public.baja_equipo_obra(text,bigint,bigint,date) to authenticated;
create function private.proteger_confirmacion_obra_equipo() returns trigger language plpgsql set search_path='' as $$
begin
 if old.tipo='confirmar' and new.obra_id<>old.obra_id then raise exception 'Este equipo ya tiene el día confirmado en otra obra. Actualiza la vista.';end if;return new;
end $$;
revoke all on function private.proteger_confirmacion_obra_equipo() from public,anon,authenticated;
create trigger proteger_confirmacion_obra_equipo before update on public.maquinaria_decisiones_costo for each row execute function private.proteger_confirmacion_obra_equipo();
