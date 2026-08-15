create index if not exists prevencion_matrices_riesgo_obra_id_idx on public.prevencion_matrices_riesgo (obra_id) where obra_id is not null;;
