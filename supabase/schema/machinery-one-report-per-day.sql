begin;
lock table public.maquinaria_uso_diario in share row exclusive mode;
-- Occupancy preserves historical duplicates without permitting new ones.
create table private.maquinaria_reporte_dia (
 empresa text not null,
 equipo_id text not null,
 fecha date not null,
 reportes bigint not null check(reportes>0),
 primary key(empresa,equipo_id,fecha)
);
alter table private.maquinaria_reporte_dia enable row level security;
revoke all on private.maquinaria_reporte_dia from public,anon,authenticated;
insert into private.maquinaria_reporte_dia
select empresa,equipo_id,fecha,count(*) from public.maquinaria_uso_diario
where empresa is not null and equipo_id is not null and fecha is not null
group by empresa,equipo_id,fecha;

create function private.maquinaria_un_reporte_diario() returns trigger
language plpgsql security definer set search_path='' as $$
declare reserved boolean;
begin
 if tg_op='UPDATE' then
  if (new.empresa,new.equipo_id,new.fecha) is not distinct from (old.empresa,old.equipo_id,old.fecha) then return new; end if;
 end if;
 if tg_op<>'DELETE' then
  if new.empresa is null or nullif(btrim(new.equipo_id),'') is null or new.fecha is null then
   raise exception 'El reporte requiere empresa, equipo y fecha.';
  end if;
  insert into private.maquinaria_reporte_dia values(new.empresa,new.equipo_id,new.fecha,1)
  on conflict do nothing returning true into reserved;
  if reserved is not true then
   raise exception 'Ya existe un reporte para este equipo el %. Solo se permite un reporte por equipo al día. Revisa el historial.',to_char(new.fecha,'DD/MM/YYYY');
  end if;
 end if;
 if tg_op<>'INSERT' and old.empresa is not null and old.equipo_id is not null and old.fecha is not null then
  -- Hold the existing key while releasing it, so deletion and replacement serialize.
  perform 1 from private.maquinaria_reporte_dia where empresa=old.empresa and equipo_id=old.equipo_id and fecha=old.fecha for update;
  delete from private.maquinaria_reporte_dia where empresa=old.empresa and equipo_id=old.equipo_id and fecha=old.fecha and reportes=1;
  if not found then
   update private.maquinaria_reporte_dia set reportes=reportes-1 where empresa=old.empresa and equipo_id=old.equipo_id and fecha=old.fecha;
  end if;
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end;$$;
revoke all on function private.maquinaria_un_reporte_diario() from public,anon,authenticated;
create trigger maquinaria_un_reporte_diario after insert or update or delete on public.maquinaria_uso_diario
for each row execute function private.maquinaria_un_reporte_diario();
commit;
