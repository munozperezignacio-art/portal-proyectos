alter table public.maquinaria_decisiones_costo drop constraint maquinaria_decisiones_costo_tipo_check;
alter table public.maquinaria_decisiones_costo add constraint maquinaria_decisiones_costo_tipo_check check(tipo in ('confirmar','no_uso','retiro','restablecer'));
create table public.costos_control_historial (
 id bigint generated always as identity primary key,empresa text not null,tabla text not null,
 anterior jsonb,nuevo jsonb,usuario uuid,fecha timestamptz not null default now()
);
alter table public.costos_control_historial enable row level security;
revoke all on public.costos_control_historial from public,anon,authenticated;
grant select on public.costos_control_historial to authenticated;
grant all on public.costos_control_historial to service_role;
create policy historial_empresa on public.costos_control_historial for select to authenticated using(private.obraxis_actor_can_access_company(empresa));
create index costos_control_historial_empresa_fecha on public.costos_control_historial(empresa,fecha);
create or replace function private.auditar_costo_control() returns trigger language plpgsql security definer set search_path='' as $$
begin
 insert into public.costos_control_historial(empresa,tabla,anterior,nuevo,usuario)
 values(coalesce(new.empresa,old.empresa),TG_TABLE_NAME,case when TG_OP<>'INSERT' then to_jsonb(old) end,case when TG_OP<>'DELETE' then to_jsonb(new) end,auth.uid());
 if TG_OP='DELETE' then return old; end if;return new;
end $$;
revoke all on function private.auditar_costo_control() from public,anon,authenticated;
create trigger auditar_decisiones_costo after insert or update or delete on public.maquinaria_decisiones_costo for each row execute function private.auditar_costo_control();
create trigger auditar_costos_obra after insert or update or delete on public.costos_reales_obra for each row execute function private.auditar_costo_control();
create or replace function private.validar_fecha_costo_control() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.estado_costo='confirmado' and new.fecha_costo>(now() at time zone 'America/Santiago')::date then raise exception 'Un costo futuro debe registrarse como proyectado, no como incurrido confirmado'; end if;
 return new;
end $$;
revoke all on function private.validar_fecha_costo_control() from public,anon,authenticated;
create trigger validar_fecha_costo_control before insert or update on public.costos_reales_obra for each row execute function private.validar_fecha_costo_control();
