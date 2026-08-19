-- Jerarquía explícita para capítulos, subcapítulos y partidas de presupuesto.
alter table public.presupuestos_items
  add column if not exists tipo_item text,
  add column if not exists parent_id integer,
  add column if not exists nivel integer,
  add column if not exists es_titulo boolean,
  add column if not exists codigo_origen text,
  add column if not exists origen_importacion text;

update public.presupuestos_items
set tipo_item = case
      when upper(coalesce(unidad, '')) in ('TITULO', 'GRUPO', 'CAPITULO') then 'CAPITULO'
      else 'PARTIDA'
    end,
    nivel = 0,
    es_titulo = upper(coalesce(unidad, '')) in ('TITULO', 'GRUPO', 'CAPITULO'),
    codigo_origen = coalesce(nullif(codigo_origen, ''), codigo),
    origen_importacion = coalesce(nullif(origen_importacion, ''), 'LEGACY')
where tipo_item is null or nivel is null or es_titulo is null
   or codigo_origen is null or origen_importacion is null;

-- Relaciona los grupos existentes con el ancestro de código más largo disponible.
with parents as (
  select child.id,
    (
      select candidate.id
      from public.presupuestos_items candidate
      where candidate.presupuesto_id = child.presupuesto_id
        and candidate.id <> child.id
        and candidate.tipo_item in ('CAPITULO', 'SUBCAPITULO')
        and child.codigo like candidate.codigo || '.%'
      order by length(candidate.codigo) desc, candidate.orden desc, candidate.id desc
      limit 1
    ) parent_id
  from public.presupuestos_items child
)
update public.presupuestos_items child
set parent_id = parents.parent_id
from parents
where parents.id = child.id and child.parent_id is null and parents.parent_id is not null;

with recursive tree as (
  select item.id, 0 as nivel
  from public.presupuestos_items item
  where item.parent_id is null
  union all
  select child.id, tree.nivel + 1
  from public.presupuestos_items child
  join tree on tree.id = child.parent_id
)
update public.presupuestos_items item
set nivel = tree.nivel,
    tipo_item = case
      when item.tipo_item = 'CAPITULO' and tree.nivel > 0 then 'SUBCAPITULO'
      else item.tipo_item
    end,
    es_titulo = item.tipo_item <> 'PARTIDA'
from tree
where tree.id = item.id;

alter table public.presupuestos_items
  alter column tipo_item set default 'PARTIDA',
  alter column tipo_item set not null,
  alter column nivel set default 0,
  alter column nivel set not null,
  alter column es_titulo set default false,
  alter column es_titulo set not null,
  alter column origen_importacion set default 'MANUAL',
  alter column origen_importacion set not null;

alter table public.presupuestos_items
  drop constraint if exists presupuestos_items_tipo_item_check,
  add constraint presupuestos_items_tipo_item_check
    check (tipo_item in ('CAPITULO', 'SUBCAPITULO', 'PARTIDA')),
  drop constraint if exists presupuestos_items_nivel_check,
  add constraint presupuestos_items_nivel_check check (nivel >= 0),
  drop constraint if exists presupuestos_items_parent_distinto_check,
  add constraint presupuestos_items_parent_distinto_check check (parent_id is null or parent_id <> id),
  drop constraint if exists presupuestos_items_parent_id_fkey,
  add constraint presupuestos_items_parent_id_fkey foreign key (parent_id)
    references public.presupuestos_items(id) on delete no action deferrable initially deferred;

create index if not exists presupuestos_items_jerarquia_idx
  on public.presupuestos_items (presupuesto_id, parent_id, orden, id);
create index if not exists presupuestos_items_codigo_origen_idx
  on public.presupuestos_items (presupuesto_id, origen_importacion, codigo_origen);

