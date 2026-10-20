-- Nuevos reportes: una tarifa diaria congelada y una decisión de destino por equipo/día.
-- No recalcula tarifas históricas ni crea cargos retroactivos sobre reportes anteriores.
alter table public.maquinaria_uso_diario
  add column if not exists obra_cargo_diario text,
  add column if not exists cargo_obra_id bigint,
  add column if not exists tarifa_diaria_aplicada numeric,
  add column if not exists cargo_decidido_at timestamptz;

create or replace function private.maquinaria_validar_cargo_diario()
returns trigger language plpgsql security invoker set search_path='' as $$
declare
  equipo public.inventario_maquinaria%rowtype;
  destinos text[];
  anterior public.maquinaria_uso_diario%rowtype;
begin
  if TG_OP='UPDATE' then
    if row(new.empresa,new.equipo_id,new.fecha,new.obra_cargo_diario,new.cargo_obra_id,new.tarifa_diaria_aplicada,new.cargo_decidido_at)
       is distinct from row(old.empresa,old.equipo_id,old.fecha,old.obra_cargo_diario,old.cargo_obra_id,old.tarifa_diaria_aplicada,old.cargo_decidido_at) then
      raise exception 'El destino y la tarifa del reporte no se pueden cambiar directamente. Registra un nuevo reporte con la elección de cargo.';
    end if;
    return new;
  end if;
  -- El bloqueo del equipo serializa las decisiones concurrentes del mismo día.
  if new.fecha is null then raise exception 'Indica la fecha del reporte de maquinaria.'; end if;
  select * into equipo from public.inventario_maquinaria
    where id::text=new.equipo_id and empresa=new.empresa for update;
  if not found then raise exception 'Equipo no disponible para esta empresa.'; end if;
  select array_agg(distinct destino order by destino) into destinos from (
    select r.obra_nombre as destino from public.maquinaria_uso_diario r
    where r.empresa=new.empresa and r.equipo_id=new.equipo_id and r.fecha=new.fecha
    union select new.obra_nombre
  ) d where destino is not null and btrim(destino)<>'';
  if cardinality(destinos)>1 and nullif(new.obra_cargo_diario,'') is null then
    raise exception using message='MAQUINARIA_DESTINO_REQUERIDO',
      detail=jsonb_build_object('obras',destinos,'fecha',new.fecha,'equipo',new.equipo_patente)::text;
  end if;
  if nullif(new.obra_cargo_diario,'') is not null and not(new.obra_cargo_diario=any(destinos)) then
    raise exception 'El cargo debe corresponder a una obra con reporte para ese equipo y día.';
  end if;
  select * into anterior from public.maquinaria_uso_diario r
    where r.empresa=new.empresa and r.equipo_id=new.equipo_id and r.fecha=new.fecha
      and r.tarifa_diaria_aplicada is not null
    order by r.cargo_decidido_at desc,r.id desc limit 1;
  new.obra_cargo_diario:=coalesce(nullif(new.obra_cargo_diario,''),
    (select o.nombre from public.obras o where o.id=anterior.cargo_obra_id and o.empresa=new.empresa),
    anterior.obra_cargo_diario,new.obra_nombre);
  select id into new.cargo_obra_id from public.obras where empresa=new.empresa and nombre=new.obra_cargo_diario;
  new.tarifa_diaria_aplicada:=anterior.tarifa_diaria_aplicada;
  if new.tarifa_diaria_aplicada is null and lower(coalesce(equipo.unidad_costo_interno,'')) in ('$/día','$/dia')
     and equipo.costo_interno>=0 then
    new.tarifa_diaria_aplicada:=round(equipo.costo_interno);
  end if;
  new.cargo_decidido_at:=clock_timestamp();
  return new;
end $$;
revoke all on function private.maquinaria_validar_cargo_diario() from public,anon,authenticated;
drop trigger if exists maquinaria_validar_cargo_diario on public.maquinaria_uso_diario;
create trigger maquinaria_validar_cargo_diario before insert or update on public.maquinaria_uso_diario
for each row execute function private.maquinaria_validar_cargo_diario();

create or replace view public.maquinaria_cargos_diarios with (security_invoker=true) as
select distinct on (r.empresa,r.equipo_id,r.fecha)
  r.id as reporte_id,r.empresa,r.equipo_id,r.equipo_tipo,r.equipo_patente,r.fecha,
  coalesce(o.nombre,r.obra_cargo_diario) as obra_nombre,r.tarifa_diaria_aplicada as monto
from public.maquinaria_uso_diario r
left join public.obras o on o.id=r.cargo_obra_id and o.empresa=r.empresa
where r.cargo_decidido_at is not null
order by r.empresa,r.equipo_id,r.fecha,r.cargo_decidido_at desc,r.id desc;
revoke all on public.maquinaria_cargos_diarios from public,anon;
grant select on public.maquinaria_cargos_diarios to authenticated,service_role;
