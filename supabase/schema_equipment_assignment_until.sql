-- Persist estimated assignment end; older UI silently discarded this field.
alter table public.inventario_maquinaria add column if not exists fecha_hasta_estimada date;
comment on column public.inventario_maquinaria.fecha_hasta_estimada is 'Término estimado de la asignación actual. No libera automáticamente el equipo.';
