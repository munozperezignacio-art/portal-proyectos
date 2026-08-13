alter table if exists public.informes_programaciones
  add column if not exists usar_ia boolean not null default true;

alter table if exists public.informes_ejecuciones
  add column if not exists interpretacion_ia jsonb,
  add column if not exists ia_consumo_id uuid,
  add column if not exists aprobado_por text,
  add column if not exists aprobado_at timestamptz;
