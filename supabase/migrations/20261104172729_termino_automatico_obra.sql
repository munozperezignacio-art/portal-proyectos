-- Physical completion is independent from scheduling, payroll and charge closure.
alter table public.bitacora_eventos_obra drop constraint bitacora_eventos_obra_categoria_check;
alter table public.bitacora_eventos_obra add constraint bitacora_eventos_obra_categoria_check
 check(categoria in ('Estados de Pago','Calidad','Prevención','Avance de obra'));
create table public.obra_termino_trabajos (
 empresa text not null, obra_id integer not null references public.obras(id) on delete cascade,
 estado text not null check(estado in ('en_curso','completada','revisar')),
 fecha_termino date, fecha_calculada date, alcance jsonb not null default '[]',
 partidas_total integer not null default 0, partidas_completas integer not null default 0,
 actualizado_en timestamptz not null default now(), primary key(empresa,obra_id)
);
alter table public.obra_termino_trabajos enable row level security;
revoke all on public.obra_termino_trabajos from public,anon,authenticated;
grant select on public.obra_termino_trabajos to authenticated;
create policy termino_lectura on public.obra_termino_trabajos for select to authenticated
 using(private.rrhh_partidas_permiso(empresa,obra_id,'ver'));

create function private.recalcular_termino_trabajos(c text,w integer) returns void
language plpgsql security definer set search_path='' as $$
declare o public.obras; prev public.obra_termino_trabajos; n integer; completos integer;
 cierre date; scope jsonb; estado_n text; fecha_n date; accion_n text;
begin
 select * into o from public.obras where empresa=c and id=w for update;
 if not found then return; end if;
 select * into prev from public.obra_termino_trabajos where empresa=c and obra_id=w;
 with parts as (
  select p.* from public.partidas_obra p where p.empresa=c
   and (p.obra_id=w or (p.obra_id is null and p.obra_nombre=o.nombre
    and (select count(*) from public.obras where empresa=c and nombre=o.nombre)=1))
   and not coalesce(p.es_titulo,false) and upper(coalesce(p.unidad,'')) not in ('TITULO','GRUPO')
   and upper(coalesce(p.tipo_item,'')) not in ('TITULO','GRUPO')
 ), daily as (
  select p.id,(a.created_at at time zone 'America/Santiago')::date dia,sum(a.cantidad) cantidad
  from parts p join public.avances_produccion_partidas a on a.empresa=c
   and (a.obra_id=w or (a.obra_id is null and a.obra_nombre=o.nombre
    and (select count(*) from public.obras where empresa=c and nombre=o.nombre)=1))
   and (a.partida_id=p.id or (a.partida_id is null and a.partida=p.partida
    and (select count(*) from parts q where q.partida=p.partida)=1))
  where a.created_at is not null and (a.created_at at time zone 'America/Santiago')::date <= (now() at time zone 'America/Santiago')::date
  group by p.id,dia
 ), accumulated as (
  select *,sum(cantidad) over(partition by id order by dia) acumulado from daily
 ), sustained as (
  select *,min(acumulado) over(partition by id order by dia rows between current row and unbounded following) minimo from accumulated
 ), result as (
  select p.id,p.cantidad_presupuestada,min(s.dia) filter(where s.minimo>=p.cantidad_presupuestada and p.cantidad_presupuestada>0) fin
  from parts p left join sustained s on s.id=p.id group by p.id,p.cantidad_presupuestada
 ) select count(*),count(fin),max(fin),coalesce(jsonb_agg(jsonb_build_object('id',id,'cantidad',cantidad_presupuestada) order by id),'[]')
 into n,completos,cierre,scope from result;
 if n=0 or completos<>n then cierre:=null; end if;
 fecha_n:=coalesce(prev.fecha_termino,cierre);
 estado_n:=case when prev.estado='revisar' then 'revisar'
  when prev.fecha_termino is not null and (cierre is distinct from prev.fecha_termino or scope is distinct from prev.alcance) then 'revisar'
  when cierre is not null then 'completada' else 'en_curso' end;
 if prev.obra_id is not null and prev.estado=estado_n and prev.fecha_calculada is not distinct from cierre
  and prev.alcance=scope and prev.partidas_completas=completos then return; end if;
 insert into public.obra_termino_trabajos(empresa,obra_id,estado,fecha_termino,fecha_calculada,alcance,partidas_total,partidas_completas)
 values(c,w,estado_n,fecha_n,cierre,scope,n,completos)
 on conflict(empresa,obra_id) do update set estado=excluded.estado,fecha_termino=excluded.fecha_termino,
 fecha_calculada=excluded.fecha_calculada,alcance=excluded.alcance,partidas_total=n,partidas_completas=completos,actualizado_en=now();
 -- Keep the existing project field connected to exports and other consumers.
 if fecha_n is not null then
  update public.obras set fecha_termino_real=fecha_n where id=w and empresa=c and fecha_termino_real is distinct from fecha_n;
 end if;
 accion_n:=case when estado_n='completada' and prev.fecha_termino is null then 'Trabajos completados al 100%'
 when estado_n='revisar' and prev.estado is distinct from 'revisar' then 'Revisar término de trabajos: cambió el avance o el alcance' end;
 if accion_n is not null then
  insert into public.bitacora_eventos_obra(empresa,obra_nombre,categoria,accion,detalle,actor,fecha)
  values(c,o.nombre,'Avance de obra',accion_n,
   format('Término real registrado: %s. Partidas completas: %s de %s. La programación y el cierre de cargos no se modifican. Los costos finales pueden continuar registrándose.%s',fecha_n,completos,n,
    case when estado_n='revisar' then ' Se conserva la fecha anterior; revisar los reportes y el alcance.' else '' end),
   'Sistema · avance físico',case when estado_n='completada' then fecha_n else (now() at time zone 'America/Santiago')::date end);
 end if;
