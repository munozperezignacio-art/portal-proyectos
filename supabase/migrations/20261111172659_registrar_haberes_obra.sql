create table public.rrhh_haberes_obra (
 empresa text not null, obra_id integer not null references public.obras(id),
 trabajador_id integer not null references public.maestro_personal(id),
 periodo text not null, referencia text not null, tipo text not null check(tipo in ('Imponible','No imponible')),
 concepto text not null check(length(trim(concepto)) between 1 and 120),
 clave text generated always as (lower(trim(concepto))) stored,
 monto integer not null check(monto>0), primary key(empresa,obra_id,trabajador_id,referencia,tipo,clave)
);
alter table public.rrhh_haberes_obra enable row level security;
revoke all on public.rrhh_haberes_obra from public,anon,authenticated;
grant select,insert,update on public.rrhh_haberes_obra to authenticated;
create policy lectura on public.rrhh_haberes_obra for select to authenticated using(private.rrhh_partidas_permiso(empresa,obra_id,'ver'));
create policy alta on public.rrhh_haberes_obra for insert to authenticated with check(private.rrhh_partidas_permiso(empresa,obra_id,'editar'));
create policy cambio on public.rrhh_haberes_obra for update to authenticated using(private.rrhh_partidas_permiso(empresa,obra_id,'editar')) with check(private.rrhh_partidas_permiso(empresa,obra_id,'editar'));
create function private.validar_haber_obra() returns trigger language plpgsql security invoker set search_path='' as $$
declare nom_estado text;
begin
 if new.periodo !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' or not(new.referencia=new.periodo or (new.referencia ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' and left(new.referencia,7)=new.periodo)) then raise exception 'Período no válido';end if;
 if length(new.referencia)=10 then perform new.referencia::date;end if;
 select estado into nom_estado from public.rrhh_nominas_mensuales where empresa=new.empresa and periodo=new.periodo for share;
 if nom_estado is not null and nom_estado<>'Borrador' then raise exception 'Esta nómina no está abierta';end if;
 if not exists(select 1 from public.maestro_personal m join public.obras o on o.id=new.obra_id and o.empresa=m.empresa where m.empresa=new.empresa and m.id=new.trabajador_id and (m.obra_nombre=o.nombre or m.centro_gestion_id=o.centro_gestion_id or exists(select 1 from public.rrhh_personal_centros_detalle a where a.empresa=o.empresa and a.trabajador_id=m.id and a.centro_gestion_id=o.centro_gestion_id))) then raise exception 'Trabajador no asignado a la obra';end if;
 return new;
end;$$;
create trigger validar_haber before insert or update on public.rrhh_haberes_obra for each row execute function private.validar_haber_obra();
notify pgrst,'reload schema';
