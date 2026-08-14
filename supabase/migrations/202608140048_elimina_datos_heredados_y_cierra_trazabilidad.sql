-- Elimina exclusivamente los registros legados sin empresa u obra que fueron
-- auditados el 14-08-2026. Las aserciones evitan ampliar accidentalmente el
-- alcance si los datos cambian antes de ejecutar esta migración.
set local lock_timeout = '5s';
set local statement_timeout = '30s';

do $$
declare
  v_partidas integer;
  v_avances integer;
  v_asistencias integer;
  v_asignaciones integer;
  v_registros integer;
  v_referencias integer;
begin
  select count(*) into v_partidas
  from public.partidas_obra
  where obra_id is null or empresa is null;

  select count(*) into v_avances
  from public.avances_produccion_partidas
  where obra_id is null or empresa is null;

  select count(*) into v_asistencias
  from public.asistencia_personal
  where obra_id is null;

  select count(*) into v_asignaciones
  from public.prevencion_cumplimiento_asignaciones
  where empresa is null and formulario_id is null and usuario_id is null;

  select count(*) into v_registros
  from public.prevencion_cumplimiento_registros r
  where r.empresa is null
    and exists (
      select 1
      from public.prevencion_cumplimiento_asignaciones a
      where a.id = r.asignacion_id
        and a.empresa is null
        and a.formulario_id is null
        and a.usuario_id is null
    );

  select count(*) into v_referencias
  from public.contratos_colaborativos_partidas c
  join public.partidas_obra p
    on p.id in (c.partida_contratista_id, c.partida_colaboradora_id)
  where p.obra_id is null or p.empresa is null;

  if (v_partidas, v_avances, v_asistencias, v_asignaciones, v_registros, v_referencias)
     is distinct from (4, 19, 10, 2, 2, 0) then
    raise exception
      'El conjunto legado cambió. Esperado 4/19/10/2/2/0; recibido %/%/%/%/%/%',
      v_partidas, v_avances, v_asistencias, v_asignaciones, v_registros, v_referencias;
  end if;

  delete from public.avances_produccion_partidas
  where obra_id is null or empresa is null;

  delete from public.partidas_obra
  where obra_id is null or empresa is null;

  delete from public.asistencia_personal
  where obra_id is null;

  -- Los dos registros dependientes se eliminan mediante ON DELETE CASCADE.
  delete from public.prevencion_cumplimiento_asignaciones
  where empresa is null and formulario_id is null and usuario_id is null;
end
$$;

-- Estas respuestas no son huérfanas: conservan un nombre de obra inequívoco.
update public.prevencion_respuestas r
   set obra_id = o.id,
       centro_gestion_id = coalesce(r.centro_gestion_id, o.centro_gestion_id)
  from public.obras o
 where r.obra_id is null
   and r.proyecto_nombre is not null
   and lower(btrim(r.proyecto_nombre)) = lower(btrim(o.nombre));

alter table public.partidas_obra
  alter column obra_id set not null,
  alter column empresa set not null;

alter table public.avances_produccion_partidas
  alter column obra_id set not null,
  alter column empresa set not null;

alter table public.asistencia_personal
  alter column obra_id set not null;

create index if not exists partidas_obra_empresa_obra_idx
  on public.partidas_obra (empresa, obra_id);

create index if not exists avances_produccion_empresa_obra_idx
  on public.avances_produccion_partidas (empresa, obra_id);

create index if not exists asistencia_personal_empresa_obra_fecha_idx
  on public.asistencia_personal (empresa, obra_id, fecha_marcacion);
