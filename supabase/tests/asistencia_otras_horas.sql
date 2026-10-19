begin;
do $$
declare row_id integer; work_id integer; bad boolean:=false;
begin
  insert into public.obras(empresa,nombre) values('__TEST_OTRAS_HORAS__','Prueba aislada otras horas') returning id into work_id;
  insert into public.asistencia_personal(empresa,obra_id,trabajador,fecha_marcacion,asistencia,ingreso,salida,colacion,otras_horas,verificado_qr)
    values('__TEST_OTRAS_HORAS__',work_id,'Prueba aislada','2026-10-01','PRESENTE','08:00','19:00','SI',2.5,false) returning id into row_id;
  if not exists(select 1 from public.asistencia_personal where id=row_id and otras_horas=2.5 and horas_extras_auto=1) then raise exception 'No conserva horas independientes'; end if;
  begin
    update public.asistencia_personal set otras_horas=-1 where id=row_id;
  exception when check_violation then bad:=true; end;
  if not bad then raise exception 'Aceptó otras horas negativas'; end if;
  bad:=false;
  begin
    update public.asistencia_personal set otras_horas='NaN'::numeric where id=row_id;
  exception when check_violation then bad:=true; end;
  if not bad then raise exception 'Aceptó NaN'; end if;
  update public.asistencia_personal set otras_horas=0 where id=row_id;
end; $$;
rollback;
select 'OK: otras horas independientes, no negativas; prueba revertida' as resultado;
