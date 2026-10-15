begin;
create temporary table test_weekday (empresa text,obra_id integer,asistencia text,ingreso text,salida text,colacion text,jornada_ordinaria_horas numeric,horas_ordinarias numeric,horas_extras_auto numeric,fecha_marcacion date,jornada_aplicada jsonb);
create trigger test_weekday before insert or update on test_weekday for each row execute function private.calcular_horas_marcaje();
insert into test_weekday values('TEST_ONLY',null,'PRESENTE','07:00','16:00','SI',null,0,0,'2026-10-16','{"active":true,"start":"08:00","end":"18:00","breakStart":"13:00","breakEnd":"14:00"}');
do $$begin if not exists(select 1 from test_weekday where horas_ordinarias=7 and horas_extras_auto=1 and jornada_ordinaria_horas=9) then raise exception 'Outside shift should be extra even before daily threshold'; end if;end$$;
update test_weekday set jornada_aplicada='{"active":false}',ingreso='08:00',salida='14:00',colacion='NO';
do $$begin if not exists(select 1 from test_weekday where horas_ordinarias=0 and horas_extras_auto=6) then raise exception 'Off-day work must be extra';end if;end$$;
rollback;
