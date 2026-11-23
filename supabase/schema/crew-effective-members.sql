-- Effective membership changes affect allocation calculations, never original reports.
alter table public.obra_cuadrillas add column if not exists version_integrantes integer not null default 0;
create table public.obra_cuadrilla_vigencias (
 cuadrilla_id bigint not null references public.obra_cuadrillas(id) on delete restrict,
 version integer not null, empresa text not null, obra_id integer not null references public.obras(id),
 desde date not null, miembros jsonb not null check(jsonb_typeof(miembros)='array'),
 motivo text not null, registrado_por uuid not null, registrado_en timestamptz not null default now(),
 anterior jsonb not null, primary key(cuadrilla_id,version)
);
alter table public.obra_cuadrilla_vigencias enable row level security;
revoke all on public.obra_cuadrilla_vigencias from public,anon,authenticated;
grant select on public.obra_cuadrilla_vigencias to authenticated;
create policy crew_history_read on public.obra_cuadrilla_vigencias for select to authenticated
 using(private.rrhh_partidas_permiso(empresa,obra_id,'ver'));

create function public.cuadrilla_integrantes_vigentes(p_empresa text,p_obra integer,p_cuadrilla bigint,p_fecha date,p_original jsonb)
returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce((select v.miembros from public.obra_cuadrilla_vigencias v
 where v.empresa=p_empresa and v.obra_id=p_obra and v.cuadrilla_id=p_cuadrilla and v.desde<=p_fecha
 order by v.version desc limit 1),p_original,'[]'::jsonb)
$$;
revoke all on function public.cuadrilla_integrantes_vigentes(text,integer,bigint,date,jsonb) from public,anon;
grant execute on function public.cuadrilla_integrantes_vigentes(text,integer,bigint,date,jsonb) to authenticated;

