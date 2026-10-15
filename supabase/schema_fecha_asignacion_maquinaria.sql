-- Aplicado como fecha_asignacion_inventario_maquinaria.
alter table public.inventario_maquinaria add column if not exists fecha_asig date;
comment on column public.inventario_maquinaria.fecha_asig is 'Inicio de la asignación vigente del equipo a su obra.';
