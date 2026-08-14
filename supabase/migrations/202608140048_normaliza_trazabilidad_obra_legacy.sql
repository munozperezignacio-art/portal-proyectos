-- Conserva registros históricos cuyo origen ya no puede reconstruirse sin
-- mezclarlos con una obra activa. Los datos inequívocos se vinculan por nombre.
do $$
declare
  v_obra_archivo_id integer;
begin
  insert into public.obras (nombre, tipo, empresa, estado)
  values ('Datos heredados sin obra', 'Archivo técnico', 'Obraxis', 'Archivada')
  on conflict (nombre) do update
    set empresa = coalesce(public.obras.empresa, excluded.empresa),
        estado = 'Archivada'
  returning id into v_obra_archivo_id;

  update public.partidas_obra p
     set obra_id = o.id,
         obra_nombre = o.nombre,
         empresa = o.empresa
    from public.obras o
   where p.obra_id is null
     and p.obra_nombre is not null
     and lower(btrim(p.obra_nombre)) = lower(btrim(o.nombre));

  update public.partidas_obra
     set obra_id = v_obra_archivo_id,
         obra_nombre = 'Datos heredados sin obra',
         empresa = 'Obraxis'
   where obra_id is null;

  update public.avances_produccion_partidas a
     set obra_id = p.obra_id,
         obra_nombre = p.obra_nombre,
         empresa = p.empresa
    from public.partidas_obra p
   where a.obra_id is null
     and lower(btrim(a.partida)) = lower(btrim(p.partida))
     and p.obra_id is not null;

  update public.avances_produccion_partidas
     set obra_id = v_obra_archivo_id,
         obra_nombre = 'Datos heredados sin obra',
         empresa = 'Obraxis'
   where obra_id is null;

  update public.asistencia_personal a
     set obra_id = o.id,
         obra_nombre = o.nombre,
         empresa = o.empresa
    from public.obras o
   where a.obra_id is null
     and a.obra_nombre is not null
     and lower(btrim(a.obra_nombre)) = lower(btrim(o.nombre));

  update public.asistencia_personal
     set obra_id = v_obra_archivo_id,
         obra_nombre = 'Datos heredados sin obra',
         empresa = 'Obraxis'
   where obra_id is null;
end
$$;

-- Las respuestas preventivas históricas sí conservan el nombre de la obra.
update public.prevencion_respuestas r
   set obra_id = o.id,
       centro_gestion_id = coalesce(r.centro_gestion_id, o.centro_gestion_id)
  from public.obras o
 where r.obra_id is null
   and r.proyecto_nombre is not null
   and lower(btrim(r.proyecto_nombre)) = lower(btrim(o.nombre));

-- Dos asignaciones de demostración antiguas carecen de relaciones suficientes;
-- se preservan dentro de la empresa propietaria del entorno de prueba.
update public.prevencion_cumplimiento_asignaciones a
   set empresa = coalesce(
     (select f.empresa from public.prevencion_formularios f where f.id = a.formulario_id),
     (select u.empresa from public.usuarios u where u.id = a.usuario_id),
     'Obraxis'
   )
 where a.empresa is null;

update public.prevencion_cumplimiento_asignaciones
   set empresa = 'Obraxis'
 where empresa is null;

update public.prevencion_cumplimiento_registros r
   set empresa = a.empresa
  from public.prevencion_cumplimiento_asignaciones a
 where r.empresa is null
   and r.asignacion_id = a.id;

update public.prevencion_cumplimiento_registros
   set empresa = 'Obraxis'
 where empresa is null;

alter table public.partidas_obra
  alter column obra_id set not null,
  alter column empresa set not null;

alter table public.avances_produccion_partidas
  alter column obra_id set not null,
  alter column empresa set not null;

alter table public.asistencia_personal
  alter column obra_id set not null;

alter table public.prevencion_cumplimiento_asignaciones
  alter column empresa set not null;

alter table public.prevencion_cumplimiento_registros
  alter column empresa set not null;

create index if not exists partidas_obra_empresa_obra_idx
  on public.partidas_obra (empresa, obra_id);

create index if not exists avances_produccion_empresa_obra_idx
  on public.avances_produccion_partidas (empresa, obra_id);

create index if not exists asistencia_personal_empresa_obra_fecha_idx
  on public.asistencia_personal (empresa, obra_id, fecha);

comment on table public.obras is
  'Obras operativas. La obra archivada Datos heredados sin obra actúa como cuarentena trazable para registros legados sin origen reconstruible.';
