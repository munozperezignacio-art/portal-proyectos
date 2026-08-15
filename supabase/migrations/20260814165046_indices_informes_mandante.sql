create index if not exists mandante_informes_historial_config_idx on public.mandante_informes_historial(config_id) where config_id is not null;;
