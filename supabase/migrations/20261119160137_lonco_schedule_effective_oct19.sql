begin;
do $$
declare w public.obras%rowtype; v bigint; r record; a record; n integer:=0; old_hash text; protected_hash text; check_hash text;
begin
 select * into strict w from public.obras where empresa='EMINSG' and nombre='IP-EDIFICO L LONCO' for update;
 if exists(select 1 from public.obra_jornadas_historial where obra_id=w.id) then raise exception 'Lonco ya tiene versiones: revisar antes de aplicar'; end if;
 if w.jornada_semanal->'1'->>'end'<>'17:00' or w.jornada_semanal->'2'->>'end'<>'17:00' or w.jornada_semanal->'3'->>'end'<>'18:00' or w.jornada_semanal->'4'->>'end'<>'18:00' or w.jornada_semanal->'5'->>'end'<>'17:00' then raise exception 'La jornada de Lonco cambió'; end if;
 select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'')) into old_hash from public.asistencia_personal t where obra_id=w.id and empresa=w.empresa and fecha_marcacion<date '2026-10-19';
 select md5(coalesce(jsonb_agg(to_jsonb(t)-array['jornada_aplicada','jornada_ordinaria_horas','horas_ordinarias','horas_extras_auto','jornada_version_id','updated_at'] order by id)::text,'')) into protected_hash from public.asistencia_personal t where obra_id=w.id and empresa=w.empresa;
 insert into public.obra_jornadas_historial(obra_id,empresa,desde,jornada,motivo,autor)
 values(w.id,w.empresa,date '2026-10-19',w.jornada_semanal,'Vigencia del horario actual desde el 19/10/2026 solicitada por el administrador. Se conservan marcajes anteriores y extras manuales.','Solicitud del administrador · soporte Obraxis') returning id into v;
 for r in select id,jornada_aplicada,jornada_ordinaria_horas,horas_ordinarias,horas_extras_auto,jornada_version_id from public.asistencia_personal where obra_id=w.id and empresa=w.empresa and fecha_marcacion>=date '2026-10-19' order by id for update loop
  update public.asistencia_personal set jornada_aplicada=null where id=r.id returning jornada_aplicada,jornada_ordinaria_horas,horas_ordinarias,horas_extras_auto,jornada_version_id into a;
  insert into public.obra_jornada_recalculos values(v,r.id,to_jsonb(r)-'id',to_jsonb(a));n:=n+1;
 end loop;
 update public.obra_jornadas_historial set recalculados=n where id=v;
 update public.obras set jornadas_historial=private.jornada_historial_json(w.id) where id=w.id;
 select md5(coalesce(jsonb_agg(to_jsonb(t) order by id)::text,'')) into check_hash from public.asistencia_personal t where obra_id=w.id and empresa=w.empresa and fecha_marcacion<date '2026-10-19';
 if check_hash is distinct from old_hash then raise exception 'Se alteraron marcajes anteriores'; end if;
 select md5(coalesce(jsonb_agg(to_jsonb(t)-array['jornada_aplicada','jornada_ordinaria_horas','horas_ordinarias','horas_extras_auto','jornada_version_id','updated_at'] order by id)::text,'')) into check_hash from public.asistencia_personal t where obra_id=w.id and empresa=w.empresa;
 if check_hash is distinct from protected_hash then raise exception 'Se alteraron campos protegidos'; end if;
end $$;
commit;
