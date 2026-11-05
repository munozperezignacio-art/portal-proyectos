-- Both historical and ordinary assignments use half-open periods [desde,hasta).
create function private.validar_periodo_equipo() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.inventario_maquinaria where empresa=new.empresa and id=new.equipo_id for update;
 if exists(select 1 from public.maquinaria_periodos_costo p where p.empresa=new.empresa and p.equipo_id=new.equipo_id and p.id<>new.id
 and daterange(p.desde,p.hasta,'[)') && daterange(new.desde,new.hasta,'[)')) then
 raise exception 'El período se superpone con una asignación existente del equipo %. No se guardó el lote.',new.equipo_patente;
 end if;
 return new;
end $$;
revoke all on function private.validar_periodo_equipo() from public,anon,authenticated;
create trigger validar_periodo_equipo before insert or update of desde,hasta on public.maquinaria_periodos_costo for each row execute function private.validar_periodo_equipo();

create function private.asignar_equipos_historicos(p_empresa text,p_obra bigint,p_equipos integer[],p_inicio date,p_termino date) returns integer
language plpgsql security definer set search_path='' as $$
declare equipo public.inventario_maquinaria; n integer:=0; periodo bigint;
begin
 if auth.uid() is null or not coalesce(private.maquinaria_puede_editar_grupos(p_empresa),false) then raise exception 'Sin permiso para editar maquinaria' using errcode='42501'; end if;
 if p_inicio is null or p_termino is null or p_inicio>p_termino or p_termino>(now() at time zone 'America/Santiago')::date then raise exception 'Indica inicio y término históricos válidos'; end if;
 if coalesce(cardinality(p_equipos),0) not between 1 and 500 then raise exception 'Selecciona entre 1 y 500 equipos'; end if;
 perform 1 from public.obras where empresa=p_empresa and id=p_obra for share;
 if not found then raise exception 'Obra no disponible'; end if;
 for equipo in select * from public.inventario_maquinaria where empresa=p_empresa and id=any(p_equipos) order by id for update loop
   insert into public.maquinaria_periodos_costo(empresa,equipo_id,obra_id,desde,hasta,tarifa,equipo_tipo,equipo_patente)
   values(p_empresa,equipo.id,p_obra,p_inicio,p_termino+1,case when lower(equipo.unidad_costo_interno) in ('$/día','$/dia') then equipo.costo_interno end,equipo.tipo,equipo.patente)
   returning id into periodo;
   update public.maquinaria_periodos_costo set asignacion_id=periodo where id=periodo;
   n:=n+1;
 end loop;
 if n<>cardinality(p_equipos) then raise exception 'Hay equipos repetidos o no disponibles'; end if;
 return n;
end $$;
revoke all on function private.asignar_equipos_historicos(text,bigint,integer[],date,date) from public,anon;
grant execute on function private.asignar_equipos_historicos(text,bigint,integer[],date,date) to authenticated;
create function public.asignar_equipos_historicos(p_empresa text,p_obra bigint,p_equipos integer[],p_inicio date,p_termino date) returns integer
language sql security invoker set search_path='' as $$ select private.asignar_equipos_historicos(p_empresa,p_obra,p_equipos,p_inicio,p_termino) $$;
revoke all on function public.asignar_equipos_historicos(text,bigint,integer[],date,date) from public,anon;
grant execute on function public.asignar_equipos_historicos(text,bigint,integer[],date,date) to authenticated;