create function private.guardar_cuadrilla_vigencia(p_empresa text,p_obra integer,p_id bigint,p_version integer,p_nombre text,p_lider text,p_especialidad text,p_miembros jsonb,p_desde date,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.obra_cuadrillas; work_name text; affected integer; today date:=(now() at time zone 'America/Santiago')::date;
begin
 if auth.uid() is null or not private.rrhh_partidas_permiso(p_empresa,p_obra,'ver') or not private.obraxis_permission(p_empresa,case when p_id is null then 'obras.personal.crear' else 'obras.personal.editar' end) then raise exception 'No tienes permiso para guardar cuadrillas de esta obra' using errcode='42501';end if;
 if p_desde is null or p_desde>today then raise exception 'Selecciona una fecha de vigencia hasta hoy';end if;
 if p_desde<today and (not private.rrhh_partidas_permiso(p_empresa,p_obra,'editar') or not private.rrhh_partidas_permiso(p_empresa,p_obra,'aprobar')) then raise exception 'La retroactividad requiere permisos para editar y aprobar imputaciones' using errcode='42501';end if;
 if length(btrim(coalesce(p_nombre,'')))=0 or length(btrim(coalesce(p_motivo,'')))<5 then raise exception 'Indica nombre y un motivo de al menos 5 caracteres';end if;
 if p_miembros is null or jsonb_typeof(p_miembros)<>'array' then raise exception 'Integrantes inválidos';end if;
 if exists(select 1 from jsonb_array_elements(p_miembros) x where jsonb_typeof(x)<>'string') then raise exception 'Integrantes inválidos';end if;
 if exists(select 1 from jsonb_array_elements_text(p_miembros) x where (select count(*) from public.maestro_personal p where p.empresa=p_empresa and lower(btrim(p.nombre))=lower(btrim(x)))<>1) then raise exception 'Cada integrante debe corresponder a una persona única de la empresa';end if;
 if (select count(*) from jsonb_array_elements_text(p_miembros))<>(select count(distinct lower(btrim(x))) from jsonb_array_elements_text(p_miembros) x) then raise exception 'Hay integrantes repetidos';end if;
 select nombre into work_name from public.obras where id=p_obra and empresa=p_empresa;
 if work_name is null then raise exception 'Obra inexistente';end if;
 if p_id is not null then
  select * into c from public.obra_cuadrillas where id=p_id and empresa=p_empresa and obra_id=p_obra for update;
  if not found or c.version_integrantes is distinct from p_version then raise exception 'La cuadrilla cambió. Actualiza antes de guardar';end if;
 else
  insert into public.obra_cuadrillas(empresa,obra_id,obra_nombre,nombre,lider,especialidad,miembros)
  values(p_empresa,p_obra,work_name,btrim(p_nombre),p_lider,p_especialidad,p_miembros) returning * into c;
 end if;
 insert into public.obra_cuadrilla_vigencias(cuadrilla_id,version,empresa,obra_id,desde,miembros,motivo,registrado_por,anterior)
 values(c.id,c.version_integrantes+1,p_empresa,p_obra,p_desde,p_miembros,btrim(p_motivo),auth.uid(),to_jsonb(c));
 update public.obra_cuadrillas set nombre=btrim(p_nombre),lider=p_lider,especialidad=p_especialidad,miembros=p_miembros,version_integrantes=c.version_integrantes+1,updated_at=now() where id=c.id returning * into c;
 select count(*) into affected from public.avances_produccion_partidas a where a.empresa=p_empresa and a.obra_id=p_obra and a.cuadrilla_id=c.id and (a.created_at at time zone 'America/Santiago')::date>=p_desde;
 return jsonb_build_object('cuadrilla',to_jsonb(c),'reportes_vinculados',affected);
end $$;
revoke all on function private.guardar_cuadrilla_vigencia(text,integer,bigint,integer,text,text,text,jsonb,date,text) from public,anon;
grant execute on function private.guardar_cuadrilla_vigencia(text,integer,bigint,integer,text,text,text,jsonb,date,text) to authenticated;
create function public.guardar_cuadrilla_vigencia(p_empresa text,p_obra integer,p_id bigint,p_version integer,p_nombre text,p_lider text,p_especialidad text,p_miembros jsonb,p_desde date,p_motivo text)
returns jsonb language sql security invoker set search_path='' as $$
 select private.guardar_cuadrilla_vigencia(p_empresa,p_obra,p_id,p_version,p_nombre,p_lider,p_especialidad,p_miembros,p_desde,p_motivo)
$$;
revoke all on function public.guardar_cuadrilla_vigencia(text,integer,bigint,integer,text,text,text,jsonb,date,text) from public,anon;
grant execute on function public.guardar_cuadrilla_vigencia(text,integer,bigint,integer,text,text,text,jsonb,date,text) to authenticated;

create or replace view public.rrhh_costos_personal_automaticos with(security_invoker=true) as
 WITH finales AS (
         SELECT c.nomina_id,
            c.nomina_item_id,
            c.empresa,
            c.centro_gestion_id,
            c.dias,
            c.monto,
            c.distribuido_por,
            c.distribuido_en,
            c.dias_detalle,
            i.trabajador_id,
            i.trabajador_nombre,
            n.periodo,
            COALESCE(c.dias_detalle, ( SELECT jsonb_agg(jsonb_build_object('fecha', t.fecha, 'id', t.id) ORDER BY t.fecha, t.id) AS jsonb_agg
                   FROM rrhh_imputaciones_diarias t
                  WHERE t.empresa = c.empresa AND t.trabajador_id = i.trabajador_id AND to_char(t.fecha::timestamp with time zone, 'YYYY-MM'::text) = n.periodo AND t.centro_aprobado_id = c.centro_gestion_id AND t.estado = 'Aprobada'::text)) AS dias_json
           FROM rrhh_costos_centros_aprobados c
             JOIN rrhh_nomina_items i ON i.id = c.nomina_item_id
             JOIN rrhh_nominas_mensuales n ON n.id = c.nomina_id AND (n.estado = ANY (ARRAY['Cerrada'::text, 'Pagada'::text]))
        ), dias_finales AS (
         SELECT f.nomina_id,
            f.nomina_item_id,
            f.empresa,
            f.centro_gestion_id,
            f.dias,
            f.monto,
            f.distribuido_por,
            f.distribuido_en,
            f.dias_detalle,
            f.trabajador_id,
            f.trabajador_nombre,
            f.periodo,
            f.dias_json,
            d.value ->> 'fecha'::text AS fecha,
            row_number() OVER (PARTITION BY f.nomina_item_id, f.centro_gestion_id ORDER BY (d.value ->> 'fecha'::text)) AS orden,
            jsonb_array_length(f.dias_json) AS cantidad_dias
           FROM finales f
             CROSS JOIN LATERAL jsonb_array_elements(f.dias_json) d(value)
        ), efectivos AS (
         SELECT 'D-'::text || t.id AS id,
            t.empresa,
            t.trabajador_id,
            p.nombre AS trabajador,
            t.fecha,
            t.centro_aprobado_id AS centro_gestion_id,
            t.costo_total AS monto_real,
            NULL::bigint AS nomina_id,
            NULL::bigint AS nomina_item_id,
            'Provisión aprobada'::text AS fuente,
            t.costo_detalle AS desglose
           FROM rrhh_imputaciones_diarias t
             JOIN maestro_personal p ON p.id = t.trabajador_id AND p.empresa = t.empresa
          WHERE t.estado = 'Aprobada'::text AND t.costo_total IS NOT NULL AND NOT (EXISTS ( SELECT 1
                   FROM finales f
                  WHERE f.empresa = t.empresa AND f.trabajador_id = t.trabajador_id AND f.periodo = to_char(t.fecha::timestamp with time zone, 'YYYY-MM'::text))) AND NOT (EXISTS ( SELECT 1
                   FROM obra_liquidaciones l
                  WHERE l.empresa = t.empresa AND l.trabajador_id = t.trabajador_id AND l.periodo = to_char(t.fecha::timestamp with time zone, 'YYYY-MM'::text) AND l.nomina_item_id IS NOT NULL))
        UNION ALL
         SELECT (((('N-'::text || dias_finales.nomina_item_id) || '-'::text) || dias_finales.centro_gestion_id) || '-'::text) || dias_finales.orden,
            dias_finales.empresa,
            dias_finales.trabajador_id,
            dias_finales.trabajador_nombre,
            dias_finales.fecha::date AS fecha,
            dias_finales.centro_gestion_id,
            COALESCE(((dias_finales.dias_json -> (dias_finales.orden::integer - 1)) ->> 'monto'::text)::numeric, floor(dias_finales.monto / dias_finales.cantidad_dias::numeric) +
                CASE
                    WHEN dias_finales.orden::numeric <= mod(dias_finales.monto, dias_finales.cantidad_dias::numeric) THEN 1
                    ELSE 0
                END::numeric) AS "coalesce",
            dias_finales.nomina_id,
            dias_finales.nomina_item_id,
            'Nómina conciliada'::text,
            '{}'::jsonb AS jsonb
           FROM dias_finales
        )
 SELECT e.id,
    e.empresa,
    e.trabajador_id,
    e.trabajador,
    e.fecha,
    e.centro_gestion_id,
    e.monto_real,
    e.nomina_id,
    e.nomina_item_id,
    e.fuente,
    e.desglose,
    o.id AS obra_id,
    o.nombre AS obra_nombre,
    to_char(e.fecha::timestamp with time zone, 'YYYY-MM'::text) AS periodo,
    COALESCE(distribucion.detalle, '[]'::jsonb) AS obra_liquidaciones_partidas,
        CASE
            WHEN distribucion.detalle IS NOT NULL THEN 'Distribuida'::text
            WHEN NOT (EXISTS ( SELECT 1
               FROM avances_produccion_partidas a
              WHERE a.empresa = e.empresa AND a.obra_id = o.id AND a.cantidad > 0::numeric AND (a.created_at AT TIME ZONE 'America/Santiago'::text)::date = e.fecha)) THEN 'Pendiente de aprobación: sin reporte de avance'::text
            ELSE COALESCE(distribucion.motivo, 'Revisar vinculación de cuadrilla y partida'::text)
        END AS estado_imputacion_partidas
   FROM efectivos e
     LEFT JOIN obras o ON o.empresa = e.empresa AND o.centro_gestion_id = e.centro_gestion_id
     LEFT JOIN LATERAL ( WITH reportes AS (
                 SELECT a.id,
                    a.created_at,
                    a.obra_nombre,
                    a.supervisor,
                    a.frente,
                    a.partida,
                    a.unidad,
                    a.cantidad,
                    a.observaciones,
                    a.obra_id,
                    a.empresa,
                    a.partida_id,
                    a.cuadrilla_id,
                    a.cuadrilla_nombre,
                    public.cuadrilla_integrantes_vigentes(a.empresa,a.obra_id,a.cuadrilla_id,(a.created_at AT TIME ZONE 'America/Santiago')::date,a.cuadrilla_miembros),
                    a.horas_cuadrilla
                   FROM avances_produccion_partidas a
                  WHERE a.empresa = e.empresa AND a.obra_id = o.id AND (a.created_at AT TIME ZONE 'America/Santiago'::text)::date = e.fecha AND a.cantidad > 0::numeric AND (a.cuadrilla_id IS NULL OR (EXISTS ( SELECT 1
                           FROM jsonb_array_elements_text(
                                CASE
                                    WHEN jsonb_typeof(public.cuadrilla_integrantes_vigentes(a.empresa,a.obra_id,a.cuadrilla_id,(a.created_at AT TIME ZONE 'America/Santiago')::date,a.cuadrilla_miembros)) = 'array'::text THEN public.cuadrilla_integrantes_vigentes(a.empresa,a.obra_id,a.cuadrilla_id,(a.created_at AT TIME ZONE 'America/Santiago')::date,a.cuadrilla_miembros)
                                    ELSE '[]'::jsonb
                                END) m(value)
                          WHERE lower(btrim(m.value)) = lower(btrim(e.trabajador)))))
                ), resueltos AS (
                 SELECT a.id AS reporte_id,
                    p.id AS partida_id,
                    p.partida,
                    p.cantidad_presupuestada * p.costo_por_dia AS presupuesto,
                    a.cuadrilla_id IS NULL AS sin_cuadrilla
                   FROM reportes a
                     LEFT JOIN LATERAL ( SELECT b.id,
                            b.obra_nombre,
                            b.partida,
                            b.unidad,
                            b.rendimiento_meta,
                            b.cantidad_presupuestada,
                            b.costo_por_dia,
                            b.created_at,
                            b.codigo,
                            b.fecha_inicio,
                            b.fecha_termino,
                            b.obra_id,
                            b.empresa,
                            b.orden,
                            b.es_titulo,
                            b.predecesora,
                            b.tipo_relacion,
                            b.desfase_dias,
                            b.presupuesto_item_id,
                            b.tipo_item,
                            b.nivel,
                            b.parent_codigo,
                            b.moneda_pu,
                            b.pu_original,
                            b.cambio_pu_clp
                           FROM partidas_obra b
                          WHERE b.empresa = e.empresa AND b.obra_id = o.id AND NOT COALESCE(b.es_titulo, false) AND (COALESCE(b.unidad, ''::text) <> ALL (ARRAY['TITULO'::text, 'GRUPO'::text])) AND (b.id = a.partida_id OR a.partida_id IS NULL AND lower(btrim(b.partida)) = lower(btrim(a.partida)) AND (( SELECT count(*) AS count
                                   FROM partidas_obra x
                                  WHERE x.empresa = e.empresa AND x.obra_id = o.id AND NOT COALESCE(x.es_titulo, false) AND (COALESCE(x.unidad, ''::text) <> ALL (ARRAY['TITULO'::text, 'GRUPO'::text])) AND lower(btrim(x.partida)) = lower(btrim(a.partida)))) = 1)) p ON true
                ), partidas AS (
                 SELECT resueltos.partida_id,
                    resueltos.partida,
                    max(resueltos.presupuesto) AS presupuesto,
                    bool_or(resueltos.sin_cuadrilla) AS sin_cuadrilla
                   FROM resueltos
                  WHERE resueltos.partida_id IS NOT NULL
                  GROUP BY resueltos.partida_id, resueltos.partida
                ), pesos AS (
                 SELECT partidas.partida_id,
                    partidas.partida,
                    partidas.presupuesto,
                    partidas.sin_cuadrilla,
                    count(*) OVER () AS cantidad_partidas,
                        CASE
                            WHEN count(*) OVER () = 1 THEN 1::numeric
                            ELSE partidas.presupuesto / NULLIF(sum(partidas.presupuesto) OVER (), 0::numeric)
                        END AS factor,
                    bool_and(COALESCE(partidas.presupuesto > 0::numeric, false)) OVER () AS presupuestos_validos
                   FROM partidas
                ), acumulados AS (
                 SELECT pesos.partida_id,
                    pesos.partida,
                    pesos.presupuesto,
                    pesos.sin_cuadrilla,
                    pesos.cantidad_partidas,
                    pesos.factor,
                    pesos.presupuestos_validos,
                    sum(pesos.factor) OVER (ORDER BY pesos.partida_id) AS acumulado,
                    row_number() OVER (ORDER BY pesos.partida_id) AS orden
                   FROM pesos
                  WHERE (pesos.cantidad_partidas = 1 OR pesos.presupuestos_validos) AND NOT (EXISTS ( SELECT 1
                           FROM resueltos
                          WHERE resueltos.partida_id IS NULL))
                ), montos AS (
                 SELECT acumulados.partida_id,
                    acumulados.partida,
                    acumulados.presupuesto,
                    acumulados.sin_cuadrilla,
                    acumulados.cantidad_partidas,
                    acumulados.factor,
                    acumulados.presupuestos_validos,
                    acumulados.acumulado,
                    acumulados.orden,
                        CASE
                            WHEN acumulados.orden = acumulados.cantidad_partidas THEN e.monto_real
                            ELSE round(e.monto_real * acumulados.acumulado, 2)
                        END - COALESCE(lag(round(e.monto_real * acumulados.acumulado, 2)) OVER (ORDER BY acumulados.partida_id), 0::numeric) AS monto
                   FROM acumulados
                )
         SELECT jsonb_agg(jsonb_build_object('partida_id', montos.partida_id, 'partida', montos.partida, 'monto_imputado', montos.monto, 'factor', montos.factor, 'presupuesto_partida', montos.presupuesto, 'criterio',
                CASE
                    WHEN montos.sin_cuadrilla THEN 'Dotación de obra: reporte sin cuadrilla'::text
                    ELSE 'Integrante de cuadrilla reportada'::text
                END) ORDER BY montos.partida_id) AS detalle, CASE
 WHEN NOT EXISTS (SELECT 1 FROM reportes) THEN 'No incluido en la cuadrilla del reporte'
 WHEN EXISTS (SELECT 1 FROM resueltos WHERE partida_id IS NULL) THEN 'Partida del reporte sin vínculo único con las partidas de la obra'
 WHEN EXISTS (SELECT 1 FROM pesos WHERE cantidad_partidas>1 AND NOT presupuestos_validos) THEN 'Falta cantidad o precio positivo para distribuir entre partidas'
 ELSE NULL END AS motivo
           FROM montos) distribucion ON true;

