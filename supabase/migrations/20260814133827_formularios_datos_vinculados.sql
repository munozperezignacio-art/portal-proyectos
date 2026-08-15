alter table public.prevencion_respuestas
  add column if not exists centro_gestion_id integer references public.facturacion_centros_gestion(id) on delete restrict,
  add column if not exists obra_id integer references public.obras(id) on delete restrict;

create index if not exists prevencion_respuestas_centro_gestion_id_idx
  on public.prevencion_respuestas (centro_gestion_id)
  where centro_gestion_id is not null;
create index if not exists prevencion_respuestas_obra_id_idx
  on public.prevencion_respuestas (obra_id)
  where obra_id is not null;

create or replace function public.formulario_centros_gestion(p_token text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_empresa text;
  v_centros jsonb;
  v_result jsonb;
begin
  select formulario.empresa,
         coalesce(case when jsonb_typeof(formulario.campos) = 'object' then formulario.campos->'control_documental'->'centros_gestion_ids' end, '[]'::jsonb)
  into v_empresa, v_centros
  from public.prevencion_formularios formulario
  where formulario.publico_token = p_token
  limit 1;

  if v_empresa is null or jsonb_typeof(v_centros) <> 'array' then return '[]'::jsonb; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', centro.id,
    'codigo', centro.codigo,
    'nombre', centro.nombre,
    'tipo', centro.tipo,
    'obra_id', obra.id,
    'obra_nombre', obra.nombre
  ) order by centro.codigo), '[]'::jsonb)
  into v_result
  from public.facturacion_centros_gestion centro
  left join lateral (
    select candidate.id, candidate.nombre
    from public.obras candidate
    where candidate.empresa = v_empresa
      and candidate.centro_gestion_id = centro.id
    order by candidate.id
    limit 1
  ) obra on true
  where centro.empresa = v_empresa
    and centro.activo = true
    and exists (select 1 from jsonb_array_elements_text(v_centros) permitted where permitted = centro.id::text);

  return v_result;
end;
$$;

create or replace function public.formulario_catalogo_vinculado(p_token text, p_campo_id text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_empresa text;
  v_campos jsonb;
  v_campo jsonb;
  v_centros jsonb;
  v_selector text;
  v_result jsonb;
begin
  select formulario.empresa,
         formulario.campos,
         coalesce(case when jsonb_typeof(formulario.campos) = 'object' then formulario.campos->'control_documental'->'centros_gestion_ids' end, '[]'::jsonb)
  into v_empresa, v_campos, v_centros
  from public.prevencion_formularios formulario
  where formulario.publico_token = p_token
  limit 1;

  if v_empresa is null or jsonb_typeof(v_centros) <> 'array' then return '[]'::jsonb; end if;

  select item into v_campo
  from jsonb_array_elements(case when jsonb_typeof(v_campos) = 'array' then v_campos else coalesce(v_campos->'items', '[]'::jsonb) end) item
  where item->>'id' = p_campo_id
    and item->>'type' = 'data_lookup'
  limit 1;

  if v_campo is null then return '[]'::jsonb; end if;
  v_selector := nullif(v_campo->>'selectorKey', '');
  if v_selector is null then return '[]'::jsonb; end if;

  if v_campo->>'source' = 'risk_matrix' then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        '_id', fila.id::text,
        '_display', coalesce(nullif(fila.datos->>v_selector, ''), 'Fila ' || fila.orden),
        'obra_id', matriz.obra_id,
        'centro_gestion_id', obra.centro_gestion_id
      ) || coalesce((
        select jsonb_object_agg(clave, fila.datos->clave)
        from jsonb_array_elements_text(jsonb_build_array(v_selector) || coalesce(v_campo->'autofillKeys', '[]'::jsonb)) clave
      ), '{}'::jsonb)
      order by fila.orden
    ), '[]'::jsonb)
    into v_result
    from public.prevencion_matrices_riesgo matriz
    join public.prevencion_matriz_riesgo_filas fila on fila.matriz_id = matriz.id and fila.empresa = matriz.empresa
    left join public.obras obra on obra.id = matriz.obra_id
    where matriz.empresa = v_empresa
      and matriz.id::text = v_campo->>'matrixId'
      and (
        matriz.obra_id is null
        or exists (select 1 from jsonb_array_elements_text(v_centros) permitted where permitted = obra.centro_gestion_id::text)
      );
  elsif v_campo->>'source' = 'machinery' then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        '_id', equipo.id::text,
        '_display', concat_ws(' · ', equipo.tipo, nullif(equipo.patente, '')),
        'obra_id', obra.id,
        'centro_gestion_id', obra.centro_gestion_id
      ) || coalesce((
        select jsonb_object_agg(clave, base.datos->clave)
        from jsonb_array_elements_text(jsonb_build_array(v_selector) || coalesce(v_campo->'autofillKeys', '[]'::jsonb)) clave
      ), '{}'::jsonb)
      order by equipo.tipo, equipo.patente
    ), '[]'::jsonb)
    into v_result
    from public.inventario_maquinaria equipo
    left join public.obras obra on obra.empresa = v_empresa and lower(trim(obra.nombre)) = lower(trim(equipo.obra_nombre))
    cross join lateral (select jsonb_build_object(
      'equipo', concat_ws(' · ', equipo.tipo, nullif(equipo.patente, '')),
      'tipo', equipo.tipo,
      'patente', equipo.patente,
      'marca', equipo.marca,
      'estado_equipo', equipo.estado_equipo,
      'horometro_inicial', equipo.horometro_inicial
    ) datos) base
    where equipo.empresa = v_empresa
      and exists (select 1 from jsonb_array_elements_text(v_centros) permitted where permitted = obra.centro_gestion_id::text);
  else
    v_result := '[]'::jsonb;
  end if;

  return coalesce(v_result, '[]'::jsonb);
end;
$$;

revoke all on function public.formulario_centros_gestion(text) from public;
revoke all on function public.formulario_catalogo_vinculado(text, text) from public;
grant execute on function public.formulario_centros_gestion(text) to anon, authenticated, service_role;
grant execute on function public.formulario_catalogo_vinculado(text, text) to anon, authenticated, service_role;

;
