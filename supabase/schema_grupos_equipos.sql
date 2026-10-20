-- Conjuntos reutilizables, independientes de categorías, inventario y reservas.
alter table public.inventario_maquinaria add constraint inventario_equipo_empresa_unique unique(id,empresa);
create table public.maquinaria_grupos (
  id bigint generated always as identity primary key,
  empresa text not null,
  nombre text not null check(length(btrim(nombre)) between 1 and 120),
  descripcion text not null default '' check(length(descripcion)<=1000),
  actualizado_en timestamptz not null default now(),
  actualizado_por uuid not null,
  historial jsonb not null default '[]',
  unique(id,empresa)
);
create unique index maquinaria_grupos_nombre_idx on public.maquinaria_grupos(empresa,lower(btrim(nombre)));
create table public.maquinaria_grupos_equipos (
  grupo_id bigint not null,
  empresa text not null,
  equipo_id integer not null,
  primary key(grupo_id,equipo_id),
  foreign key(grupo_id,empresa) references public.maquinaria_grupos(id,empresa) on delete cascade,
  foreign key(equipo_id,empresa) references public.inventario_maquinaria(id,empresa) on delete cascade
);
create index maquinaria_grupos_equipos_equipo_idx on public.maquinaria_grupos_equipos(equipo_id,empresa);
create index maquinaria_grupos_equipos_empresa_idx on public.maquinaria_grupos_equipos(empresa,grupo_id);
alter table public.maquinaria_grupos enable row level security;
alter table public.maquinaria_grupos_equipos enable row level security;
revoke all on public.maquinaria_grupos,public.maquinaria_grupos_equipos from public,anon,authenticated;
grant select on public.maquinaria_grupos,public.maquinaria_grupos_equipos to authenticated;
create policy grupos_empresa_lectura on public.maquinaria_grupos for select to authenticated
using((select private.obraxis_actor_can_access_company(empresa)));
create policy grupos_equipos_empresa_lectura on public.maquinaria_grupos_equipos for select to authenticated
using((select private.obraxis_actor_can_access_company(empresa)));

create function private.maquinaria_puede_editar_grupos(p_empresa text)
returns boolean language sql stable security definer set search_path='' as $$
select auth.uid() is not null and private.obraxis_actor_can_access_company(p_empresa) and exists(
  select 1 from public.usuarios u left join public.roles r on r.empresa=u.empresa and r.nombre=u.rol
  cross join lateral(select coalesce(r.permisos,'{}'::jsonb)||coalesce(u.permisos,'{}'::jsonb) permisos,
    lower(coalesce(u.rol_base,r.rol_base,u.rol,'')) rol) e
  where u.auth_user_id=auth.uid() and not coalesce(r.archivado,false)
    and (u.empresa=p_empresa or (u.empresa='Obraxis' and e.rol in ('superusuario','superadmin')))
    and case when e.rol in ('superusuario','superadmin') then true
      when e.permisos ? 'maquinaria.inventario.editar' then e.permisos->>'maquinaria.inventario.editar'='true'
      else e.rol like '%admin%' or e.rol like '%gerencia%' or e.rol like '%jefe%' or e.rol like '%profesional%' or e.rol like '%creador%' end);
$$;
revoke all on function private.maquinaria_puede_editar_grupos(text) from public,anon,authenticated;