end $$;
revoke all on function private.recalcular_termino_trabajos(text,integer) from public,anon,authenticated;

create function private.actualizar_termino_trabajos() returns trigger language plpgsql security definer set search_path='' as $$
declare r record; a jsonb; b jsonb;
begin
 if TG_OP<>'INSERT' then a:=to_jsonb(old); end if;
 if TG_OP<>'DELETE' then b:=to_jsonb(new); end if;
 for r in select distinct o.empresa,o.id from public.obras o join (values(a),(b)) v(j)
  on o.empresa=j->>'empresa' and (o.id=nullif(j->>'obra_id','')::integer
   or (j->>'obra_id' is null and o.nombre=j->>'obra_nombre')) order by o.empresa,o.id
 loop perform private.recalcular_termino_trabajos(r.empresa,r.id); end loop;
 return null;
end $$;
revoke all on function private.actualizar_termino_trabajos() from public,anon,authenticated;
create function private.conservar_termino_automatico() returns trigger language plpgsql security definer set search_path='' as $$
declare fecha date; begin
 select fecha_termino into fecha from public.obra_termino_trabajos where empresa=new.empresa and obra_id=new.id;
 if fecha is not null then new.fecha_termino_real:=fecha; end if;
 return new;
end $$;
revoke all on function private.conservar_termino_automatico() from public,anon,authenticated;
create trigger conservar_termino_automatico before update on public.obras for each row execute function private.conservar_termino_automatico();
-- Deferred: a multi-part report/budget operation is evaluated only after all its rows exist.
create constraint trigger termino_por_avance after insert or update or delete on public.avances_produccion_partidas
 deferrable initially deferred for each row execute function private.actualizar_termino_trabajos();
create constraint trigger termino_por_alcance after insert or update or delete on public.partidas_obra
 deferrable initially deferred for each row execute function private.actualizar_termino_trabajos();
do $$ declare r record; begin
 for r in select empresa,id from public.obras order by empresa,id loop
  perform private.recalcular_termino_trabajos(r.empresa,r.id);
 end loop;
end $$;
