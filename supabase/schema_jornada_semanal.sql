alter table public.obras add column if not exists jornada_semanal jsonb;
alter table public.asistencia_personal add column if not exists jornada_aplicada jsonb;
comment on column public.obras.jornada_semanal is 'Horario ordinario por día: claves 0 domingo a 6 sábado; active,start,end,breakStart,breakEnd. Null conserva base diaria anterior.';
comment on column public.asistencia_personal.jornada_aplicada is 'Horario del día congelado al registrar. Cambiar la configuración de obra no recalcula históricos.';
create or replace function private.calcular_horas_marcaje() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare cfg jsonb; limite numeric; base_obra numeric; inicio numeric; fin numeric; pausa_inicio numeric; pausa_fin numeric; entrada numeric; salida numeric; trabajadas numeric; ordinarias numeric; pausa numeric;
begin
  cfg:=new.jornada_aplicada;
  limite:=new.jornada_ordinaria_horas;
  if cfg is null then
    select o.jornada_semanal -> (extract(dow from new.fecha_marcacion)::int)::text,o.jornada_ordinaria_horas into cfg,base_obra
    from public.obras o where o.id=new.obra_id and o.empresa=new.empresa;
  end if;
  limite:=coalesce(limite,base_obra,9);
  if cfg is not null then
    if (cfg->>'active')::boolean then
      inicio:=extract(epoch from (cfg->>'start')::time)/60;
      fin:=extract(epoch from (cfg->>'end')::time)/60;
      if inicio is null or fin is null or fin<=inicio then raise exception 'Horario semanal inválido'; end if;
      if nullif(cfg->>'breakStart','') is not null or nullif(cfg->>'breakEnd','') is not null then
        pausa_inicio:=extract(epoch from (cfg->>'breakStart')::time)/60;
        pausa_fin:=extract(epoch from (cfg->>'breakEnd')::time)/60;
        if pausa_inicio is null or pausa_fin is null or pausa_inicio<inicio or pausa_fin>fin or pausa_fin<=pausa_inicio then raise exception 'Colación semanal inválida'; end if;
      end if;
      limite:=(fin-inicio-coalesce(pausa_fin-pausa_inicio,0))/60;
    elsif cfg->>'active'='false' then limite:=0;
    else raise exception 'Día de jornada semanal inválido'; end if;
  end if;
  if limite<0 or limite>24 then raise exception 'Jornada ordinaria inválida'; end if;
  new.jornada_aplicada:=cfg;new.jornada_ordinaria_horas:=limite;
  new.horas_ordinarias:=0;new.horas_extras_auto:=0;
  if new.asistencia='PRESENTE' and nullif(new.ingreso,'') is not null and nullif(new.salida,'') is not null then
    entrada:=extract(epoch from new.ingreso::time)/60;salida:=extract(epoch from new.salida::time)/60;
    if salida<entrada then salida:=salida+1440;end if;
    trabajadas:=salida-entrada;
    if cfg is null then
      trabajadas:=greatest(0,trabajadas-case when new.colacion='SI' then 60 else 0 end);
      ordinarias:=least(trabajadas,limite*60);
    elsif (cfg->>'active')::boolean then
      ordinarias:=greatest(0,least(salida,fin)-greatest(entrada,inicio));
      if pausa_inicio is not null then
        pausa:=greatest(0,least(salida,pausa_fin)-greatest(entrada,pausa_inicio));
        ordinarias:=ordinarias-pausa;
        if new.colacion='SI' then trabajadas:=trabajadas-pausa;end if;
      elsif new.colacion='SI' then trabajadas:=trabajadas-60;ordinarias:=ordinarias-60;end if;
    else
      ordinarias:=0;if new.colacion='SI' then trabajadas:=trabajadas-60;end if;
    end if;
    trabajadas:=greatest(0,trabajadas);ordinarias:=greatest(0,least(trabajadas,ordinarias));
    new.horas_ordinarias:=round(ordinarias/60,2);new.horas_extras_auto:=round((trabajadas-ordinarias)/60,2);
  end if;
  return new;
end $$;
revoke all on function private.calcular_horas_marcaje() from public,anon,authenticated;
drop trigger if exists calcular_horas_marcaje on public.asistencia_personal;
create trigger calcular_horas_marcaje before insert or update of ingreso,salida,colacion,asistencia,jornada_ordinaria_horas,jornada_aplicada,fecha_marcacion on public.asistencia_personal for each row execute function private.calcular_horas_marcaje();