create function private.maquinaria_gestionar_grupo(p_empresa text,p_accion text,p_id bigint,p_nombre text,p_descripcion text,p_equipo_ids integer[],p_version timestamptz)
returns jsonb language plpgsql security definer set search_path='' as $$
declare g public.maquinaria_grupos; ids integer[]; n integer;
begin
  if not private.maquinaria_puede_editar_grupos(p_empresa) then raise exception 'Sin permiso para editar grupos de esta empresa'; end if;
  perform pg_advisory_xact_lock(hashtextextended('maquinaria_grupos:'||p_empresa,0));
  if p_accion not in ('crear','editar','eliminar') or p_accion is null then raise exception 'Acción de grupo inválida'; end if;
  if p_accion<>'crear' then
    select * into g from public.maquinaria_grupos where id=p_id and empresa=p_empresa for update;
    if not found then raise exception 'Grupo no encontrado en esta empresa'; end if;
    if p_version is null or p_version<>g.actualizado_en then raise exception 'El grupo cambió. Actualiza la vista antes de continuar'; end if;
  end if;
  if p_accion='eliminar' then
    delete from public.maquinaria_grupos where id=g.id and empresa=p_empresa;
    return jsonb_build_object('id',g.id,'eliminado',true);
  end if;
  if coalesce(length(btrim(p_nombre)),0) not between 1 and 120 or coalesce(length(p_descripcion),0)>1000 then raise exception 'Revisa el nombre y descripción del grupo'; end if;
  select array_agg(distinct x order by x) into ids from unnest(p_equipo_ids) x where x is not null;
  if coalesce(cardinality(ids),0) not between 1 and 500 then raise exception 'Selecciona entre 1 y 500 equipos'; end if;
  perform id from public.inventario_maquinaria where empresa=p_empresa and id=any(ids) order by id for key share;
  select count(*) into n from public.inventario_maquinaria where empresa=p_empresa and id=any(ids);
  if n<>cardinality(ids) then raise exception 'Hay equipos inexistentes o de otra empresa'; end if;
  if p_accion='crear' then
    insert into public.maquinaria_grupos(empresa,nombre,descripcion,actualizado_por) values(p_empresa,btrim(p_nombre),coalesce(p_descripcion,''),auth.uid()) returning * into g;
  else
    update public.maquinaria_grupos set nombre=btrim(p_nombre),descripcion=coalesce(p_descripcion,''),actualizado_por=auth.uid(),actualizado_en=clock_timestamp() where id=g.id;
    delete from public.maquinaria_grupos_equipos where grupo_id=g.id and empresa=p_empresa;
  end if;
  insert into public.maquinaria_grupos_equipos(grupo_id,empresa,equipo_id) select g.id,p_empresa,unnest(ids);
  return jsonb_build_object('id',g.id,'equipos',cardinality(ids));
exception when unique_violation then raise exception 'Ya existe un grupo con ese nombre en la empresa';
end; $$;
revoke all on function private.maquinaria_gestionar_grupo(text,text,bigint,text,text,integer[],timestamptz) from public,anon;
grant execute on function private.maquinaria_gestionar_grupo(text,text,bigint,text,text,integer[],timestamptz) to authenticated;
create function public.gestionar_grupo_equipos(p_empresa text,p_accion text,p_id bigint default null,p_nombre text default null,p_descripcion text default '',p_equipo_ids integer[] default '{}',p_version timestamptz default null)
returns jsonb language sql security invoker set search_path='' as $$
select private.maquinaria_gestionar_grupo(p_empresa,p_accion,p_id,p_nombre,p_descripcion,p_equipo_ids,p_version); $$;
revoke all on function public.gestionar_grupo_equipos(text,text,bigint,text,text,integer[],timestamptz) from public,anon;
grant execute on function public.gestionar_grupo_equipos(text,text,bigint,text,text,integer[],timestamptz) to authenticated;

