begin;
create table public.obra_jornadas_historial (
 id bigint generated always as identity primary key,
 obra_id integer not null references public.obras(id), empresa text not null,
 desde date not null, jornada jsonb not null, motivo text not null,
 autor text not null, actor uuid, registrado_at timestamptz not null default clock_timestamp(),
 recalculados integer not null default 0
);
create index obra_jornadas_vigencia_idx on public.obra_jornadas_historial(obra_id,empresa,desde desc,id desc);
alter table public.obra_jornadas_historial enable row level security;
revoke all on public.obra_jornadas_historial from public,anon,authenticated;
grant select on public.obra_jornadas_historial to authenticated,service_role;
create policy jornada_historial_lectura on public.obra_jornadas_historial for select to authenticated using
 (private.obraxis_actor_can_access_company(empresa) and exists(select 1 from public.obras o where o.id=obra_id and o.empresa=obra_jornadas_historial.empresa));
alter table public.obras add column jornadas_historial jsonb not null default '[]';
alter table public.asistencia_personal add column jornada_version_id bigint references public.obra_jornadas_historial(id);
create index asistencia_jornada_version_idx on public.asistencia_personal(jornada_version_id) where jornada_version_id is not null;
create table public.obra_jornada_recalculos (
 version_id bigint not null references public.obra_jornadas_historial(id),
 marcaje_id integer not null, anterior jsonb not null, posterior jsonb not null,
 primary key(version_id,marcaje_id)
);
alter table public.obra_jornada_recalculos enable row level security;
revoke all on public.obra_jornada_recalculos from public,anon,authenticated;
grant select on public.obra_jornada_recalculos to authenticated,service_role;
create policy jornada_recalculos_lectura on public.obra_jornada_recalculos for select to authenticated using
 (exists(select 1 from public.obra_jornadas_historial h where h.id=version_id));

-- Before the existing calculator: the date-effective version always wins over stale clients.
create function private.aplicar_jornada_vigente() returns trigger language plpgsql security invoker set search_path='' as $$
declare v public.obra_jornadas_historial%rowtype;
begin
 select * into v from public.obra_jornadas_historial
 where obra_id=new.obra_id and empresa=new.empresa and desde<=new.fecha_marcacion order by desde desc,id desc limit 1;
 if found then
  new.jornada_aplicada:=v.jornada->(extract(dow from new.fecha_marcacion)::integer)::text;
  new.jornada_version_id:=v.id;new.jornada_ordinaria_horas:=null;
 else
  new.jornada_version_id:=null;
  if TG_OP='UPDATE' and old.jornada_version_id is not null then
   select jornada_semanal->(extract(dow from new.fecha_marcacion)::integer)::text,jornada_ordinaria_horas into new.jornada_aplicada,new.jornada_ordinaria_horas from public.obras where id=new.obra_id and empresa=new.empresa;
  end if;
 end if;
 return new;
end $$;
revoke all on function private.aplicar_jornada_vigente() from public,anon,authenticated;
create trigger a00_jornada_vigente before insert or update of ingreso,salida,colacion,asistencia,jornada_ordinaria_horas,jornada_aplicada,fecha_marcacion,obra_id,empresa,horas_extras_auto,horas_ordinarias on public.asistencia_personal for each row execute function private.aplicar_jornada_vigente();
drop trigger calcular_horas_marcaje on public.asistencia_personal;
create trigger calcular_horas_marcaje before insert or update of ingreso,salida,colacion,asistencia,jornada_ordinaria_horas,jornada_aplicada,fecha_marcacion,obra_id,empresa,horas_extras_auto,horas_ordinarias on public.asistencia_personal for each row execute function private.calcular_horas_marcaje();

create function private.jornada_historial_json(p_obra integer) returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(h)-'actor' order by h.desde desc,h.id desc),'[]') from public.obra_jornadas_historial h where h.obra_id=p_obra;
$$;
revoke all on function private.jornada_historial_json(integer) from public,anon;
grant execute on function private.jornada_historial_json(integer) to authenticated,service_role;
create function private.proteger_jornada_historial() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.jornadas_historial is distinct from old.jornadas_historial and new.jornadas_historial is distinct from private.jornada_historial_json(new.id)
 then raise exception 'El historial de jornadas solo se modifica desde Jornada semanal'; end if;
 if old.jornadas_historial<>'[]'::jsonb and new.jornada_semanal is distinct from old.jornada_semanal
 then raise exception 'Guarda el horario con su fecha de vigencia desde Jornada semanal'; end if;
 return new;
end $$;
revoke all on function private.proteger_jornada_historial() from public,anon,authenticated;
create trigger proteger_jornada_historial before update of jornadas_historial,jornada_semanal on public.obras for each row execute function private.proteger_jornada_historial();

