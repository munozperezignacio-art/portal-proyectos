-- Compatibilidad del circuito de destinos tras incorporar aprobación del costo.
-- La cobertura funcional completa está en costos_asistencia_devengados.sql.
begin;
do $$
begin
  if to_regprocedure('public.preparar_imputaciones_personal(text,text)') is null
    or to_regprocedure('public.aprobar_imputaciones_personal(text,jsonb)') is null
    or to_regprocedure('public.distribuir_nomina_a_obras(bigint)') is null then
    raise exception 'Falta un punto de entrada del circuito de imputaciones';
  end if;
  if has_table_privilege('anon','public.rrhh_imputaciones_diarias','SELECT')
    or has_table_privilege('authenticated','public.rrhh_imputaciones_diarias','UPDATE') then
    raise exception 'Las aprobaciones admiten acceso directo indebido';
  end if;
end; $$;
rollback;
