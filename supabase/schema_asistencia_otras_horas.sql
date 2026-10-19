-- Dato informativo independiente de jornada, HE y cálculo de remuneraciones.
alter table public.asistencia_personal
  add column otras_horas numeric(10,2) not null default 0
  constraint asistencia_otras_horas_no_negativas check (otras_horas >= 0 and otras_horas <> 'NaN'::numeric);
comment on column public.asistencia_personal.otras_horas is
  'Horas informativas registradas manualmente. No se suman a HE, jornada ni remuneraciones.';
