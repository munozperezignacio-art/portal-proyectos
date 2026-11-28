-- Explicit review of the saved revision, independent from editing/approval.
alter table private.specialty_protocols add column if not exists revisado_por text;
alter table private.specialty_protocols add column if not exists revisado_at timestamptz;
alter table private.specialty_protocols add column if not exists revision_revisada integer;
alter table private.quality_specialty_protocols add column if not exists revisado_por text;
alter table private.quality_specialty_protocols add column if not exists revisado_at timestamptz;
alter table private.quality_specialty_protocols add column if not exists revision_revisada integer;

create or replace function private.guard_protocol_review() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if tg_op='INSERT' and new.estado='aprobado' then
  if not ((tg_table_name='specialty_protocols' and exists(select 1 from private.specialty_protocols where id=new.id)) or (tg_table_name='quality_specialty_protocols' and exists(select 1 from private.quality_specialty_protocols where id=new.id))) then raise exception 'Primero crea y revisa el borrador';end if;
 end if;
 if tg_op='UPDATE' and old.estado='aprobado' then raise exception 'El protocolo aprobado está protegido';end if;
 if tg_op='UPDATE' and new.estado='aprobado' then
  if old.revision_revisada is distinct from old.revision or old.revisado_at is null then raise exception 'Debes revisar esta versión antes de aprobar';end if;
  if (new.snapshot-'aprobado_por'-'aprobado_at') is distinct from (old.snapshot-'aprobado_por'-'aprobado_at') or new.fecha<>old.fecha then raise exception 'Los datos cambiaron desde la revisión; guarda el borrador y vuelve a revisarlo';end if;
 end if;
 return new;
end $$;
drop trigger if exists protocol_review_required on private.specialty_protocols;
create trigger protocol_review_required before insert or update on private.specialty_protocols for each row execute function private.guard_protocol_review();
drop trigger if exists protocol_review_required on private.quality_specialty_protocols;
create trigger protocol_review_required before insert or update on private.quality_specialty_protocols for each row execute function private.guard_protocol_review();

create or replace function private.protocol_review_api(p_work integer,p_kind text,p_id uuid,p_revision integer)
returns jsonb language plpgsql security definer set search_path='' as $$
declare w public.obras; actor_name text; rec record;
begin
 select * into w from public.obras where id=p_work;
 if auth.uid() is null or w.id is null or not coalesce(private.rrhh_partidas_permiso(w.empresa,p_work,'ver'),false)
 or not coalesce(private.obraxis_permission(w.empresa,'obras.calidad.ver'),false)
 or not coalesce(private.obraxis_permission(w.empresa,'obras.calidad.revisar'),false) then raise exception 'Falta permiso Revisar de Calidad en esta obra';end if;
 if p_kind not in ('pilas','general') then raise exception 'Tipo de protocolo inválido';end if;
 select coalesce(nombre,usuario,auth.uid()::text) into actor_name from public.usuarios where auth_user_id=auth.uid() and empresa=w.empresa limit 1;
 if p_kind='pilas' then select * into rec from private.specialty_protocols where id=p_id and obra_id=p_work for update;
 else select * into rec from private.quality_specialty_protocols where id=p_id and obra_id=p_work for update;end if;
 if rec.id is null or rec.estado<>'borrador' or rec.revision<>p_revision then raise exception 'Borrador ajeno, aprobado o modificado; actualiza antes de revisar';end if;
 if p_kind='pilas' then update private.specialty_protocols set revisado_por=actor_name,revisado_at=now(),revision_revisada=revision where id=p_id;
 else update private.quality_specialty_protocols set revisado_por=actor_name,revisado_at=now(),revision_revisada=revision where id=p_id;end if;
 insert into private.specialty_audit(obra_id,actor,accion,referencia) values(p_work,auth.uid(),'protocol_review',p_kind||':'||p_id||':'||p_revision);
 return jsonb_build_object('ok',true);
end $$;
revoke all on function private.protocol_review_api(integer,text,uuid,integer) from public,anon;
grant execute on function private.protocol_review_api(integer,text,uuid,integer) to authenticated;
create or replace function public.protocol_review_api(p_work integer,p_kind text,p_id uuid,p_revision integer)
returns jsonb language sql security invoker set search_path='' as $$select private.protocol_review_api(p_work,p_kind,p_id,p_revision)$$;
revoke all on function public.protocol_review_api(integer,text,uuid,integer) from public,anon;
grant execute on function public.protocol_review_api(integer,text,uuid,integer) to authenticated;

do $$ declare def text; begin
 def:=pg_get_functiondef('private.specialty_api(integer,text,jsonb)'::regprocedure);
 if strpos(def,'''protocol_review''')=0 then
 def:=replace(def,'''protocol_create'',','''protocol_review'',coalesce(private.obraxis_permission(w.empresa,''obras.calidad.revisar''),false),''protocol_download'',coalesce(private.obraxis_permission(w.empresa,''obras.calidad.descargar''),false),''protocol_create'',');execute def;end if;
 def:=pg_get_functiondef('private.quality_specialties_api(integer,text,jsonb)'::regprocedure);
 if strpos(def,'''can_review''')=0 then def:=replace(def,'''can_approve'',','''can_review'',coalesce(private.obraxis_permission(w.empresa,''obras.calidad.revisar''),false),''can_approve'',');end if;
 -- An approver does not need editor permission to approve an unchanged, reviewed draft.
 def:=replace(def,'case when rec.id is null then ''obras.calidad.crear'' else ''obras.calidad.editar'' end','case when p_data->>''estado''=''aprobado'' then ''obras.calidad.aprobar'' when rec.id is null then ''obras.calidad.crear'' else ''obras.calidad.editar'' end');
 execute def;
end $$;
notify pgrst,'reload schema';
