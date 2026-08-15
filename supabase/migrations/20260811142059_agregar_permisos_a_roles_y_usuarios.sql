alter table public.roles add column if not exists permisos jsonb not null default '{}'::jsonb;
alter table public.usuarios add column if not exists permisos jsonb not null default '{}'::jsonb;
alter table public.roles add column if not exists permisos_actualizados_por text;
alter table public.roles add column if not exists permisos_actualizados_en timestamptz;
alter table public.usuarios add column if not exists permisos_actualizados_por text;
alter table public.usuarios add column if not exists permisos_actualizados_en timestamptz;;
