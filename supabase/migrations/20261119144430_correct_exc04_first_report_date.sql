begin;
-- User-authorized correction of the first EXC-04 report. Exclusive lock prevents
-- any concurrent write while the date-immutability trigger is temporarily paused.
lock table public.maquinaria_uso_diario in access exclusive mode;
do $$
declare original public.maquinaria_uso_diario%rowtype; corrected public.maquinaria_uso_diario%rowtype; n integer;
begin
 select count(*) into n from public.maquinaria_uso_diario where empresa='EMINSG' and equipo_patente='EXC-04';
 if n<>1 then raise exception 'Expected exactly one EXC-04 report; manual review required'; end if;
 select * into original from public.maquinaria_uso_diario where empresa='EMINSG' and equipo_patente='EXC-04';
 if original.fecha<>date '2026-11-19' or original.horometro_inicial<>12109 or original.horometro_final<>12111
 or original.horas_trabajadas<>2 or original.combustible_cargado<>266 or original.obra_nombre<>'IP- ASTURIAS III'
 or original.tarifa_uf is not null then raise exception 'Report differs from reviewed data'; end if;
 if not exists(select 1 from jsonb_array_elements(public.equipo_obras_fecha(original.equipo_id::integer,'2026-11-18')) w where w->>'nombre'=original.obra_nombre)
 then raise exception 'Assignment does not match corrected date'; end if;
 if exists(select 1 from public.maquinaria_fallas where uso_diario_id=original.id) then raise exception 'Linked incidents require review'; end if;
 alter table public.maquinaria_uso_diario disable trigger maquinaria_validar_cargo_diario;
 update public.maquinaria_uso_diario set fecha='2026-11-18',
 reporte_datos=coalesce(reporte_datos,'{}'::jsonb)||jsonb_build_object('correccion_fecha',jsonb_build_object('anterior',original.fecha,'corregida','2026-11-18','motivo','Fecha corregida por solicitud del administrador: primer reporte realizado el 18/11/2026','registrada_at',clock_timestamp()))
 where id=original.id returning * into corrected;
 alter table public.maquinaria_uso_diario enable trigger maquinaria_validar_cargo_diario;
 if (to_jsonb(original)-'fecha'-'reporte_datos') is distinct from (to_jsonb(corrected)-'fecha'-'reporte_datos')
 then raise exception 'Unexpected change beyond report date'; end if;
end $$;
commit;
