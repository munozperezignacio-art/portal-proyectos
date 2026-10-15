alter table public.obras add column if not exists jornada_ordinaria_horas numeric(5,2) not null default 9 check (jornada_ordinaria_horas between 0 and 24);
alter table public.asistencia_personal add column if not exists jornada_ordinaria_horas numeric(5,2) check (jornada_ordinaria_horas between 0 and 24);
comment on column public.obras.jornada_ordinaria_horas is 'Base técnica de horas ordinarias diarias para nuevos marcajes. Confirmar jornada contractual; 9 mantiene compatibilidad previa.';
comment on column public.asistencia_personal.jornada_ordinaria_horas is 'Umbral ordinario del día congelado al registrar. Las extras calculadas siguen sujetas a aprobación.';
create or replace function private.calcular_horas_marcaje() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare limite numeric; trabajadas numeric; entrada time; salida time;
begin
  limite:=new.jornada_ordinaria_horas;
  if limite is null then
    select o.jornada_ordinaria_horas into limite from public.obras o where o.id=new.obra_id and o.empresa=new.empresa;
  end if;
  limite:=coalesce(limite,9);
  if limite<0 or limite>24 then raise exception 'Jornada ordinaria inválida'; end if;
  new.jornada_ordinaria_horas:=limite;
  new.horas_ordinarias:=0; new.horas_extras_auto:=0;
  if new.asistencia='PRESENTE' and nullif(new.ingreso,'') is not null and nullif(new.salida,'') is not null then
    entrada:=new.ingreso::time; salida:=new.salida::time;
    trabajadas:=extract(epoch from (salida-entrada))/3600;
    if salida<entrada then trabajadas:=trabajadas+24; end if;
    trabajadas:=greatest(0,trabajadas-case when new.colacion='SI' then 1 else 0 end);
    new.horas_ordinarias:=round(least(trabajadas,limite),2);
    new.horas_extras_auto:=round(greatest(0,trabajadas-limite),2);
  end if;
  return new;
end $$;
revoke all on function private.calcular_horas_marcaje() from public, anon, authenticated;
drop trigger if exists calcular_horas_marcaje on public.asistencia_personal;
create trigger calcular_horas_marcaje before insert or update of ingreso,salida,colacion,asistencia,jornada_ordinaria_horas on public.asistencia_personal for each row execute function private.calcular_horas_marcaje();
