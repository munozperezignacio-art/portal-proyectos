-- Pertenencia operativa a varios centros. No genera ni reparte costos.
create unique index maestro_personal_empresa_id_centros on public.maestro_personal(empresa,id);
create unique index centros_gestion_empresa_id_personal on public.facturacion_centros_gestion(empresa,id);
create table public.rrhh_personal_centros (
  id bigint generated always as identity primary key,
  empresa text not null,
  trabajador_id integer not null,
  centro_gestion_id integer not null,
  fecha_inicio date not null,
  fecha_termino date,
  creado_por uuid not null,
  creado_en timestamptz not null default now(),
  actualizado_por uuid,
  actualizado_en timestamptz,
  check(fecha_termino is null or fecha_termino>=fecha_inicio),
  foreign key(empresa,trabajador_id) references public.maestro_personal(empresa,id),
  foreign key(empresa,centro_gestion_id) references public.facturacion_centros_gestion(empresa,id)
);
create unique index rrhh_personal_centros_abierto on public.rrhh_personal_centros(empresa,trabajador_id,centro_gestion_id) where fecha_termino is null;
create index rrhh_personal_centros_por_centro on public.rrhh_personal_centros(empresa,centro_gestion_id,fecha_inicio,fecha_termino);
alter table public.rrhh_personal_centros enable row level security;
revoke all on public.rrhh_personal_centros from public,anon,authenticated;
grant select on public.rrhh_personal_centros to authenticated;
grant all on public.rrhh_personal_centros to service_role;
grant usage,select on sequence public.rrhh_personal_centros_id_seq to service_role;
create policy rrhh_personal_centros_empresa on public.rrhh_personal_centros for select to authenticated
  using((select private.obraxis_actor_can_access_company(empresa)));
create view public.rrhh_personal_centros_detalle with(security_invoker=true) as
  select a.*,c.codigo centro_codigo,c.nombre centro_nombre,c.activo centro_activo
  from public.rrhh_personal_centros a join public.facturacion_centros_gestion c on c.id=a.centro_gestion_id and c.empresa=a.empresa;
revoke all on public.rrhh_personal_centros_detalle from public,anon;
grant select on public.rrhh_personal_centros_detalle to authenticated,service_role;
create trigger trg_auditoria_general after insert or update or delete on public.rrhh_personal_centros
  for each row execute function private.registrar_auditoria_cambio('rrhh','centros_personal');

