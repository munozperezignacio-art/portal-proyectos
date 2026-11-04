-- Preserve the installed calculation, overtime rules and payroll reconciliation.
-- 'Aprobada' remains a compatibility state, not a human approval requirement.

do $migration$
declare source text;
begin
  source:=pg_get_functiondef('private.rrhh_sincronizar_cargo_dia(text,integer,date)'::regprocedure);
  if strpos(source,'marcas.total=1 and marcas.presentes=1 and marcas.manuales=1')=0
    or strpos(source,'and actor is not null and not conciliada')=0 then
    raise exception 'Unexpected attendance function; review before migrating';
  end if;
  source:=replace(source,'marcas.total=1 and marcas.presentes=1 and marcas.manuales=1','marcas.total=1 and marcas.presentes=1');
  source:=replace(source,'Cargo directo por asistencia manual','Cargo automático por asistencia registrada');
  execute source;
end;
$migration$;

-- No new public endpoint or grants: only the existing protected attendance trigger
-- and internal reconciliation can run this engine.
revoke all on function private.rrhh_sincronizar_cargo_dia(text,integer,date) from public,anon,authenticated;
notify pgrst,'reload schema';