create or replace function public.validar_jerarquia_item_presupuesto()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_parent public.presupuestos_items%rowtype;
begin
  new.es_titulo := new.tipo_item <> 'PARTIDA';
  if new.tipo_item = 'CAPITULO' and new.parent_id is not null then
    raise exception 'Un capítulo raíz no puede tener padre.';
  end if;
  if new.tipo_item = 'SUBCAPITULO' and new.parent_id is null then
    raise exception 'Un subcapítulo debe tener padre.';
  end if;
  if new.parent_id is not null then
    select * into v_parent from public.presupuestos_items where id = new.parent_id;
    if v_parent.id is null or v_parent.presupuesto_id is distinct from new.presupuesto_id then
      raise exception 'El padre debe pertenecer al mismo presupuesto.';
    end if;
    if v_parent.tipo_item = 'PARTIDA' then
      raise exception 'Una partida no puede contener elementos.';
    end if;
    new.nivel := v_parent.nivel + 1;
  else
    new.nivel := 0;
  end if;
  if new.tipo_item <> 'PARTIDA' then
    new.cantidad := 0;
    new.costo_unitario := 0;
    new.unidad := case when new.tipo_item = 'CAPITULO' then 'TITULO' else 'GRUPO' end;
  end if;
  return new;
end;
$$;

drop trigger if exists presupuestos_items_validar_jerarquia on public.presupuestos_items;
create trigger presupuestos_items_validar_jerarquia
before insert or update of presupuesto_id, parent_id, tipo_item, nivel
on public.presupuestos_items
for each row execute function public.validar_jerarquia_item_presupuesto();

revoke all on function public.validar_jerarquia_item_presupuesto() from public, anon, authenticated;

create or replace function public.importar_presupuesto_jerarquico(
  p_presupuesto_id integer,
  p_items jsonb,
  p_recursos jsonb,
  p_moneda_base text default 'CLP',
  p_origen text default 'EXCEL'
) returns jsonb
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_empresa text;
  v_item jsonb;
  v_recurso jsonb;
  v_item_id integer;
  v_parent_id integer;
  v_recurso_id integer;
  v_ids jsonb := '{}'::jsonb;
  v_items_count integer := 0;
  v_chapters_count integer := 0;
  v_links integer := 0;
  v_tipo text;
