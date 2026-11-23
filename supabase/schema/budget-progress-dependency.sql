-- No reports or prices are rewritten. Null preserves the current independent mode.
alter table public.presupuestos_items add column if not exists avance_depende_de integer references public.presupuestos_items(id) on delete restrict;
create index if not exists presupuestos_items_avance_reference_idx on public.presupuestos_items(avance_depende_de) where avance_depende_de is not null;
create or replace function private.work_budget_item(p public.partidas_obra) returns integer language sql stable security definer set search_path='' as $$
 select coalesce(p.presupuesto_item_id,(select case when count(*)=1 then min(b.id) end from public.presupuestos_items b join public.obra_presupuestos r on r.presupuesto_id=b.presupuesto_id where r.empresa=p.empresa and r.obra_nombre=p.obra_nombre and lower(trim(b.partida))=lower(trim(p.partida))))
$$;
revoke all on function private.work_budget_item(public.partidas_obra) from public,anon,authenticated;
create or replace function private.validate_budget_progress_dependency() returns trigger
language plpgsql security definer set search_path='' as $$
declare source public.presupuestos_items; seen integer[]; cursor_id integer;
begin
 perform pg_advisory_xact_lock(76421,coalesce(new.presupuesto_id,old.presupuesto_id));
 if new.avance_depende_de is not null then
  select * into source from public.presupuestos_items where id=new.avance_depende_de;
  if source.id is null or source.presupuesto_id<>new.presupuesto_id then raise exception 'La referencia debe pertenecer al mismo presupuesto';end if;
  if coalesce(new.es_titulo,false) or coalesce(source.es_titulo,false) or coalesce(new.tipo_item,'PARTIDA')<>'PARTIDA' or coalesce(source.tipo_item,'PARTIDA')<>'PARTIDA' then raise exception 'Solo las partidas pueden depender de otras partidas';end if;
  if coalesce(source.cantidad,0)<=0 or coalesce(new.cantidad,0)<=0 then raise exception 'Ambas partidas deben tener cantidades positivas';end if;
  seen:=array[new.id];cursor_id:=new.avance_depende_de;
  while cursor_id is not null loop
   if cursor_id=any(seen) then raise exception 'No se permiten dependencias circulares';end if;
   seen:=array_append(seen,cursor_id);
   select avance_depende_de into cursor_id from public.presupuestos_items where id=cursor_id;
  end loop;
 end if;
 if tg_op='UPDATE' and new.avance_depende_de is distinct from old.avance_depende_de then
  if exists(select 1 from public.partidas_obra p join public.avances_produccion_partidas a on a.obra_id=p.obra_id and a.empresa=p.empresa and (a.partida_id=p.id or (a.partida_id is null and lower(trim(a.partida))=lower(trim(p.partida)))) where private.work_budget_item(p)=new.id) then raise exception 'La partida tiene avances propios. Se conserva su historial; no se puede cambiar a avance dependiente';end if;
 end if;
 if (coalesce(new.cantidad,0)<=0 or coalesce(new.es_titulo,false) or coalesce(new.tipo_item,'PARTIDA')<>'PARTIDA' or new.presupuesto_id is distinct from old.presupuesto_id) and exists(select 1 from public.presupuestos_items where avance_depende_de=new.id) then raise exception 'Esta partida es referencia de otras; conserva presupuesto y cantidad positiva';end if;
 return new;
end $$;
revoke all on function private.validate_budget_progress_dependency() from public,anon,authenticated;
drop trigger if exists budget_progress_dependency on public.presupuestos_items;
create trigger budget_progress_dependency before insert or update on public.presupuestos_items for each row execute function private.validate_budget_progress_dependency();

create or replace function private.prevent_dependent_manual_progress() returns trigger
language plpgsql security definer set search_path='' as $$
declare budget_id integer;
begin
 for budget_id in select distinct b.presupuesto_id from public.partidas_obra p join public.presupuestos_items b on b.id=private.work_budget_item(p) where p.obra_id=new.obra_id and p.empresa=new.empresa and (p.id=new.partida_id or (new.partida_id is null and lower(trim(p.partida))=lower(trim(new.partida)))) order by b.presupuesto_id loop
  perform pg_advisory_xact_lock(76421,budget_id);
 end loop;
 if exists(select 1 from public.partidas_obra p join public.presupuestos_items b on b.id=private.work_budget_item(p) where p.obra_id=new.obra_id and p.empresa=new.empresa and (p.id=new.partida_id or (new.partida_id is null and lower(trim(p.partida))=lower(trim(new.partida)))) and b.avance_depende_de is not null) then raise exception 'Esta partida avanza automáticamente según su referencia; registra el avance en la partida de origen';end if;
 return new;
end $$;
revoke all on function private.prevent_dependent_manual_progress() from public,anon,authenticated;
drop trigger if exists dependent_manual_progress on public.avances_produccion_partidas;
create trigger dependent_manual_progress before insert or update on public.avances_produccion_partidas for each row execute function private.prevent_dependent_manual_progress();