create function private.maquinaria_asignar_grupo(p_empresa text,p_grupo_id bigint,p_version timestamptz,p_equipo_ids integer[],p_destino text,p_desde date,p_hasta date,p_confirmar_traslado boolean)
returns jsonb language plpgsql security definer set search_path='' as $$
declare g public.maquinaria_grupos; ids integer[]; conflict_codes text; n integer; hoy date:=(now() at time zone 'America/Santiago')::date;
begin
  if not private.maquinaria_puede_editar_grupos(p_empresa) then raise exception 'Sin permiso para asignar grupos de esta empresa'; end if;
  perform pg_advisory_xact_lock(hashtextextended('maquinaria_grupos:'||p_empresa,0));
  select * into g from public.maquinaria_grupos where id=p_grupo_id and empresa=p_empresa for update;
  if not found then raise exception 'Grupo no encontrado en esta empresa'; end if;
  if p_version is null or p_version<>g.actualizado_en then raise exception 'El grupo cambió. Actualiza y revisa sus equipos'; end if;
  if p_desde is null or p_desde>hoy or p_hasta<p_desde then raise exception 'Revisa las fechas. Para asignaciones futuras utiliza Reservas'; end if;
  p_destino:=nullif(btrim(p_destino),'');
  if p_destino is not null and not exists(select 1 from public.obras where empresa=p_empresa and nombre=p_destino) then raise exception 'La obra no pertenece a esta empresa'; end if;
  select array_agg(equipo_id order by equipo_id) into ids from public.maquinaria_grupos_equipos where grupo_id=g.id and empresa=p_empresa;
  if coalesce(cardinality(ids),0)=0 then raise exception 'El grupo no tiene equipos'; end if;
  if ids is distinct from (select array_agg(distinct x order by x) from unnest(p_equipo_ids) x where x is not null) then raise exception 'Cambió la composición del grupo. Actualiza y revisa sus equipos'; end if;
  perform id from public.inventario_maquinaria where empresa=p_empresa and id=any(ids) order by id for update;
  if p_destino is not null then
    select string_agg(coalesce(patente,id::text),', ') into conflict_codes from public.inventario_maquinaria where empresa=p_empresa and id=any(ids) and lower(coalesce(estado_equipo,'')) ~ 'mantenci|mantenimiento|paraliz|fuera de servicio|inoperativ';
    if conflict_codes is not null then raise exception 'Equipos no operativos: %. No se asignó ningún equipo',conflict_codes; end if;
    if not coalesce(p_confirmar_traslado,false) and exists(select 1 from public.inventario_maquinaria where empresa=p_empresa and id=any(ids) and coalesce(btrim(obra_nombre),'')<>'' and lower(obra_nombre) not like '%bodega%' and lower(obra_nombre) not in ('libre','sin asignar') and obra_nombre<>p_destino) then raise exception 'Confirma el traslado de equipos que están en otra obra'; end if;
  end if;
  if exists(select 1 from public.maquinaria_arriendos where empresa=p_empresa and equipo_id=any(ids) and lower(coalesce(estado,''))='activo' and fecha_inicio<=coalesce(p_hasta,'infinity'::date) and (fecha_fin is null or fecha_fin>=p_desde)) then raise exception 'Hay equipos con arriendo activo en ese período. No se asignó ningún equipo'; end if;
  if p_destino is not null and exists(select 1 from public.maquinaria_reservas where empresa=p_empresa and equipo_id=any(select x::text from unnest(ids) x) and lower(coalesce(estado,'')) not in ('cancelada','cancelado','anulado','anulada','finalizado','finalizada') and fecha_inicio<=coalesce(p_hasta,'infinity'::date) and (fecha_fin is null or fecha_fin>=p_desde)) then raise exception 'Hay reservas coincidentes. Resuélvelas antes de asignar el grupo; no se modificó ningún equipo'; end if;
  update public.inventario_maquinaria set obra_nombre=p_destino,fecha_asig=case when p_destino is not null then p_desde end,fecha_hasta_estimada=case when p_destino is not null then p_hasta end where empresa=p_empresa and id=any(ids);
  get diagnostics n=row_count;
  if n<>cardinality(ids) then raise exception 'Cambió el inventario; no se completó la asignación'; end if;
  update public.maquinaria_grupos set actualizado_por=auth.uid(),actualizado_en=clock_timestamp(),historial=historial||jsonb_build_array(jsonb_build_object('actor',auth.uid(),'fecha',now(),'destino',p_destino,'desde',p_desde,'hasta',p_hasta,'equipos',ids)) where id=g.id;
  return jsonb_build_object('asignados',n,'destino',p_destino);
end; $$;
revoke all on function private.maquinaria_asignar_grupo(text,bigint,timestamptz,integer[],text,date,date,boolean) from public,anon;
grant execute on function private.maquinaria_asignar_grupo(text,bigint,timestamptz,integer[],text,date,date,boolean) to authenticated;
create function public.asignar_grupo_equipos(p_empresa text,p_grupo_id bigint,p_version timestamptz,p_equipo_ids integer[],p_destino text,p_desde date,p_hasta date default null,p_confirmar_traslado boolean default false)
returns jsonb language sql security invoker set search_path='' as $$
select private.maquinaria_asignar_grupo(p_empresa,p_grupo_id,p_version,p_equipo_ids,p_destino,p_desde,p_hasta,p_confirmar_traslado); $$;
revoke all on function public.asignar_grupo_equipos(text,bigint,timestamptz,integer[],text,date,date,boolean) from public,anon;
grant execute on function public.asignar_grupo_equipos(text,bigint,timestamptz,integer[],text,date,date,boolean) to authenticated;
notify pgrst,'reload schema';
