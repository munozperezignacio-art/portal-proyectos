create index if not exists contratos_colaborativos_obra_contratista_fk_idx on public.contratos_colaborativos (obra_contratista_id);
create index if not exists contratos_colaborativos_obra_colaboradora_fk_idx on public.contratos_colaborativos (obra_colaboradora_id);
create index if not exists contratos_colaborativos_eventos_contrato_fk_idx on public.contratos_colaborativos_eventos (contrato_id);
create index if not exists contratos_colaborativos_partidas_principal_fk_idx on public.contratos_colaborativos_partidas (partida_contratista_id);
create index if not exists contratos_colaborativos_partidas_colaboradora_fk_idx on public.contratos_colaborativos_partidas (partida_colaboradora_id);
create index if not exists subcontrato_avances_contrato_idx on public.subcontrato_avances (contrato_colaborativo_id, enlace_partida_id, fecha);
create index if not exists subcontrato_asistencia_contrato_idx on public.subcontrato_asistencia (contrato_colaborativo_id, fecha);
create index if not exists subcontrato_estados_pago_contrato_idx on public.subcontrato_estados_pago (contrato_colaborativo_id, created_at);;