create function private.gestionar_personal_centros(p_empresa text,p_trabajadores integer[],p_centros integer[],p_inicio date,p_termino date,p_accion text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare permitido boolean; trabajador public.maestro_personal; centro integer; actual public.rrhh_personal_centros;
  agregados integer:=0;omitidos integer:=0;finalizados integer:=0;
begin
  if auth.uid() is null or not private.obraxis_actor_can_access_company(p_empresa) then raise exception 'Sin acceso a esta empresa' using errcode='42501';end if;
  select true into permitido from public.usuarios u left join public.roles r on r.empresa=u.empresa and r.nombre=u.rol
  cross join lateral(select coalesce(r.permisos,'{}'::jsonb)||coalesce(u.permisos,'{}'::jsonb) permisos,lower(coalesce(u.rol_base,r.rol_base,u.rol,'')) rol) e
  where u.auth_user_id=auth.uid() and not coalesce(r.archivado,false)
    and (u.empresa=p_empresa or(u.empresa='Obraxis' and e.rol in('superusuario','superadmin')))
    and case when e.rol in('superusuario','superadmin') then true when e.permisos?'rrhh.personal.editar' then e.permisos->>'rrhh.personal.editar'='true'
    else e.rol like '%admin%' or e.rol like '%gerencia%' or e.rol like '%jefe%' or e.rol like '%profesional%' or e.rol like '%creador%' end limit 1;
  if not coalesce(permitido,false) then raise exception 'No tienes permiso para asignar centros al personal' using errcode='42501';end if;
  if p_accion not in('agregar','finalizar') or p_accion is null or p_inicio is null or(p_termino is not null and p_termino<p_inicio) then raise exception 'Acción o fechas inválidas';end if;
  if p_trabajadores is null or cardinality(p_trabajadores) not between 1 and 500 or array_position(p_trabajadores,null) is not null
    or cardinality(p_trabajadores)<>(select count(distinct id) from unnest(p_trabajadores) id) then raise exception 'Selecciona entre 1 y 500 trabajadores distintos';end if;
  if p_centros is null or cardinality(p_centros) not between 1 and 50 or array_position(p_centros,null) is not null
    or cardinality(p_centros)<>(select count(distinct id) from unnest(p_centros) id) or cardinality(p_centros)*cardinality(p_trabajadores)>10000 then raise exception 'Selecciona centros distintos, máximo 10.000 vínculos por lote';end if;
  if exists(select 1 from unnest(p_trabajadores) elegido(id) where not exists(select 1 from public.maestro_personal m where m.id=elegido.id and m.empresa=p_empresa)) then raise exception 'Hay trabajadores ajenos a la empresa o eliminados';end if;
  if exists(select 1 from unnest(p_centros) elegido(id) where not exists(select 1 from public.facturacion_centros_gestion c where c.id=elegido.id and c.empresa=p_empresa and(p_accion='finalizar' or c.activo))) then raise exception 'Hay centros ajenos a la empresa, inactivos o eliminados';end if;
  -- Mismo orden que el traslado de obra: las asignaciones concurrentes de una persona se serializan.
  for trabajador in select * from public.maestro_personal where empresa=p_empresa and id=any(p_trabajadores) order by id for update loop
    if p_accion='agregar' and(p_inicio<coalesce(trabajador.fecha_inicio_contrato,p_inicio) or p_inicio>coalesce(trabajador.fecha_vencimiento_contrato,p_inicio)
      or(p_termino is not null and p_termino>coalesce(trabajador.fecha_vencimiento_contrato,p_termino))) then raise exception '%: fechas fuera de vigencia contractual',trabajador.nombre;end if;
    foreach centro in array p_centros loop
      if p_accion='finalizar' then
        if p_termino is null then raise exception 'Indica el último día de asignación';end if;
        select * into actual from public.rrhh_personal_centros where empresa=p_empresa and trabajador_id=trabajador.id and centro_gestion_id=centro and fecha_inicio=p_inicio for update;
        if not found then raise exception 'La asignación ya no está disponible. Actualiza la pantalla';end if;
        if actual.fecha_termino is not null then
          if actual.fecha_termino=p_termino then omitidos:=omitidos+1;continue;end if;
          raise exception 'Esta asignación ya tiene término. No se modifica su historial';
        end if;
        update public.rrhh_personal_centros set fecha_termino=p_termino,actualizado_por=auth.uid(),actualizado_en=now() where id=actual.id;
        finalizados:=finalizados+1;
      else
        if trabajador.centro_gestion_id=centro then omitidos:=omitidos+1;continue;end if;
        select * into actual from public.rrhh_personal_centros where empresa=p_empresa and trabajador_id=trabajador.id and centro_gestion_id=centro
          and daterange(fecha_inicio,fecha_termino,'[]')&&daterange(p_inicio,p_termino,'[]') limit 1 for update;
        if found then
          if actual.fecha_inicio=p_inicio and actual.fecha_termino is not distinct from p_termino then omitidos:=omitidos+1;continue;end if;
          raise exception '%: ya existe una asignación vigente o solapada en ese centro',trabajador.nombre;
        end if;
        insert into public.rrhh_personal_centros(empresa,trabajador_id,centro_gestion_id,fecha_inicio,fecha_termino,creado_por)
          values(p_empresa,trabajador.id,centro,p_inicio,p_termino,auth.uid());agregados:=agregados+1;
      end if;
    end loop;
  end loop;
  return jsonb_build_object('agregados',agregados,'omitidos',omitidos,'finalizados',finalizados);
end;$$;
revoke all on function private.gestionar_personal_centros(text,integer[],integer[],date,date,text) from public,anon;
grant execute on function private.gestionar_personal_centros(text,integer[],integer[],date,date,text) to authenticated;
create function public.gestionar_personal_centros(p_empresa text,p_trabajadores integer[],p_centros integer[],p_inicio date,p_termino date default null,p_accion text default 'agregar')
returns jsonb language sql security invoker set search_path='' as $$select private.gestionar_personal_centros(p_empresa,p_trabajadores,p_centros,p_inicio,p_termino,p_accion);$$;
revoke all on function public.gestionar_personal_centros(text,integer[],integer[],date,date,text) from public,anon;
grant execute on function public.gestionar_personal_centros(text,integer[],integer[],date,date,text) to authenticated;
notify pgrst,'reload schema';
