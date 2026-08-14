create index if not exists mandante_contratos_proyecto_idx
  on public.mandante_contratos (proyecto_id);

create index if not exists mandante_contratos_obra_idx
  on public.mandante_contratos (obra_contratista_id)
  where obra_contratista_id is not null;

create index if not exists mandante_eventos_proyecto_idx
  on public.mandante_eventos (proyecto_id, created_at desc)
  where proyecto_id is not null;
