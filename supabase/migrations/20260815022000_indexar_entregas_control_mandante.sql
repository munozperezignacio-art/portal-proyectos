create index if not exists mandante_entregas_plantilla_idx
  on public.mandante_entregas(plantilla_id) where plantilla_id is not null;
create index if not exists mandante_entregas_partida_control_idx
  on public.mandante_entregas(partida_control_id) where partida_control_id is not null;
