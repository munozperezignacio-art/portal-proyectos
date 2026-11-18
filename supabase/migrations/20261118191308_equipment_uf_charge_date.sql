-- Append-only published UF quotes. Existing CLP charges and periods are untouched.
create table public.maquinaria_uf_valores (
 fecha date primary key, valor numeric not null check(valor>0 and valor<10000000),
 fuente text not null, registrado_at timestamptz not null default now()
);
alter table public.maquinaria_uf_valores enable row level security;
revoke all on public.maquinaria_uf_valores from public,anon,authenticated;
grant select on public.maquinaria_uf_valores to authenticated;
grant select,insert on public.maquinaria_uf_valores to service_role;
create policy maquinaria_uf_lectura on public.maquinaria_uf_valores for select to authenticated using(true);
insert into public.maquinaria_uf_valores(fecha,valor,fuente)
select fecha,valor,fuente from public.indicadores_economicos_cache where moneda='UF' and valor>0 and valor<10000000;
create function private.maquinaria_conservar_uf() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.moneda='UF' and new.valor>0 and new.valor<10000000 then
  insert into public.maquinaria_uf_valores(fecha,valor,fuente) values(new.fecha,new.valor,new.fuente) on conflict(fecha) do nothing;
 end if;
 return new;
end $$;
revoke all on function private.maquinaria_conservar_uf() from public,anon,authenticated;
create trigger maquinaria_conservar_uf after insert or update on public.indicadores_economicos_cache for each row execute function private.maquinaria_conservar_uf();

alter table public.maquinaria_periodos_costo add column tarifa_uf jsonb;
alter table public.maquinaria_uso_diario add column tarifa_uf jsonb;
alter table public.maquinaria_decisiones_costo add column tarifa_uf jsonb;

create function private.maquinaria_validar_tarifa_uf() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.unidad_costo_interno like 'UF/%' and (new.unidad_costo_interno not in ('UF/día','UF/hr','UF/mes') or new.costo_interno is null or new.costo_interno<0 or new.costo_interno::text in ('NaN','Infinity','-Infinity')) then raise exception 'Tarifa UF inválida'; end if;
 return new;
end $$;
revoke all on function private.maquinaria_validar_tarifa_uf() from public,anon,authenticated;
create trigger maquinaria_validar_tarifa_uf before insert or update on public.inventario_maquinaria for each row execute function private.maquinaria_validar_tarifa_uf();

create function private.maquinaria_config_uf(e public.inventario_maquinaria) returns jsonb language sql immutable security invoker set search_path='' as $$
 select case when e.unidad_costo_interno like 'UF/%' then jsonb_build_object('valor',e.costo_interno,'unidad',e.unidad_costo_interno,'minimo',coalesce(e.cantidad_minima,0),'tipo_minimo',coalesce(e.tipo_condicion_minima,'sin_minimo'),'modalidad',coalesce(e.modalidad_dias,'laborales')) end;
$$;
create function private.maquinaria_monto_uf(config jsonb, fecha date, horas numeric default null) returns numeric language plpgsql stable security invoker set search_path='' as $$
declare uf numeric; cantidad numeric:=1; tarifa numeric;
begin
 if config is null then return null; end if;
 select v.valor into uf from public.maquinaria_uf_valores v where v.fecha=maquinaria_monto_uf.fecha;
 if uf is null then return null; end if;
 tarifa:=(config->>'valor')::numeric;
 if config->>'unidad'='UF/mes' then cantidad:=1::numeric/(case when config->>'tipo_minimo'='dias_mes' and (config->>'minimo')::numeric>0 then least(30,(config->>'minimo')::numeric) else 30 end);
 elsif config->>'unidad'='UF/hr' then
  if horas is null and config->>'tipo_minimo' not in ('horas_dia','horas_mes') then return null; end if;
  cantidad:=greatest(coalesce(horas,0),case when config->>'tipo_minimo'='horas_dia' then coalesce((config->>'minimo')::numeric,0) when config->>'tipo_minimo'='horas_mes' then coalesce((config->>'minimo')::numeric,0)/30 else 0 end);
 end if;
 return round(tarifa*cantidad*uf);