begin
  if (select auth.uid()) is null then raise exception 'Sesión requerida.'; end if;
  select proyecto.empresa into v_empresa
  from public.presupuestos_proyectos proyecto where proyecto.id = p_presupuesto_id;
  if v_empresa is null then raise exception 'Presupuesto no encontrado.'; end if;
  if not exists (
    select 1 from public.usuarios usuario
    where usuario.auth_user_id = (select auth.uid())
      and (lower(usuario.empresa) = lower(v_empresa)
        or lower(coalesce(usuario.rol_base, usuario.rol, '')) in ('superusuario','superadmin'))
  ) then raise exception 'No autorizado para importar en esta empresa.'; end if;
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then
    raise exception 'El archivo no contiene elementos.';
  end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) source
    group by lower(source->>'codigo') having count(*) > 1
  ) then raise exception 'El archivo contiene códigos repetidos.'; end if;
  if exists (
    select 1 from jsonb_array_elements(p_items) source
    join public.presupuestos_items existing
      on existing.presupuesto_id = p_presupuesto_id
     and lower(existing.codigo) = lower(source->>'codigo')
  ) then raise exception 'Existen códigos que ya están registrados en el presupuesto.'; end if;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    v_tipo := coalesce(nullif(upper(v_item->>'tipo_item'), ''), 'PARTIDA');
    v_parent_id := null;
    if nullif(v_item->>'parent_codigo', '') is not null then
      v_parent_id := nullif(v_ids->>lower(v_item->>'parent_codigo'), '')::integer;
      if v_parent_id is null then
        raise exception 'El padre % debe aparecer antes que su hijo %.', v_item->>'parent_codigo', v_item->>'codigo';
      end if;
    end if;
    insert into public.presupuestos_items (
      presupuesto_id, codigo, partida, unidad, cantidad, costo_unitario, rendimiento_meta,
      tipo_metodologia, leyes_sociales_pct, herramientas_menores_pct, imponderables_pct,
      dias_habiles_mes, horas_jornada, precio_combustible, divisor_cantidad, divisor_unidad,
      costo_materiales, costo_mano_obra, costo_maquinaria, costo_herramientas, costo_otros,
      orden, tipo_item, parent_id, nivel, es_titulo, codigo_origen, origen_importacion
    ) values (
      p_presupuesto_id, v_item->>'codigo', v_item->>'partida',
      coalesce(nullif(v_item->>'unidad',''), 'un'),
      coalesce((v_item->>'cantidad')::numeric,0), coalesce((v_item->>'costo_unitario')::numeric,0),
      coalesce((v_item->>'rendimiento_meta')::numeric,0),
      coalesce(nullif(v_item->>'tipo_metodologia',''),'Precio Unitario'),
      coalesce((v_item->>'leyes_sociales_pct')::numeric,0), coalesce((v_item->>'herramientas_menores_pct')::numeric,0),
      coalesce((v_item->>'imponderables_pct')::numeric,0), coalesce((v_item->>'dias_habiles_mes')::numeric,22),
      coalesce((v_item->>'horas_jornada')::numeric,9), coalesce((v_item->>'precio_combustible')::numeric,1050),
      nullif((v_item->>'divisor_cantidad')::numeric,0), nullif(v_item->>'divisor_unidad',''),
      coalesce((v_item->>'costo_materiales')::numeric,0), coalesce((v_item->>'costo_mano_obra')::numeric,0),
      coalesce((v_item->>'costo_maquinaria')::numeric,0), coalesce((v_item->>'costo_herramientas')::numeric,0),
      coalesce((v_item->>'costo_otros')::numeric,0), coalesce((v_item->>'orden')::integer, v_items_count),
      v_tipo, v_parent_id, coalesce((v_item->>'nivel')::integer,0), v_tipo <> 'PARTIDA',
      coalesce(nullif(v_item->>'codigo_origen',''), v_item->>'codigo'), upper(coalesce(nullif(p_origen,''),'EXCEL'))
    ) returning id into v_item_id;
    v_ids := v_ids || jsonb_build_object(lower(v_item->>'codigo'), v_item_id);
    v_items_count := v_items_count + 1;
    if v_tipo <> 'PARTIDA' then v_chapters_count := v_chapters_count + 1; end if;

    if v_tipo = 'PARTIDA' then
      for v_recurso in
        select value from jsonb_array_elements(coalesce(p_recursos,'[]'::jsonb))
        where value->>'codigo_partida' = v_item->>'codigo'
      loop
        select recurso.id into v_recurso_id
        from public.recursos_presupuesto recurso
        where recurso.presupuesto_id = p_presupuesto_id
          and lower(recurso.recurso) = lower(v_recurso->>'recurso')
          and lower(recurso.tipo) = lower(v_recurso->>'tipo')
          and lower(trim(split_part(recurso.unidad,'|',1))) = lower(trim(v_recurso->>'unidad'))
          and recurso.costo_unitario = coalesce((v_recurso->>'costo_unitario')::numeric,0)
        order by recurso.id limit 1;
        if v_recurso_id is null then
          insert into public.recursos_presupuesto
            (presupuesto_id,recurso,tipo,unidad,costo_unitario,cantidad_estimada,categoria)
          values (p_presupuesto_id,v_recurso->>'recurso',coalesce(nullif(v_recurso->>'tipo',''),'Otros'),
            coalesce(nullif(v_recurso->>'unidad',''),'un') || ' | ' || coalesce(nullif(p_moneda_base,''),'CLP'),
            coalesce((v_recurso->>'costo_unitario')::numeric,0),coalesce((v_recurso->>'cantidad_unidad')::numeric,0),
            coalesce(nullif(v_recurso->>'categoria',''),'Sin categoría'))
          returning id into v_recurso_id;
        end if;
        insert into public.presupuestos_items_recursos
          (item_id,recurso_id,cantidad_unidad,rendimiento,consumo_combustible_lh)
        values (v_item_id,v_recurso_id,coalesce((v_recurso->>'cantidad_unidad')::numeric,0),
          coalesce((v_recurso->>'rendimiento')::numeric,1),coalesce((v_recurso->>'consumo_combustible_lh')::numeric,0));
        v_links := v_links + 1;
        v_recurso_id := null;
      end loop;
    end if;
  end loop;
  return jsonb_build_object('elementos',v_items_count,'capitulos',v_chapters_count,
    'partidas',v_items_count-v_chapters_count,'recursos_asignados',v_links,'presupuesto_id',p_presupuesto_id);
end;
$$;

revoke all on function public.importar_presupuesto_jerarquico(integer,jsonb,jsonb,text,text) from public, anon;
grant execute on function public.importar_presupuesto_jerarquico(integer,jsonb,jsonb,text,text) to authenticated, service_role;
