alter table public.obras add column margen_presupuestado_pct numeric;
alter table public.obras add constraint obras_margen_valido check (margen_presupuestado_pct >= 0 and margen_presupuestado_pct < 100);
comment on column public.obras.margen_presupuestado_pct is 'Margen objetivo sobre venta neta (%). NULL indica pendiente; cero es explícito. No es un gasto.';
create function private.proteger_margen_obra() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if (TG_OP='INSERT' and new.margen_presupuestado_pct is not null) or
    (TG_OP='UPDATE' and new.margen_presupuestado_pct is distinct from old.margen_presupuestado_pct) then
  if auth.uid() is null or not coalesce(private.obraxis_actor_can_access_company(new.empresa) and private.obraxis_permission(new.empresa,'obras.gestion.configurar') and private.rrhh_partidas_permiso(new.empresa,new.id,'ver'),false) then
   raise exception 'Sin permiso para configurar el margen de esta obra' using errcode='42501';
  end if;
 end if;
 return new;
end $$;
revoke all on function private.proteger_margen_obra() from public,anon,authenticated;
create trigger proteger_margen_obra before insert or update on public.obras for each row execute function private.proteger_margen_obra();
