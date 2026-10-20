-- Assignment history and explicit daily decisions: estimated charges are not invoices.
create table if not exists public.maquinaria_periodos_costo (
 id bigint generated always as identity primary key, empresa text not null,
 equipo_id integer not null, obra_id bigint not null references public.obras(id),
 desde date not null, hasta date, tarifa numeric check(tarifa>=0),
 equipo_tipo text, equipo_patente text, created_at timestamptz not null default now(),
 check(hasta is null or hasta>=desde)
);
create index if not exists maquinaria_periodos_empresa_equipo on public.maquinaria_periodos_costo(empresa,equipo_id,desde);
alter table public.maquinaria_periodos_costo enable row level security;
revoke all on public.maquinaria_periodos_costo from public,anon,authenticated;
grant select on public.maquinaria_periodos_costo to authenticated;
grant all on public.maquinaria_periodos_costo to service_role;
create policy periodos_lectura on public.maquinaria_periodos_costo for select to authenticated using(private.obraxis_actor_can_access_company(empresa));

insert into public.maquinaria_periodos_costo(empresa,equipo_id,obra_id,desde,tarifa,equipo_tipo,equipo_patente)
select i.empresa,i.id,o.id,coalesce(i.fecha_asig,(now() at time zone 'America/Santiago')::date),
 case when lower(i.unidad_costo_interno) in ('$/día','$/dia') then i.costo_interno end,i.tipo,i.patente
from public.inventario_maquinaria i join public.obras o on o.empresa=i.empresa and o.nombre=i.obra_nombre
where not exists(select 1 from public.maquinaria_periodos_costo p where p.equipo_id=i.id and p.empresa=i.empresa);

alter table public.inventario_maquinaria add column if not exists fecha_cambio_asignacion date;
create or replace function private.historial_maquinaria_costo() returns trigger
language plpgsql security definer set search_path='' as $$
declare destino bigint; cambio date; anterior public.maquinaria_periodos_costo;
begin
 if auth.uid() is not null and not private.obraxis_actor_can_access_company(coalesce(new.empresa,old.empresa)) then raise exception 'Empresa no autorizada'; end if;
 if TG_OP='UPDATE' and row(new.empresa,new.obra_nombre,new.costo_interno,new.unidad_costo_interno,new.fecha_asig,new.fecha_cambio_asignacion)
   is not distinct from row(old.empresa,old.obra_nombre,old.costo_interno,old.unidad_costo_interno,old.fecha_asig,old.fecha_cambio_asignacion) then return new; end if;
 cambio:=(now() at time zone 'America/Santiago')::date;
 if TG_OP='INSERT' then cambio:=coalesce(new.fecha_asig,cambio);
 elsif TG_OP='UPDATE' then
   if new.empresa is distinct from old.empresa then raise exception 'No se permite cambiar la empresa de un equipo con historial'; end if;
   if new.fecha_cambio_asignacion is distinct from old.fecha_cambio_asignacion then cambio:=coalesce(new.fecha_cambio_asignacion,cambio);
   elsif new.obra_nombre is distinct from old.obra_nombre and new.fecha_asig is distinct from old.fecha_asig then cambio:=coalesce(new.fecha_asig,cambio); end if;
 end if;
 if TG_OP<>'INSERT' then
   select * into anterior from public.maquinaria_periodos_costo where empresa=old.empresa and equipo_id=old.id and hasta is null order by desde desc,id desc limit 1 for update;
   if found then
     if cambio<anterior.desde then raise exception 'El cambio antecede al período vigente. Revisa la fecha para conservar el historial.'; end if;
     update public.maquinaria_periodos_costo set hasta=cambio where id=anterior.id;
   end if;
 end if;
 if TG_OP='DELETE' then return old; end if;
 select id into destino from public.obras where empresa=new.empresa and nombre=new.obra_nombre;
 if destino is not null then
   insert into public.maquinaria_periodos_costo(empresa,equipo_id,obra_id,desde,tarifa,equipo_tipo,equipo_patente)
   values(new.empresa,new.id,destino,cambio,case when lower(new.unidad_costo_interno) in ('$/día','$/dia') then new.costo_interno end,new.tipo,new.patente);
 end if;
 return new;
end $$;
revoke all on function private.historial_maquinaria_costo() from public,anon,authenticated;
create trigger historial_maquinaria_costo after insert or update or delete on public.inventario_maquinaria for each row execute function private.historial_maquinaria_costo();

create table if not exists public.maquinaria_decisiones_costo (
 empresa text not null,equipo_id integer not null,fecha date not null,
 obra_id bigint not null references public.obras(id),periodo_id bigint references public.maquinaria_periodos_costo(id),
 tipo text not null check(tipo in ('confirmar','no_uso','retiro')),
 monto numeric check(monto>=0),motivo text not null check(length(btrim(motivo))>0),
 actualizado_por uuid,actualizado_at timestamptz not null default now(),
 primary key(empresa,equipo_id,fecha),check(tipo<>'confirmar' or monto is not null),check(tipo<>'retiro' or periodo_id is not null)
);
alter table public.maquinaria_decisiones_costo enable row level security;
revoke all on public.maquinaria_decisiones_costo from public,anon,authenticated;
grant select,insert,update on public.maquinaria_decisiones_costo to authenticated;
grant all on public.maquinaria_decisiones_costo to service_role;
create policy decisiones_lectura on public.maquinaria_decisiones_costo for select to authenticated using(private.obraxis_actor_can_access_company(empresa));
create policy decisiones_insert on public.maquinaria_decisiones_costo for insert to authenticated with check(private.obraxis_actor_can_access_company(empresa) and (private.obraxis_permission(empresa,'obras.gestion.configurar') or private.obraxis_permission(empresa,'obras.maquinaria.editar')));
create policy decisiones_update on public.maquinaria_decisiones_costo for update to authenticated using(private.obraxis_actor_can_access_company(empresa) and (private.obraxis_permission(empresa,'obras.gestion.configurar') or private.obraxis_permission(empresa,'obras.maquinaria.editar'))) with check(private.obraxis_actor_can_access_company(empresa) and (private.obraxis_permission(empresa,'obras.gestion.configurar') or private.obraxis_permission(empresa,'obras.maquinaria.editar')));
create or replace function private.validar_decision_costo() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if not exists(select 1 from public.obras where id=new.obra_id and empresa=new.empresa) then raise exception 'Obra no autorizada'; end if;
 if new.periodo_id is not null and not exists(select 1 from public.maquinaria_periodos_costo where id=new.periodo_id and empresa=new.empresa and equipo_id=new.equipo_id and obra_id=new.obra_id) then raise exception 'Período incompatible'; end if;
 if not exists(select 1 from public.inventario_maquinaria where id=new.equipo_id and empresa=new.empresa) and not exists(select 1 from public.maquinaria_periodos_costo where equipo_id=new.equipo_id and empresa=new.empresa) then raise exception 'Equipo no autorizado'; end if;
 if new.tipo='confirmar' and new.fecha>(now() at time zone 'America/Santiago')::date then raise exception 'Un costo futuro no se puede confirmar como incurrido'; end if;
 new.actualizado_por:=auth.uid();new.actualizado_at:=now();return new;
end $$;
revoke all on function private.validar_decision_costo() from public,anon,authenticated;
create trigger validar_decision_costo before insert or update on public.maquinaria_decisiones_costo for each row execute function private.validar_decision_costo();

alter table public.costos_reales_obra add column if not exists estado_costo text not null default 'confirmado' check(estado_costo in ('confirmado','pendiente','proyectado'));
alter table public.costos_reales_obra add column if not exists fecha_costo date;
