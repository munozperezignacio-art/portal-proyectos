create table public.maquinaria_cierre_obra_respuestas(
 empresa text not null,obra_id integer not null references public.obras(id),fecha_termino date not null,
 accion text not null check(accion in ('mantener','baja')),equipos integer[] not null,
 usuario uuid not null,respondido_at timestamptz not null default now(),
 primary key(empresa,obra_id,fecha_termino)
);
alter table public.maquinaria_cierre_obra_respuestas enable row level security;
revoke all on public.maquinaria_cierre_obra_respuestas from public,anon,authenticated;
grant select on public.maquinaria_cierre_obra_respuestas to authenticated;
create policy cierre_maquinaria_lectura on public.maquinaria_cierre_obra_respuestas for select to authenticated using(private.rrhh_partidas_permiso(empresa,obra_id,'ver'));

create function private.avisar_termino_maquinaria() returns trigger language plpgsql security definer set search_path='' as $$
declare obra text;
begin
 if new.estado<>'completada' or new.fecha_termino is null then return new;end if;
 select nombre into obra from public.obras where empresa=new.empresa and id=new.obra_id;
 insert into public.notificaciones_entregas(empresa,obra_nombre,evento_codigo,canal,destinatario,asunto,estado,payload,enviada_at)
 select new.empresa,obra,'maquinaria_termino_obra','Plataforma',u.id::text,'Obra al 100%: ¿dar de baja los equipos?','Enviada',
 jsonb_build_object('obra_id',new.obra_id,'fecha_termino',new.fecha_termino,'detalle',format('%s terminó el %s. Revisa los equipos en Maquinarias: puedes confirmar su baja o mantenerlos asignados.',obra,to_char(new.fecha_termino,'DD-MM-YYYY')),'prioridad','media'),now()
 from public.usuarios u left join public.roles r on r.empresa=u.empresa and r.nombre=u.rol
 where u.empresa=new.empresa and not coalesce(r.archivado,false)
 and lower(coalesce(u.rol_base,r.rol_base,u.rol,'')) in ('administrador de empresa','administrador empresa','administrador de contratos','administrador de contrato','administrador contratos','administrador contrato')
 and ('todas'=any(string_to_array(lower(coalesce(u.obras,'')),',')) or exists(select 1 from unnest(string_to_array(coalesce(u.obras,''),',')) v where lower(trim(v))=lower(obra)))
 and not exists(select 1 from public.notificaciones_entregas n where n.empresa=new.empresa and n.evento_codigo='maquinaria_termino_obra' and n.destinatario=u.id::text and n.payload->>'obra_id'=new.obra_id::text and n.payload->>'fecha_termino'=new.fecha_termino::text);
 return new;
end $$;
revoke all on function private.avisar_termino_maquinaria() from public,anon,authenticated;
create trigger avisar_termino_maquinaria after insert or update on public.obra_termino_trabajos for each row execute function private.avisar_termino_maquinaria();

create function private.responder_cierre_maquinaria(p_empresa text,p_obra integer,p_fecha date,p_accion text,p_equipos integer[]) returns void
language plpgsql security definer set search_path='' as $$
declare c public.obra_termino_trabajos;p public.maquinaria_periodos_costo;e integer;limite date;
begin
 if auth.uid() is null or not coalesce(private.rrhh_partidas_permiso(p_empresa,p_obra,'aprobar'),false) then raise exception 'Solo administradores autorizados pueden responder';end if;
 select * into strict c from public.obra_termino_trabajos where empresa=p_empresa and obra_id=p_obra for update;
 if c.estado<>'completada' or c.fecha_termino is distinct from p_fecha then raise exception 'El término de la obra cambió. Actualiza antes de responder';end if;
 if p_accion is null or p_accion not in ('mantener','baja') then raise exception 'Respuesta inválida';end if;
 if exists(select 1 from public.maquinaria_cierre_obra_respuestas where empresa=p_empresa and obra_id=p_obra and fecha_termino=p_fecha) then raise exception 'La pregunta ya fue respondida. Actualiza la vista';end if;
 limite:=p_fecha+1;
 if p_accion='baja' then
  if coalesce(cardinality(p_equipos),0)=0 then raise exception 'Selecciona equipos';end if;
  for e in select distinct unnest(p_equipos) order by 1 loop
   perform 1 from public.inventario_maquinaria where empresa=p_empresa and id=e for update;
   if not found then raise exception 'Equipo no disponible';end if;
   if not exists(select 1 from public.maquinaria_periodos_costo where empresa=p_empresa and obra_id=p_obra and equipo_id=e and desde<=p_fecha and (hasta is null or hasta>limite)) then raise exception 'La asignación cambió. Revisa los equipos seleccionados';end if;
   for p in select * from public.maquinaria_periodos_costo where empresa=p_empresa and obra_id=p_obra and equipo_id=e and desde<=p_fecha and (hasta is null or hasta>limite) for update loop
    if p.hasta is null then
     update public.inventario_maquinaria set obra_nombre=null,fecha_asig=null,fecha_hasta_estimada=null,fecha_cambio_asignacion=limite
     where empresa=p_empresa and id=e and obra_nombre=(select nombre from public.obras where id=p_obra);
    end if;
    update public.maquinaria_periodos_costo set hasta=limite where id=p.id;
   end loop;
  end loop;
 end if;
 insert into public.maquinaria_cierre_obra_respuestas values(p_empresa,p_obra,p_fecha,p_accion,case when p_accion='baja' then p_equipos else '{}'::integer[] end,auth.uid(),now());
end $$;
revoke all on function private.responder_cierre_maquinaria(text,integer,date,text,integer[]) from public,anon;
grant execute on function private.responder_cierre_maquinaria(text,integer,date,text,integer[]) to authenticated;
create function public.responder_cierre_maquinaria(p_empresa text,p_obra integer,p_fecha date,p_accion text,p_equipos integer[]) returns void language sql security invoker set search_path='' as $$select private.responder_cierre_maquinaria(p_empresa,p_obra,p_fecha,p_accion,p_equipos)$$;
revoke all on function public.responder_cierre_maquinaria(text,integer,date,text,integer[]) from public,anon;
grant execute on function public.responder_cierre_maquinaria(text,integer,date,text,integer[]) to authenticated;
-- Existing completed works receive the same once-only question.
update public.obra_termino_trabajos set actualizado_en=actualizado_en where estado='completada';