end $$;
revoke all on function private.maquinaria_config_uf(public.inventario_maquinaria),private.maquinaria_monto_uf(jsonb,date,numeric) from public,anon;
grant execute on function private.maquinaria_config_uf(public.inventario_maquinaria),private.maquinaria_monto_uf(jsonb,date,numeric) to authenticated,service_role;

create function private.maquinaria_periodo_uf() returns trigger language plpgsql security invoker set search_path='' as $$
declare equipo public.inventario_maquinaria;
begin
 select * into equipo from public.inventario_maquinaria where empresa=new.empresa and id=new.equipo_id;
 new.tarifa_uf:=private.maquinaria_config_uf(equipo);
 if new.tarifa_uf is not null then new.tarifa:=null; end if;
 return new;
end $$;
revoke all on function private.maquinaria_periodo_uf() from public,anon,authenticated;
create trigger maquinaria_periodo_uf before insert on public.maquinaria_periodos_costo for each row execute function private.maquinaria_periodo_uf();

-- Extend the existing validator in place; preserve its row lock, destinations and CLP behavior.
do $migration$
declare definition text;
begin
 select pg_get_functiondef('private.maquinaria_validar_cargo_diario()'::regprocedure) into definition;
 if position('new.cargo_decidido_at:=clock_timestamp();' in definition)=0 then raise exception 'Unexpected machinery charge validator'; end if;
 definition:=replace(definition,'  destinos text[];', '  destinos text[]; config jsonb; periodo public.maquinaria_periodos_costo; horas numeric;');
 definition:=replace(definition,'new.tarifa_diaria_aplicada,new.cargo_decidido_at)', 'new.tarifa_diaria_aplicada,new.cargo_decidido_at,new.tarifa_uf)');
 definition:=replace(definition,'old.tarifa_diaria_aplicada,old.cargo_decidido_at)', 'old.tarifa_diaria_aplicada,old.cargo_decidido_at,old.tarifa_uf)');
 definition:=replace(definition,'  new.cargo_decidido_at:=clock_timestamp();',$body$
  select * into periodo from public.maquinaria_periodos_costo p where p.empresa=new.empresa and p.equipo_id=equipo.id and p.desde<=new.fecha and (p.hasta is null or new.fecha<p.hasta) and p.obra_id=new.cargo_obra_id order by p.desde desc,p.id desc limit 1;
  config:=case when periodo.id is not null then periodo.tarifa_uf else private.maquinaria_config_uf(equipo) end;
  new.tarifa_uf:=null;
  -- A prior same-day snapshot wins over later changes to the equipment tariff.
  select r.tarifa_uf into new.tarifa_uf from public.maquinaria_uso_diario r where r.empresa=new.empresa and r.equipo_id=new.equipo_id and r.fecha=new.fecha and r.tarifa_uf is not null order by r.cargo_decidido_at desc,r.id desc limit 1;
  config:=coalesce(new.tarifa_uf,config);
  if config is not null and (anterior.id is null or anterior.tarifa_uf is not null) then
    select coalesce(sum(greatest(0,coalesce(r.horas_trabajadas,r.horometro_final-r.horometro_inicial,0))),0) into horas from public.maquinaria_uso_diario r where r.empresa=new.empresa and r.equipo_id=new.equipo_id and r.fecha=new.fecha;
    horas:=horas+greatest(0,coalesce(new.horas_trabajadas,new.horometro_final-new.horometro_inicial,0));
    new.tarifa_uf:=config||jsonb_build_object('horas',horas,'fecha_uf',new.fecha,'valor_uf',(select valor from public.maquinaria_uf_valores where fecha=new.fecha));
    new.tarifa_diaria_aplicada:=private.maquinaria_monto_uf(config,new.fecha,horas);
  elsif anterior.id is null and periodo.id is not null then
    new.tarifa_diaria_aplicada:=periodo.tarifa;
  end if;
  new.cargo_decidido_at:=clock_timestamp();$body$);
 execute definition;
end $migration$;

