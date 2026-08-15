alter table public.obras
  add column if not exists fecha_inicio_real date,
  add column if not exists fecha_termino_estimada date;
