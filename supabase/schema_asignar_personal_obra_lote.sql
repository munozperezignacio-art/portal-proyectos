-- Obra actual + historial en una transacción; no crea asistencias ni costos.
-- Respaldo inmutable de períodos vacíos cubiertos; no se expone a la API.
create table if not exists private.rrhh_asignaciones_sin_destino_auditoria (
  id bigint generated always as identity primary key,
  empresa text not null, trabajador_id integer not null,
  registro_original jsonb not null, nueva_obra_id integer not null,
  nueva_fecha_inicio date not null, registrado_por uuid not null,
  registrado_en timestamptz not null default now()
);
alter table private.rrhh_asignaciones_sin_destino_auditoria enable row level security;
revoke all on private.rrhh_asignaciones_sin_destino_auditoria from public,anon,authenticated;
create or replace function private.rrhh_asignar_obra_lote(p_empresa text,p_trabajadores integer[],p_obra integer,p_fecha date)
returns jsonb language plpgsql security definer set search_path='' as $$
declare p public.maestro_personal; h public.rrhh_asignaciones_personal; vacio public.rrhh_asignaciones_personal; o public.obras; autor text;
  asignados integer:=0; omitidos integer:=0; hoy date:=(now() at time zone 'America/Santiago')::date;
begin
  select coalesce(u.nombre,u.usuario,u.correo) into autor
  from public.usuarios u left join public.roles r on r.empresa=u.empresa and r.nombre=u.rol
  cross join lateral(select coalesce(r.permisos,'{}'::jsonb)||coalesce(u.permisos,'{}'::jsonb) permisos,
    lower(coalesce(u.rol_base,r.rol_base,u.rol,'')) rol) e
  where u.auth_user_id=auth.uid() and not coalesce(r.archivado,false)
    and (u.empresa=p_empresa or (u.empresa='Obraxis' and e.rol in ('superusuario','superadmin')))
    and case when e.rol in ('superusuario','superadmin') then true
      when e.permisos ? 'rrhh.personal.editar' then e.permisos->>'rrhh.personal.editar'='true'
      else e.rol like '%admin%' or e.rol like '%gerencia%' or e.rol like '%jefe%' or e.rol like '%profesional%' or e.rol like '%creador%' end limit 1;
  if not found or auth.uid() is null or not private.obraxis_actor_can_access_company(p_empresa) then raise exception 'Sin permiso para asignar personal en esta empresa' using errcode='42501'; end if;
  if p_fecha is null or p_fecha>hoy then raise exception 'Selecciona una fecha de asignación vigente, no futura'; end if;
  if p_trabajadores is null or cardinality(p_trabajadores) not between 1 and 500 or array_position(p_trabajadores,null) is not null
    or cardinality(p_trabajadores)<>(select count(distinct id) from unnest(p_trabajadores) id) then raise exception 'Selecciona entre 1 y 500 trabajadores distintos'; end if;
  if exists(select 1 from unnest(p_trabajadores) as elegido(id) where not exists(select 1 from public.maestro_personal m where m.id=elegido.id and m.empresa=p_empresa)) then raise exception 'Hay trabajadores ajenos a esta empresa o eliminados'; end if;
  select * into o from public.obras where id=p_obra and empresa=p_empresa for share;
  if not found then raise exception 'La obra no pertenece a esta empresa'; end if;
  if o.centro_gestion_id is not null and not exists(select 1 from public.facturacion_centros_gestion c where c.id=o.centro_gestion_id and c.empresa=p_empresa and c.activo) then raise exception 'La obra tiene un centro de gestión inválido o inactivo'; end if;
  perform pg_advisory_xact_lock(hashtextextended('rrhh_asignacion_obra:'||p_empresa,0));
  for p in select * from public.maestro_personal where empresa=p_empresa and id=any(p_trabajadores) order by id for update loop
    if p.obra_nombre=o.nombre and p.centro_gestion_id is not distinct from o.centro_gestion_id then omitidos:=omitidos+1;continue; end if;
    if p_fecha<coalesce(p.fecha_inicio_contrato,p_fecha) or p_fecha>coalesce(p.fecha_vencimiento_contrato,p_fecha) then raise exception '%: fecha fuera de vigencia contractual',p.nombre; end if;
    if exists(select 1 from public.rrhh_nominas_mensuales n join public.rrhh_nomina_items i on i.nomina_id=n.id
      where n.empresa=p_empresa and i.trabajador_id=p.id and n.estado in ('Cerrada','Pagada') and n.periodo>=to_char(p_fecha,'YYYY-MM')) then raise exception '%: hay una nómina cerrada que requiere revisión explícita antes de cambiar su asignación histórica',p.nombre; end if;
    perform 1 from public.rrhh_asignaciones_personal where empresa=p_empresa and trabajador_id=p.id order by id for update;
    -- Un destino desconocido también se protege: solo "Sin asignar" o vacío son reemplazables.
    if exists(select 1 from public.rrhh_asignaciones_personal a where a.empresa=p_empresa and a.trabajador_id=p.id
      and not (nullif(btrim(a.obra_nombre),'') is null and a.centro_gestion_id is null and lower(btrim(coalesce(a.destino_nombre,''))) in ('','sin asignar'))
      and (a.fecha_inicio>=p_fecha or (a.fecha_termino is not null and a.fecha_termino>=p_fecha))) then
      raise exception '%: la fecha se cruza con una asignación registrada. Elige una fecha posterior o revisa su historial',p.nombre;
    end if;
    for vacio in select * from public.rrhh_asignaciones_personal a
      where a.empresa=p_empresa and a.trabajador_id=p.id
        and nullif(btrim(a.obra_nombre),'') is null and a.centro_gestion_id is null
        and lower(btrim(coalesce(a.destino_nombre,''))) in ('','sin asignar')
        and (a.fecha_termino is null or a.fecha_termino>=p_fecha) order by a.id
    loop
      insert into private.rrhh_asignaciones_sin_destino_auditoria(empresa,trabajador_id,registro_original,nueva_obra_id,nueva_fecha_inicio,registrado_por)
        values(p_empresa,p.id,to_jsonb(vacio),p_obra,p_fecha,auth.uid());
      if vacio.fecha_inicio<p_fecha then
        update public.rrhh_asignaciones_personal set fecha_termino=p_fecha-1,updated_at=now() where id=vacio.id and empresa=p_empresa;
      else
        -- El registro completo permanece en el respaldo; no dejamos períodos invertidos ni solapados.
        delete from public.rrhh_asignaciones_personal where id=vacio.id and empresa=p_empresa;
      end if;
    end loop;
    select * into h from public.rrhh_asignaciones_personal where empresa=p_empresa and trabajador_id=p.id and fecha_termino is null for update;
    if h.id is not null then
      update public.rrhh_asignaciones_personal set fecha_termino=p_fecha-1,updated_at=now() where id=h.id and empresa=p_empresa;
    elsif coalesce(p.obra_nombre,'')<>'' then
      if p.fecha_asig is null or p.fecha_asig>=p_fecha then raise exception '%: revisa la fecha de su asignación actual antes de trasladarlo',p.nombre; end if;
      if p.centro_gestion_id is not null and not exists(select 1 from public.facturacion_centros_gestion c where c.id=p.centro_gestion_id and c.empresa=p_empresa) then raise exception '%: centro previo inválido',p.nombre; end if;
      insert into public.rrhh_asignaciones_personal(empresa,trabajador_id,trabajador_nombre,trabajador_rut,cargo,obra_nombre,centro_gestion_id,destino_nombre,fecha_inicio,fecha_termino,creado_por)
        values(p_empresa,p.id,p.nombre,p.rut,p.cargo,p.obra_nombre,p.centro_gestion_id,p.obra_nombre,p.fecha_asig,p_fecha-1,autor);
    end if;
    insert into public.rrhh_asignaciones_personal(empresa,trabajador_id,trabajador_nombre,trabajador_rut,cargo,obra_nombre,centro_gestion_id,destino_nombre,fecha_inicio,creado_por)
      values(p_empresa,p.id,p.nombre,p.rut,p.cargo,o.nombre,o.centro_gestion_id,o.nombre,p_fecha,autor);
    update public.maestro_personal set obra_nombre=o.nombre,centro_gestion_id=o.centro_gestion_id,fecha_asig=p_fecha where id=p.id and empresa=p_empresa;
    asignados:=asignados+1;
  end loop;
  return jsonb_build_object('asignados',asignados,'omitidos',omitidos);
end; $$;
revoke all on function private.rrhh_asignar_obra_lote(text,integer[],integer,date) from public,anon;
grant execute on function private.rrhh_asignar_obra_lote(text,integer[],integer,date) to authenticated;
create or replace function public.asignar_personal_obra_lote(p_empresa text,p_trabajadores integer[],p_obra integer,p_fecha date)
returns jsonb language sql security invoker set search_path='' as $$select private.rrhh_asignar_obra_lote(p_empresa,p_trabajadores,p_obra,p_fecha);$$;
revoke all on function public.asignar_personal_obra_lote(text,integer[],integer,date) from public,anon;
grant execute on function public.asignar_personal_obra_lote(text,integer[],integer,date) to authenticated;
notify pgrst,'reload schema';
