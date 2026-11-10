create function public.estadisticas_jornadas_flota(p_obra int,p_corte date,p_feriados date[] default '{}') returns jsonb
language sql stable security invoker set search_path='' as $$
with o as(select * from public.obras where id=p_obra), lim as (
 select o.*,least(p_corte,(now() at time zone 'America/Santiago')::date) corte,
 least(p_corte,(now() at time zone 'America/Santiago')::date,coalesce(t.fecha_termino,o.fecha_termino_real)) fin
 from o left join public.obra_termino_trabajos t on t.obra_id=o.id and t.empresa=o.empresa and t.estado='completada'
), assignments as (
 select h.trabajador_id id,h.fecha_inicio ini,h.fecha_termino fin from public.rrhh_asignaciones_personal h join o on h.empresa=o.empresa and (h.obra_nombre=o.nombre or h.centro_gestion_id=o.centro_gestion_id)
 union all select a.trabajador_id,a.fecha_inicio,a.fecha_termino from public.rrhh_personal_centros_detalle a join o on a.empresa=o.empresa and a.centro_gestion_id=o.centro_gestion_id
 union all select m.id,coalesce(m.fecha_asig,m.fecha_inicio_contrato,o.fecha_inicio_real),null::date from public.maestro_personal m join o on m.empresa=o.empresa and (m.obra_nombre=o.nombre or m.centro_gestion_id=o.centro_gestion_id)
 where not exists(select 1 from public.rrhh_asignaciones_personal h where h.empresa=o.empresa and h.trabajador_id=m.id)
), expected as (
 select distinct m.id,regexp_replace(upper(m.rut),'[^0-9K]','','g') rut,upper(trim(m.nombre)) nombre,d::date dia
 from assignments a join public.maestro_personal m on m.id=a.id join lim l on l.empresa=m.empresa
 cross join lateral generate_series(greatest(a.ini,m.fecha_inicio_contrato,l.fecha_inicio_real)::timestamp,least(a.fin,m.fecha_vencimiento_contrato,l.fin)::timestamp,interval '1 day') d
 where not(d::date=any(p_feriados)) and coalesce((l.jornada_semanal->(extract(dow from d)::int::text)->>'active')::boolean,extract(isodow from d)<=5)
), marks as (
 select coalesce(a.fecha_marcacion,(a.created_at at time zone 'America/Santiago')::date) dia,regexp_replace(upper(coalesce(nullif(a.rut_normalizado,''),a.rut)),'[^0-9K]','','g') rut,upper(trim(a.trabajador)) nombre,upper(trim(a.asistencia)) st
 from public.asistencia_personal a join o on o.empresa=a.empresa and (a.obra_id=o.id or (a.obra_id is null and a.obra_nombre=o.nombre))
), matched as (
 select e.id,e.dia,bool_or(m.st in ('PRESENTE','ASISTE','P')) presente,bool_or(m.st in ('AUSENTE','FALTA','A')) ausente from expected e left join marks m on m.dia=e.dia and
 (m.rut=e.rut and e.rut<>'' or coalesce(m.rut,'')='' and m.nombre=e.nombre and not exists(select 1 from expected x where x.dia=e.dia and x.nombre=e.nombre and x.id<>e.id))
 group by e.id,e.dia
), fleet as (
 select 'p:'||p.equipo_id k,p.hasta is null or p.hasta>l.corte active from public.maquinaria_periodos_costo p join lim l on l.id=p.obra_id and l.empresa=p.empresa where p.desde<=l.corte
 union all select 'p:'||m.id,true from public.inventario_maquinaria m join lim l on l.empresa=m.empresa and l.nombre=m.obra_nombre where coalesce(m.fecha_asig,m.created_at::date)<=l.corte and not exists(select 1 from public.maquinaria_periodos_costo p where p.equipo_id=m.id and p.empresa=l.empresa and p.obra_id=l.id)
 union all select 'p:'||u.equipo_id,false from public.maquinaria_uso_diario u join lim l on l.empresa=u.empresa and (u.cargo_obra_id=l.id or (u.cargo_obra_id is null and coalesce(u.obra_cargo_diario,u.obra_nombre)=l.nombre)) where u.fecha<=l.corte and nullif(trim(u.equipo_id),'') is not null
 union all select 'a:'||coalesce(nullif(upper(trim(a.patente)),''),'contrato:'||a.id),a.fecha_termino is null or a.fecha_termino>=l.corte from public.arriendos_maquinaria a join lim l on a.empresa=l.empresa and (a.obra_id=l.id or (a.obra_id is null and a.obra_nombre=l.nombre)) where coalesce(a.fecha_inicio,a.created_at::date)<=l.corte
)
select jsonb_build_object('presentes',(select count(*) from matched where presente),'esperadas',(select count(*) from matched),'ausentes',(select count(*) from matched where ausente and not coalesce(presente,false)),'dias',(select count(distinct dia) from matched),'desde',coalesce(l.fecha_inicio_real,(select min(ini) from assignments)),'hasta',l.fin,'activos',(select count(distinct k) from fleet where active),'historicos',(select count(distinct k) from fleet)) from lim l
$$;
revoke all on function public.estadisticas_jornadas_flota(int,date,date[]) from public,anon;
grant execute on function public.estadisticas_jornadas_flota(int,date,date[]) to authenticated;
