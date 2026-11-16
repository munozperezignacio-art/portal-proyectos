begin;
create table public.enex_owners (
 empresa text not null, portal text not null check(portal in ('empresa','transporte')),
 vehicle text not null, owner_id uuid not null references auth.users(id),
 primary key(empresa,portal,vehicle)
);
alter table public.enex_owners enable row level security;
revoke all on public.enex_owners from public, anon, authenticated;
grant select,insert,update,delete on public.enex_owners to authenticated;
create policy owners_manage on public.enex_owners for all to authenticated
 using(private.enex_allowed(empresa,'editar'))
 with check(private.enex_allowed(empresa,'editar') and exists(select 1 from public.usuarios u where u.empresa=enex_owners.empresa and u.auth_user_id=owner_id)
 and exists(select 1 from public.enex_movements m where (m.empresa,m.portal,m.vehicle)=(enex_owners.empresa,enex_owners.portal,enex_owners.vehicle)));
create view private.enex_pending_owned as select m.*,o.owner_id from public.enex_movements m
 join public.enex_owners o using(empresa,portal,vehicle)
 join public.usuarios u on u.empresa=m.empresa and u.auth_user_id=o.owner_id
 where not exists(select 1 from public.enex_assignments a where a.movement_id=m.id);
create function public.enex_my_pending(p_company text) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('rows',coalesce((select jsonb_agg(jsonb_build_object('id',id,'vehicle',vehicle,'portal',portal,'document',document,'date',occurred_local,'amount',-amount_signed) order by occurred_local desc) from private.enex_pending_owned where empresa=p_company and owner_id=auth.uid()),'[]'::jsonb),
 'centers',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',nombre,'code',codigo) order by codigo) from public.facturacion_centros_gestion where empresa=p_company and activo and exists(select 1 from private.enex_pending_owned where empresa=p_company and owner_id=auth.uid())),'[]'::jsonb));
$$;
create function public.enex_charge_center(p_company text,p_id uuid,p_center integer) returns void language plpgsql security definer set search_path='' as $$
begin
 perform 1 from public.enex_movements m join public.enex_owners o using(empresa,portal,vehicle)
 join public.usuarios u on u.empresa=m.empresa and u.auth_user_id=o.owner_id
 where m.empresa=p_company and m.id=p_id and o.owner_id=auth.uid() for share of o;
 if not found then raise exception 'Movimiento no asignado al usuario'; end if;
 if p_center is null then raise exception 'Seleccione un centro'; end if;
 insert into public.enex_assignments(empresa,movement_id,centro_gestion_id) values(p_company,p_id,p_center);
end $$;
revoke all on function public.enex_my_pending(text),public.enex_charge_center(text,uuid,integer) from public,anon;
grant execute on function public.enex_my_pending(text),public.enex_charge_center(text,uuid,integer) to authenticated;
create table private.enex_daily_notice(empresa text,owner_id uuid,day date,primary key(empresa,owner_id,day));
create function private.enex_notify_pending() returns void language sql security invoker set search_path='' as $$
 with pending as (select empresa,owner_id,count(*) n from private.enex_pending_owned
 where extract(hour from now() at time zone 'America/Santiago')=9 group by empresa,owner_id),
 claimed as (insert into private.enex_daily_notice select empresa,owner_id,(now() at time zone 'America/Santiago')::date from pending on conflict do nothing returning *)
 insert into public.notificaciones_entregas(empresa,evento_codigo,canal,destinatario,asunto,estado,payload,enviada_at)
 select c.empresa,'enex_pendiente','Plataforma',u.id::text,'Combustibles: '||p.n||' cargas pendientes de asignar','Enviada',
 jsonb_build_object('detalle','Abre Combustibles para asignar el centro de gestión.','destination','combustibles','push_enabled',true),now()
 from claimed c join pending p using(empresa,owner_id) join public.usuarios u on u.empresa=c.empresa and u.auth_user_id=c.owner_id;
$$;
revoke all on function private.enex_notify_pending() from public,anon,authenticated;
select cron.schedule('enex-pendientes-manana','0 * * * *','select private.enex_notify_pending()');
commit;