-- UF contractual conditions belong to each new period, not to historical charges.
do $migration$
declare definition text;
begin
 select pg_get_functiondef('private.historial_maquinaria_costo()'::regprocedure) into definition;
 if position('then return new; end if;' in definition)=0 then raise exception 'Unexpected machinery period trigger'; end if;
 definition:=replace(definition,'then return new; end if;', $body$and (new.unidad_costo_interno not like 'UF/%' or row(new.cantidad_minima,new.tipo_condicion_minima,new.modalidad_dias) is not distinct from row(old.cantidad_minima,old.tipo_condicion_minima,old.modalidad_dias)) then return new; end if;$body$);
 execute definition;
end $migration$;

-- Confirmed decisions also use the date-specific quote; never trust a client conversion.
create function private.maquinaria_decision_uf() returns trigger language plpgsql security invoker set search_path='' as $$
declare config jsonb; horas numeric; calculated numeric;
begin
 if TG_OP='UPDATE' and old.tipo='confirmar' and old.tarifa_uf is not null and new.tipo='confirmar' then
  if row(new.monto,new.fecha,new.equipo_id,new.empresa) is distinct from row(old.monto,old.fecha,old.equipo_id,old.empresa) then raise exception 'El cargo UF confirmado conserva su valor original'; end if;
  new.tarifa_uf:=old.tarifa_uf;return new;
 end if;
 new.tarifa_uf:=null;
 if new.tipo<>'confirmar' then return new; end if;
 select r.tarifa_uf into config from public.maquinaria_uso_diario r where r.empresa=new.empresa and r.equipo_id=new.equipo_id::text and r.fecha=new.fecha order by r.cargo_decidido_at desc,r.id desc limit 1;
 if found and config is null then return new; end if;
 if config is null then select p.tarifa_uf into config from public.maquinaria_periodos_costo p where p.empresa=new.empresa and p.equipo_id=new.equipo_id and p.obra_id=new.obra_id and p.desde<=new.fecha and (p.hasta is null or new.fecha<p.hasta) order by p.desde desc,p.id desc limit 1; end if;
 if config is null then return new; end if;
 horas:=(config->>'horas')::numeric;
 calculated:=private.maquinaria_monto_uf(config,new.fecha,horas);
 if calculated is null then raise exception 'Falta la UF exacta del día del cargo o las horas reportadas. No se puede confirmar todavía.'; end if;
 if new.monto is distinct from calculated then raise exception 'El monto no coincide con la UF del día del cargo. Actualiza antes de confirmar.'; end if;
 new.tarifa_uf:=config||jsonb_build_object('fecha_uf',new.fecha,'valor_uf',(select valor from public.maquinaria_uf_valores where fecha=new.fecha));
 return new;
end $$;
revoke all on function private.maquinaria_decision_uf() from public,anon,authenticated;
create trigger zz_maquinaria_decision_uf before insert or update on public.maquinaria_decisiones_costo for each row execute function private.maquinaria_decision_uf();

do $migration$
declare definition text;
begin
 select pg_get_functiondef('private.maquinaria_cargo_para_imputar(text,integer,integer,date)'::regprocedure) into definition;
 if position('amount:=coalesce(r.tarifa_diaria_aplicada,p.tarifa);' in definition)=0 then raise exception 'Unexpected machinery allocation resolver'; end if;
 definition:=replace(definition,'amount:=coalesce(r.tarifa_diaria_aplicada,p.tarifa);','amount:=coalesce(r.tarifa_diaria_aplicada,private.maquinaria_monto_uf(r.tarifa_uf,d,(r.tarifa_uf->>''horas'')::numeric),private.maquinaria_monto_uf(p.tarifa_uf,d),p.tarifa);');
 definition:=replace(definition,'amount:=p.tarifa;','amount:=coalesce(private.maquinaria_monto_uf(p.tarifa_uf,d),p.tarifa);');
 definition:=replace(definition,'src.equipo_id=e and src.desde<=d','src.equipo_id=e and src.obra_id=w and src.desde<=d');
 definition:=replace(definition,'or extract(isodow from d)>5','or (extract(isodow from d)>5 and coalesce(p.tarifa_uf->>''modalidad'',''laborales'')<>''calendario'')');
 execute definition;
end $migration$;
notify pgrst,'reload schema';