create function private.guardar_jornada_obra(p_obra integer,p_desde date,p_jornada jsonb,p_motivo text,p_revision bigint) returns jsonb
language plpgsql security definer set search_path='' as $$
declare w public.obras%rowtype; v bigint; latest bigint; d jsonb; k integer; inicio time; fin time; pa time; pb time; siguiente date; r record; after_row record; n integer:=0; nombre_actor text;
begin
 if auth.uid() is null then raise exception 'Sesión requerida'; end if;
 select * into w from public.obras where id=p_obra for update;
 if not found or not coalesce(private.obraxis_actor_can_access_company(w.empresa),false) or not coalesce(private.obraxis_permission(w.empresa,'obras.gestion.configurar'),false)
 then raise exception 'Sin permiso para configurar la jornada de esta obra'; end if;
 select coalesce(max(id),0) into latest from public.obra_jornadas_historial where obra_id=w.id and empresa=w.empresa;
 if p_revision is distinct from latest then raise exception 'La jornada cambió. Recarga la obra para revisar la última versión.'; end if;
 if p_desde is null or p_desde<date '2000-01-01' or p_desde>date '2100-12-31' then raise exception 'Indica una fecha de vigencia válida'; end if;
 if nullif(btrim(p_motivo),'') is null or length(p_motivo)>1000 then raise exception 'Indica el motivo del cambio (máximo 1000 caracteres)'; end if;
 if jsonb_typeof(p_jornada) is distinct from 'object' then raise exception 'Jornada inválida'; end if;
 for k in 0..6 loop
  d:=p_jornada->k::text;
  if jsonb_typeof(d->'active') is distinct from 'boolean' then raise exception 'Configura los siete días'; end if;
  if (d->>'active')::boolean then
   if coalesce(d->>'start','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(d->>'end','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Horario inválido'; end if;
   inicio:=(d->>'start')::time;fin:=(d->>'end')::time;
   if fin<=inicio then raise exception 'La salida debe ser posterior a la entrada'; end if;
   if nullif(d->>'breakStart','') is not null or nullif(d->>'breakEnd','') is not null then
    if coalesce(d->>'breakStart','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' or coalesce(d->>'breakEnd','')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$' then raise exception 'Colación inválida'; end if;
    pa:=(d->>'breakStart')::time;pb:=(d->>'breakEnd')::time;
    if pa<inicio or pb>fin or pb<=pa then raise exception 'La colación debe estar dentro de la jornada'; end if;
   end if;
  end if;
 end loop;
 select coalesce(nombre,usuario) into nombre_actor from public.usuarios where auth_user_id=auth.uid() and empresa=w.empresa limit 1;
 insert into public.obra_jornadas_historial(obra_id,empresa,desde,jornada,motivo,autor,actor)
 values(w.id,w.empresa,p_desde,p_jornada,btrim(p_motivo),coalesce(nombre_actor,'Usuario autorizado'),auth.uid()) returning id into v;
 select min(desde) into siguiente from public.obra_jornadas_historial where obra_id=w.id and empresa=w.empresa and desde>p_desde;
 for r in select id,jornada_aplicada,jornada_ordinaria_horas,horas_ordinarias,horas_extras_auto,jornada_version_id from public.asistencia_personal
  where obra_id=w.id and empresa=w.empresa and fecha_marcacion>=p_desde and (siguiente is null or fecha_marcacion<siguiente) order by id for update loop
  update public.asistencia_personal set jornada_aplicada=null where id=r.id returning jornada_aplicada,jornada_ordinaria_horas,horas_ordinarias,horas_extras_auto,jornada_version_id into after_row;
  insert into public.obra_jornada_recalculos values(v,r.id,to_jsonb(r)-'id',to_jsonb(after_row));n:=n+1;
 end loop;
 update public.obra_jornadas_historial set recalculados=n where id=v;
 update public.obras set jornadas_historial=private.jornada_historial_json(w.id) where id=w.id returning * into w;
 return jsonb_build_object('jornadas_historial',w.jornadas_historial,'recalculados',n);
end $$;
revoke all on function private.guardar_jornada_obra(integer,date,jsonb,text,bigint) from public,anon;
grant execute on function private.guardar_jornada_obra(integer,date,jsonb,text,bigint) to authenticated;
create function public.guardar_jornada_obra(p_obra integer,p_desde date,p_jornada jsonb,p_motivo text,p_revision bigint default 0) returns jsonb
language sql security invoker set search_path='' as $$ select private.guardar_jornada_obra(p_obra,p_desde,p_jornada,p_motivo,p_revision); $$;
revoke all on function public.guardar_jornada_obra(integer,date,jsonb,text,bigint) from public,anon;
grant execute on function public.guardar_jornada_obra(integer,date,jsonb,text,bigint) to authenticated;
comment on column public.asistencia_personal.jornada_aplicada is 'Horario aplicado según fecha de vigencia; los cambios autorizados recalculan solo su período y conservan auditoría.';
commit;
