-- Read-only snapshot of deployed RPCs/triggers, 2026-11-25. Synthetic test DB only.
CREATE OR REPLACE FUNCTION private.enex_validate_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 if TG_OP='UPDATE' and (new.empresa<>old.empresa or new.movement_id<>old.movement_id) then raise exception 'Assignment identity immutable'; end if;
 if new.obra_id is not null and not exists(select 1 from public.obras o where o.id=new.obra_id and o.empresa=new.empresa) then raise exception 'Work/company mismatch'; end if;
 if new.centro_gestion_id is not null and not exists(select 1 from public.facturacion_centros_gestion c where c.id=new.centro_gestion_id and c.empresa=new.empresa and c.activo) then raise exception 'Center/company mismatch'; end if;
 if new.obra_id is not null and new.centro_gestion_id is not null and not exists(select 1 from public.obras o where o.id=new.obra_id and o.centro_gestion_id=new.centro_gestion_id) then raise exception 'Work/center mismatch'; end if;
 if TG_OP='UPDATE' and new.obra_id is not distinct from old.obra_id and new.centro_gestion_id is not distinct from old.centro_gestion_id and new.note is not distinct from old.note then return null;end if;
 new.actor:=auth.uid();new.updated_at:=now();
 return new;
end;$function$;

CREATE OR REPLACE FUNCTION private.enex_audit_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
 insert into public.enex_assignment_audit(empresa,movement_id,previous_assignment,new_assignment)
 values(new.empresa,new.movement_id,case when TG_OP='UPDATE' then to_jsonb(old) else null end,to_jsonb(new));
 return new;
end;$function$;

CREATE OR REPLACE FUNCTION public.enex_my_pending(p_company text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select jsonb_build_object('rows',coalesce((select jsonb_agg(jsonb_build_object('id',id,'vehicle',vehicle,'portal',portal,'document',document,'date',occurred_local,'amount',-amount_signed,'station',(select m.station from public.enex_movements m where m.id=enex_pending_owned.id),'station_commune',(select m.station_commune from public.enex_movements m where m.id=enex_pending_owned.id)) order by occurred_local desc) from private.enex_pending_owned where empresa=p_company and owner_id=auth.uid()),'[]'::jsonb),
 'centers',coalesce((select jsonb_agg(jsonb_build_object('id',id,'name',nombre,'code',codigo) order by codigo) from public.facturacion_centros_gestion where empresa=p_company and activo and exists(select 1 from private.enex_pending_owned where empresa=p_company and owner_id=auth.uid())),'[]'::jsonb));
$function$;

CREATE OR REPLACE FUNCTION public.enex_charge_center(p_company text, p_id uuid, p_center integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 perform 1 from public.enex_movements m join public.enex_owners o using(empresa,portal,vehicle)
 join public.usuarios u on u.empresa=m.empresa and u.auth_user_id=o.owner_id
 where m.empresa=p_company and m.id=p_id and o.owner_id=auth.uid() for share of o;
 if not found then raise exception 'Movimiento no asignado al usuario'; end if;
 if p_center is null then raise exception 'Seleccione un centro'; end if;
 insert into public.enex_assignments(empresa,movement_id,centro_gestion_id) values(p_company,p_id,p_center);
end $function$;
