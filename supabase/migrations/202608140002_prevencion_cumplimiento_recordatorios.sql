-- Programación de recordatorios por asignación de Cumplimiento Preventivo.

alter table public.prevencion_cumplimiento_asignaciones
  add column if not exists hora_limite time without time zone not null default '17:00',
  add column if not exists dia_semana smallint,
  add column if not exists dia_mes smallint,
  add column if not exists notificar_pendiente boolean not null default true;

alter table public.prevencion_cumplimiento_asignaciones
  drop constraint if exists prevencion_cumplimiento_dia_semana_check,
  add constraint prevencion_cumplimiento_dia_semana_check
    check (dia_semana is null or dia_semana between 1 and 5),
  drop constraint if exists prevencion_cumplimiento_dia_mes_check,
  add constraint prevencion_cumplimiento_dia_mes_check
    check (dia_mes is null or dia_mes between 1 and 28);

update public.prevencion_cumplimiento_asignaciones
set dia_semana = case when frecuencia = 'Semanal' then coalesce(dia_semana, 4) else null end,
    dia_mes = case when frecuencia = 'Mensual' then coalesce(dia_mes, 20) else null end
where empresa is not null;

comment on column public.prevencion_cumplimiento_asignaciones.hora_limite is
  'Hora local de Chile desde la cual se notifica si el formulario sigue pendiente.';
comment on column public.prevencion_cumplimiento_asignaciones.dia_semana is
  'Día ISO de aviso semanal: lunes=1 a viernes=5.';
comment on column public.prevencion_cumplimiento_asignaciones.dia_mes is
  'Día de aviso mensual, limitado a 1..28 para existir en todos los meses.';

-- Cada empresa necesita una única regla maestra para despachar estos avisos.
create unique index if not exists notificaciones_reglas_cumplimiento_empresa_uidx
  on public.notificaciones_reglas (empresa, evento_codigo)
  where evento_codigo = 'prevencion_cumplimiento_pendiente';

create or replace function public.asegurar_regla_cumplimiento_preventivo()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.notificar_pendiente and new.empresa is not null then
    insert into public.notificaciones_reglas (
      empresa, nombre, evento_codigo, modulo, descripcion,
      destinatarios_roles, destinatarios_usuarios, correos_adicionales,
      canal_email, canal_plataforma, frecuencia, condiciones, activa, creado_por
    ) values (
      new.empresa,
      'Cumplimiento preventivo pendiente',
      'prevencion_cumplimiento_pendiente',
      'Prevención',
      'Avisa al responsable cuando el formulario asignado no fue completado al vencimiento configurado.',
      '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
      false, true, 'Diaria',
      jsonb_build_object('alcance_tipo', 'todas', 'origen', 'cumplimiento_preventivo'),
      true, 'Sistema Obraxis'
    )
    on conflict (empresa, evento_codigo)
      where evento_codigo = 'prevencion_cumplimiento_pendiente'
    do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_asegurar_regla_cumplimiento_preventivo
  on public.prevencion_cumplimiento_asignaciones;
create trigger trg_asegurar_regla_cumplimiento_preventivo
after insert or update of notificar_pendiente, empresa
on public.prevencion_cumplimiento_asignaciones
for each row execute function public.asegurar_regla_cumplimiento_preventivo();

-- Habilita también las asignaciones vigentes creadas antes de esta migración.
insert into public.notificaciones_reglas (
  empresa, nombre, evento_codigo, modulo, descripcion,
  destinatarios_roles, destinatarios_usuarios, correos_adicionales,
  canal_email, canal_plataforma, frecuencia, condiciones, activa, creado_por
)
select distinct
  a.empresa,
  'Cumplimiento preventivo pendiente',
  'prevencion_cumplimiento_pendiente',
  'Prevención',
  'Avisa al responsable cuando el formulario asignado no fue completado al vencimiento configurado.',
  '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
  false, true, 'Diaria',
  jsonb_build_object('alcance_tipo', 'todas', 'origen', 'cumplimiento_preventivo'),
  true, 'Sistema Obraxis'
from public.prevencion_cumplimiento_asignaciones a
where a.empresa is not null and a.activo and a.notificar_pendiente
on conflict (empresa, evento_codigo)
  where evento_codigo = 'prevencion_cumplimiento_pendiente'
do nothing;
