-- Personal ENEX morning email. No movement, assignment or import is modified.
-- The existing role router queues the email; this reservation is taken immediately
-- before contacting the provider and is never released on uncertain results.
create table if not exists private.enex_daily_email (
 empresa text not null, owner_id uuid not null, day date not null,
 delivery_id bigint not null, claimed_at timestamptz not null default now(),
 primary key(empresa,owner_id,day), unique(delivery_id)
);
alter table private.enex_daily_email enable row level security;
revoke all on private.enex_daily_email from public,anon,authenticated,service_role;

create or replace function private.enex_claim_pending_email(p_delivery bigint)
returns jsonb language plpgsql security definer set search_path='' as $$
declare d public.notificaciones_entregas; recipient record; summary jsonb;
 today date := (now() at time zone 'America/Santiago')::date; reserved bigint;
begin
 -- Only the authenticated internal worker has EXECUTE (not browser clients).
 select * into d from public.notificaciones_entregas where id=p_delivery for update;
 if not found or d.evento_codigo<>'enex_pendiente' or d.canal<>'Correo'
  or d.estado<>'Procesando' or d.role_route_key is null
  or (d.created_at at time zone 'America/Santiago')::date<>today
  or extract(hour from now() at time zone 'America/Santiago')<>9 then
  return null;
 end if;
 select u.auth_user_id,u.nombre,u.usuario into recipient
 from public.usuarios u join public.roles r on r.empresa=u.empresa and r.nombre=u.rol
 join public.role_notifications n on n.empresa=u.empresa and n.role_id=r.id
 where u.empresa=d.empresa and u.correo=d.destinatario and u.auth_user_id is not null
 and r.id::text=d.payload->>'role_id' and not coalesce(r.archivado,false)
 and n.settings->'enex_pendiente'->>'email'='true';
 if not found then return null;end if;
 select jsonb_build_object('company',d.empresa,'name',coalesce(nullif(recipient.nombre,''),recipient.usuario),
   'day',today,'count',sum(g.n),'oldest',min(g.oldest),
   'vehicles',jsonb_agg(jsonb_build_object('vehicle',g.vehicle,'portal',g.portal,'count',g.n) order by g.vehicle,g.portal))
 into summary from (
   select vehicle,portal,count(*) n,min(occurred_local::date) oldest
   from private.enex_pending_owned
   where empresa=d.empresa and owner_id=recipient.auth_user_id
   group by vehicle,portal
 ) g;
 if coalesce((summary->>'count')::integer,0)=0 then return null;end if;
 insert into private.enex_daily_email(empresa,owner_id,day,delivery_id)
 values(d.empresa,recipient.auth_user_id,today,d.id)
 on conflict do nothing returning delivery_id into reserved;
 if reserved is null then return null;end if;
 return summary;
end $$;
revoke all on function private.enex_claim_pending_email(bigint) from public,anon,authenticated;
grant usage on schema private to service_role;
grant execute on function private.enex_claim_pending_email(bigint) to service_role;
create or replace function public.enex_claim_pending_email(p_delivery bigint)
returns jsonb language sql security invoker set search_path='' as $$
 select private.enex_claim_pending_email(p_delivery);
$$;
revoke all on function public.enex_claim_pending_email(bigint) from public,anon,authenticated;
grant execute on function public.enex_claim_pending_email(bigint) to service_role;

-- Explicit request: enable personal pending reminders in EMINSG's active roles.
-- Keep every other event and any existing web/mobile preference unchanged.
insert into public.role_notifications(empresa,role_id,settings)
select empresa,id,jsonb_build_object('enex_pendiente',jsonb_build_object(
 'email',true,'mobile',true,'web',true,'works','all','forms','all','form_ids','[]'::jsonb,
 'equipment','all','equipment_ids','[]'::jsonb))
from public.roles where empresa='EMINSG' and not coalesce(archivado,false)
on conflict(empresa,role_id) do update set
 settings=public.role_notifications.settings || jsonb_build_object('enex_pendiente',
  coalesce(public.role_notifications.settings->'enex_pendiente',excluded.settings->'enex_pendiente') || '{"email":true}'::jsonb),
 updated_at=now();
