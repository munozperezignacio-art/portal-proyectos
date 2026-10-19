begin;
do $$
begin
  if not (select relrowsecurity from pg_class where oid='public.indicadores_economicos_cache'::regclass) then raise exception 'Falta RLS';end if;
  if has_table_privilege('anon','public.indicadores_economicos_cache','SELECT') then raise exception 'Lectura anónima no prevista';end if;
  if not has_table_privilege('authenticated','public.indicadores_economicos_cache','SELECT') then raise exception 'Usuarios sin acceso a indicadores';end if;
  if has_table_privilege('authenticated','public.indicadores_economicos_cache','INSERT,UPDATE,DELETE') then raise exception 'Usuarios pueden manipular indicador compartido';end if;
  if has_function_privilege('authenticated','private.actualizar_indicadores_economicos_cron()','EXECUTE') then raise exception 'Cron invocable por usuario';end if;
  if (select count(*) from cron.job where jobname='obraxis-indicadores-economicos' and active)<>1 then raise exception 'Actualización automática ausente o duplicada';end if;
end; $$;
rollback;
select 'Indicadores compartidos: RLS, lectura, escritura restringida y cron verificados' as verificacion;
