-- Work-local references: no budget link and no report/price rewrites.
alter table public.partidas_obra add column if not exists avance_depende_de integer references public.partidas_obra(id) on delete restrict;
alter table public.partidas_obra add column if not exists avance_referencia_propia boolean not null default false;
create index if not exists partidas_obra_avance_reference_idx on public.partidas_obra(avance_depende_de) where avance_depende_de is not null;

create or replace function private.work_progress_source(p public.partidas_obra) returns integer
language sql stable security definer set search_path='' as $$
 select case when p.avance_referencia_propia then p.avance_depende_de else
 (select case when count(*)=1 then min(s.id) end from public.presupuestos_items b
 join public.partidas_obra s on s.empresa=p.empresa and s.obra_id is not distinct from p.obra_id and s.obra_nombre=p.obra_nombre
 and private.work_budget_item(s)=b.avance_depende_de
 where b.id=private.work_budget_item(p)) end
$$;
revoke all on function private.work_progress_source(public.partidas_obra) from public,anon,authenticated;

create or replace function private.validate_work_progress_reference() returns trigger
language plpgsql security definer set search_path='' as $$
declare source public.partidas_obra; cursor_id integer; seen integer[]; old_source integer;
begin
 perform pg_advisory_xact_lock(76422,0);
 cursor_id:=private.work_progress_source(new);
 if cursor_id is not null then
  if coalesce(new.es_titulo,false) or new.unidad in ('TITULO','GRUPO') or coalesce(new.cantidad_presupuestada,0)<=0 then raise exception 'La partida dependiente debe tener cantidad positiva';end if;
  seen:=array[new.id];
  while cursor_id is not null loop
   if cursor_id=any(seen) then raise exception 'No se permiten dependencias circulares';end if;
   seen:=array_append(seen,cursor_id);
   select * into source from public.partidas_obra where id=cursor_id;
   if source.id is null or source.empresa is distinct from new.empresa or source.obra_id is distinct from new.obra_id or source.obra_nombre is distinct from new.obra_nombre then raise exception 'La referencia debe pertenecer a la misma obra y empresa';end if;
   if coalesce(source.es_titulo,false) or source.unidad in ('TITULO','GRUPO') or coalesce(source.cantidad_presupuestada,0)<=0 then raise exception 'La referencia debe ser una partida con cantidad positiva';end if;
   cursor_id:=private.work_progress_source(source);
  end loop;
 end if;
 if tg_op='UPDATE' then
  old_source:=private.work_progress_source(old);
  if old_source is distinct from private.work_progress_source(new) and exists(select 1 from public.avances_produccion_partidas a where a.empresa=old.empresa and a.obra_id=old.obra_id and (a.partida_id=old.id or (a.partida_id is null and lower(trim(a.partida))=lower(trim(old.partida))))) then
   raise exception 'La partida tiene avances propios. Se conserva su historial; no se puede cambiar la referencia';
  end if;
  if (new.empresa is distinct from old.empresa or new.obra_id is distinct from old.obra_id or new.obra_nombre is distinct from old.obra_nombre or coalesce(new.cantidad_presupuestada,0)<=0 or coalesce(new.es_titulo,false) or new.unidad in ('TITULO','GRUPO')) and exists(select 1 from public.partidas_obra p where private.work_progress_source(p)=old.id) then
   raise exception 'Esta partida es referencia de otras; conserva obra y cantidad positiva';
  end if;
 end if;
 return new;
end $$;
revoke all on function private.validate_work_progress_reference() from public,anon,authenticated;
drop trigger if exists work_progress_reference on public.partidas_obra;
create trigger work_progress_reference before insert or update on public.partidas_obra for each row execute function private.validate_work_progress_reference();

-- Keep the existing budget guard; explicit work-local choices take precedence.
create or replace function private.prevent_dependent_manual_progress() returns trigger
language plpgsql security definer set search_path='' as $$
declare budget_id integer;
begin
 perform pg_advisory_xact_lock(76422,0);
 for budget_id in select distinct b.presupuesto_id from public.partidas_obra p join public.presupuestos_items b on b.id=private.work_budget_item(p) where p.obra_id=new.obra_id and p.empresa=new.empresa and (p.id=new.partida_id or (new.partida_id is null and lower(trim(p.partida))=lower(trim(new.partida)))) order by b.presupuesto_id loop
  perform pg_advisory_xact_lock(76421,budget_id);
 end loop;
 if exists(select 1 from public.partidas_obra p where p.obra_id=new.obra_id and p.empresa=new.empresa and (p.id=new.partida_id or (new.partida_id is null and lower(trim(p.partida))=lower(trim(new.partida)))) and private.work_progress_source(p) is not null) then
  raise exception 'Esta partida avanza automáticamente según su referencia; registra el avance en la partida de origen';
 end if;
 return new;
end $$;
