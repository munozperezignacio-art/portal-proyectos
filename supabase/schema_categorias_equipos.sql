-- Categoría independiente del nombre del equipo; nunca modifica su historial.
create table public.maquinaria_categorias (
  id bigint generated always as identity primary key,
  empresa text not null, nombre text not null check(length(btrim(nombre)) between 1 and 120),
  creado_en timestamptz not null default now(),
  unique(id,empresa)
);
create unique index maquinaria_categorias_nombre_idx on public.maquinaria_categorias(empresa,lower(btrim(nombre)));
alter table public.maquinaria_categorias enable row level security;
revoke all on public.maquinaria_categorias from public,anon,authenticated;
grant select on public.maquinaria_categorias to authenticated;
create policy categorias_empresa_lectura on public.maquinaria_categorias for select to authenticated
using((select private.obraxis_actor_can_access_company(empresa)));
alter table public.inventario_maquinaria add column categoria_id bigint;
alter table public.inventario_maquinaria add constraint inventario_categoria_empresa_fk
foreign key(categoria_id,empresa) references public.maquinaria_categorias(id,empresa);
create index inventario_maquinaria_categoria_idx on public.inventario_maquinaria(categoria_id,empresa);

-- Conserva la clasificación anterior por tipo. No infiere categorías nuevas a
-- partir de marcas o modelos ni cambia nombres, tarifas o asignaciones.
insert into public.maquinaria_categorias(empresa,nombre)
select empresa,min(btrim(tipo)) from public.inventario_maquinaria
where empresa is not null and nullif(btrim(tipo),'') is not null
group by empresa,lower(btrim(tipo));
update public.inventario_maquinaria m set categoria_id=c.id
from public.maquinaria_categorias c where m.empresa=c.empresa and lower(btrim(m.tipo))=lower(btrim(c.nombre));

create function private.maquinaria_puede_configurar_categorias(p_empresa text)
returns boolean language sql stable security definer set search_path='' as $$
select auth.uid() is not null and private.obraxis_actor_can_access_company(p_empresa) and exists(
  select 1 from public.usuarios u left join public.roles r on r.empresa=u.empresa and r.nombre=u.rol
  cross join lateral(select coalesce(r.permisos,'{}'::jsonb)||coalesce(u.permisos,'{}'::jsonb) permisos,
    lower(coalesce(u.rol_base,r.rol_base,u.rol,'')) rol) e
  where u.auth_user_id=auth.uid() and not coalesce(r.archivado,false)
    and (u.empresa=p_empresa or (u.empresa='Obraxis' and e.rol in ('superusuario','superadmin')))
    and case when e.rol in ('superusuario','superadmin') then true
      when e.permisos ? 'maquinaria.inventario.configurar' then e.permisos->>'maquinaria.inventario.configurar'='true'
      else e.rol like '%admin%' or e.rol like '%gerencia%' end);
$$;
revoke all on function private.maquinaria_puede_configurar_categorias(text) from public,anon,authenticated;

-- Único punto de escritura: autorización por rol/empresa y reasignación atómica.
create function private.maquinaria_gestionar_categoria(p_empresa text,p_accion text,p_id bigint,p_nombre text,p_reemplazo bigint)
returns bigint language plpgsql security definer set search_path='' as $$
declare v_id bigint; v_usos integer;
begin
  if not private.maquinaria_puede_configurar_categorias(p_empresa) then raise exception 'Sin permiso para configurar categorías de esta empresa'; end if;
  perform pg_advisory_xact_lock(hashtextextended('maquinaria_categorias:'||p_empresa,0));
  if p_accion='crear' then
    insert into public.maquinaria_categorias(empresa,nombre) values(p_empresa,btrim(p_nombre)) returning id into v_id;
    return v_id;
  end if;
  select id into v_id from public.maquinaria_categorias where id=p_id and empresa=p_empresa for update;
  if not found then raise exception 'Categoría no encontrada en esta empresa'; end if;
  if p_accion='editar' then
    update public.maquinaria_categorias set nombre=btrim(p_nombre) where id=v_id and empresa=p_empresa;
  elsif p_accion='eliminar' then
    select count(*) into v_usos from public.inventario_maquinaria where empresa=p_empresa and categoria_id=v_id;
    if p_reemplazo is not null and (p_reemplazo=v_id or not exists(select 1 from public.maquinaria_categorias where id=p_reemplazo and empresa=p_empresa)) then
      raise exception 'Elige otra categoría de la misma empresa'; end if;
    if v_usos>0 and p_reemplazo is null then raise exception 'La categoría tiene % equipo(s). Selecciona una categoría de reemplazo.',v_usos; end if;
    update public.inventario_maquinaria set categoria_id=p_reemplazo where empresa=p_empresa and categoria_id=v_id;
    delete from public.maquinaria_categorias where id=v_id and empresa=p_empresa;
  else raise exception 'Acción de categoría inválida'; end if;
  return v_id;
exception when unique_violation then raise exception 'Ya existe una categoría con ese nombre en la empresa';
end; $$;
revoke all on function private.maquinaria_gestionar_categoria(text,text,bigint,text,bigint) from public,anon;
grant execute on function private.maquinaria_gestionar_categoria(text,text,bigint,text,bigint) to authenticated;
create function public.gestionar_categoria_equipo(p_empresa text,p_accion text,p_id bigint default null,p_nombre text default null,p_reemplazo bigint default null)
returns bigint language sql security invoker set search_path='' as $$
select private.maquinaria_gestionar_categoria(p_empresa,p_accion,p_id,p_nombre,p_reemplazo);$$;
revoke all on function public.gestionar_categoria_equipo(text,text,bigint,text,bigint) from public,anon;
grant execute on function public.gestionar_categoria_equipo(text,text,bigint,text,bigint) to authenticated;
notify pgrst,'reload schema';
