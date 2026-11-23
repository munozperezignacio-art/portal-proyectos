create view public.rrhh_costos_personal_vigentes as
 SELECT b.id,
    b.empresa,
    b.trabajador_id,
    b.trabajador,
    b.fecha,
    b.centro_gestion_id,
    b.monto_real,
    b.nomina_id,
    b.nomina_item_id,
    b.fuente,
    b.desglose,
    b.obra_id,
    b.obra_nombre,
    b.periodo,
    COALESCE(m.detalle, b.obra_liquidaciones_partidas) AS obra_liquidaciones_partidas,
        CASE
            WHEN d.version IS NOT NULL THEN 'Aprobada manualmente'::text
            ELSE b.estado_imputacion_partidas
        END AS estado_imputacion_partidas,
    COALESCE(d.version, 0) AS version_imputacion,
    COALESCE(d.historial, '[]'::jsonb) AS historial_imputacion
   FROM rrhh_costos_personal_automaticos b
     LEFT JOIN rrhh_partidas_decisiones d ON d.empresa = b.empresa AND d.obra_id = b.obra_id AND d.trabajador_id = b.trabajador_id AND d.fecha = b.fecha
     LEFT JOIN LATERAL ( WITH factores AS (
                 SELECT (x.value ->> 'partida_id'::text)::integer AS partida_id,
                    x.value ->> 'partida'::text AS partida,
                    ((x.value ->> 'porcentaje'::text)::numeric) / 100::numeric AS factor,
                    row_number() OVER (ORDER BY ((x.value ->> 'partida_id'::text)::integer)) AS orden,
                    count(*) OVER () AS cantidad,
                    sum(((x.value ->> 'porcentaje'::text)::numeric) / 100::numeric) OVER (ORDER BY ((x.value ->> 'partida_id'::text)::integer)) AS acumulado
                   FROM jsonb_array_elements(d.distribucion) x(value)
                ), montos AS (
                 SELECT factores.partida_id,
                    factores.partida,
                    factores.factor,
                    factores.orden,
                    factores.cantidad,
                    factores.acumulado,
                        CASE
                            WHEN factores.orden = factores.cantidad THEN b.monto_real
                            ELSE round(b.monto_real * factores.acumulado, 2)
                        END - COALESCE(lag(round(b.monto_real * factores.acumulado, 2)) OVER (ORDER BY factores.partida_id), 0::numeric) AS monto
                   FROM factores
                )
         SELECT jsonb_agg(jsonb_build_object('partida_id', montos.partida_id, 'partida', montos.partida, 'factor', montos.factor, 'monto_imputado', montos.monto, 'criterio', 'Distribución aprobada manualmente') ORDER BY montos.partida_id) AS detalle
           FROM montos) m ON true;
