alter table public.presupuestos_proyectos
  add column if not exists empresa text;

update public.presupuestos_proyectos set empresa = 'Obraxis' where nullif(trim(empresa), '') is null;
alter table public.presupuestos_proyectos alter column empresa set default 'Obraxis';
alter table public.presupuestos_proyectos alter column empresa set not null;

alter table public.presupuestos_items
  add column if not exists divisor_cantidad numeric,
  add column if not exists divisor_unidad text;

update public.presupuestos_items
set tipo_metodologia = 'Costo',
    divisor_cantidad = coalesce(nullif(divisor_cantidad, 0), 1),
    divisor_unidad = coalesce(nullif(divisor_unidad, ''), nullif(unidad, ''), 'unidad')
where tipo_metodologia = 'Costo-Tiempo';

alter table public.presupuestos_items drop constraint if exists presupuestos_items_metodologia_check;
alter table public.presupuestos_items add constraint presupuestos_items_metodologia_check
  check (tipo_metodologia is null or tipo_metodologia in ('Precio Unitario', 'Costo'));

alter table public.presupuestos_proyectos drop constraint if exists presupuestos_proyectos_nombre_key;
create unique index if not exists presupuestos_proyectos_empresa_nombre_uidx
  on public.presupuestos_proyectos (lower(empresa), lower(nombre));
create index if not exists presupuestos_proyectos_empresa_idx on public.presupuestos_proyectos (empresa);

create or replace function public.importar_presupuesto_excel(
  p_presupuesto_id integer,
  p_partidas jsonb,
  p_recursos jsonb,
  p_moneda_base text default 'CLP'
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_empresa text;
  v_partida jsonb;
  v_recurso jsonb;
  v_item_id integer;
  v_recurso_id integer;
  v_items integer := 0;
  v_links integer := 0;
begin
  if (select auth.uid()) is null then raise exception 'Sesión requerida.'; end if;
  select proyecto.empresa into v_empresa from public.presupuestos_proyectos proyecto where proyecto.id = p_presupuesto_id;
  if v_empresa is null then raise exception 'Presupuesto no encontrado.'; end if;
  if not exists (
    select 1 from public.usuarios usuario
    where usuario.auth_user_id = (select auth.uid())
      and (lower(usuario.empresa) = lower(v_empresa) or lower(coalesce(usuario.rol_base, usuario.rol, '')) in ('superusuario','superadmin'))
  )
  then raise exception 'No autorizado para importar en esta empresa.'; end if;
  if jsonb_typeof(p_partidas) <> 'array' or jsonb_array_length(p_partidas) = 0 then raise exception 'El archivo no contiene partidas.'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_partidas) source
    join public.presupuestos_items existing on existing.presupuesto_id = p_presupuesto_id and lower(existing.codigo) = lower(source->>'codigo')
  ) then raise exception 'Existen códigos de partida que ya están registrados en el presupuesto.'; end if;

  for v_partida in select value from jsonb_array_elements(p_partidas)
  loop
    insert into public.presupuestos_items (
      presupuesto_id,codigo,partida,unidad,cantidad,costo_unitario,rendimiento_meta,tipo_metodologia,
      leyes_sociales_pct,herramientas_menores_pct,imponderables_pct,dias_habiles_mes,horas_jornada,
      precio_combustible,divisor_cantidad,divisor_unidad,costo_materiales,costo_mano_obra,
      costo_maquinaria,costo_herramientas,costo_otros
    ) values (
      p_presupuesto_id,v_partida->>'codigo',v_partida->>'partida',coalesce(nullif(v_partida->>'unidad',''),'un'),
      coalesce((v_partida->>'cantidad')::numeric,0),coalesce((v_partida->>'costo_unitario')::numeric,0),
      coalesce((v_partida->>'rendimiento_meta')::numeric,0),coalesce(nullif(v_partida->>'tipo_metodologia',''),'Precio Unitario'),
      coalesce((v_partida->>'leyes_sociales_pct')::numeric,0),coalesce((v_partida->>'herramientas_menores_pct')::numeric,0),
      coalesce((v_partida->>'imponderables_pct')::numeric,0),coalesce((v_partida->>'dias_habiles_mes')::numeric,22),
      coalesce((v_partida->>'horas_jornada')::numeric,9),coalesce((v_partida->>'precio_combustible')::numeric,1050),
      nullif((v_partida->>'divisor_cantidad')::numeric,0),nullif(v_partida->>'divisor_unidad',''),
      coalesce((v_partida->>'costo_materiales')::numeric,0),coalesce((v_partida->>'costo_mano_obra')::numeric,0),
      coalesce((v_partida->>'costo_maquinaria')::numeric,0),coalesce((v_partida->>'costo_herramientas')::numeric,0),
      coalesce((v_partida->>'costo_otros')::numeric,0)
    ) returning id into v_item_id;
    v_items := v_items + 1;

    for v_recurso in select value from jsonb_array_elements(coalesce(p_recursos,'[]'::jsonb)) where value->>'codigo_partida' = v_partida->>'codigo'
    loop
      select recurso.id into v_recurso_id
      from public.recursos_presupuesto recurso
      where recurso.presupuesto_id = p_presupuesto_id
        and lower(recurso.recurso) = lower(v_recurso->>'recurso')
        and lower(recurso.tipo) = lower(v_recurso->>'tipo')
        and lower(split_part(recurso.unidad,'|',1)) = lower(v_recurso->>'unidad')
        and recurso.costo_unitario = coalesce((v_recurso->>'costo_unitario')::numeric,0)
      order by recurso.id limit 1;
      if v_recurso_id is null then
        insert into public.recursos_presupuesto (presupuesto_id,recurso,tipo,unidad,costo_unitario,cantidad_estimada)
        values (p_presupuesto_id,v_recurso->>'recurso',coalesce(nullif(v_recurso->>'tipo',''),'Otros'),
          coalesce(nullif(v_recurso->>'unidad',''),'un') || ' | ' || coalesce(nullif(p_moneda_base,''),'CLP'),
          coalesce((v_recurso->>'costo_unitario')::numeric,0),coalesce((v_recurso->>'cantidad_unidad')::numeric,0))
        returning id into v_recurso_id;
      end if;
      insert into public.presupuestos_items_recursos (item_id,recurso_id,cantidad_unidad,rendimiento,consumo_combustible_lh)
      values (v_item_id,v_recurso_id,coalesce((v_recurso->>'cantidad_unidad')::numeric,0),coalesce((v_recurso->>'rendimiento')::numeric,1),coalesce((v_recurso->>'consumo_combustible_lh')::numeric,0));
      v_links := v_links + 1;
      v_recurso_id := null;
    end loop;
  end loop;
  return jsonb_build_object('partidas',v_items,'recursos_asignados',v_links,'presupuesto_id',p_presupuesto_id);
end;
$$;

revoke all on function public.importar_presupuesto_excel(integer,jsonb,jsonb,text) from public, anon;
grant execute on function public.importar_presupuesto_excel(integer,jsonb,jsonb,text) to authenticated, service_role;
