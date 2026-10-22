create table public.obra_costos_proyectados (
 id text primary key default gen_random_uuid()::text,
 empresa text not null,
 obra_id integer not null references public.obras(id),
 partida_id integer,
 partida text not null,
 nombre_item text not null,
 tipo_proyeccion text not null check (tipo_proyeccion in ('TIEMPO','INSUMO')),
 periodicidad text not null default 'Día' check (periodicidad in ('Día','Mes')),
 tarifa_tiempo_dia numeric not null default 0 check(tarifa_tiempo_dia>=0),
 unidad_insumo text,
 tasa_rendimiento_insumo numeric not null default 1 check(tasa_rendimiento_insumo>=0),
 precio_unitario_insumo numeric not null default 0 check(precio_unitario_insumo>=0),
 created_at timestamptz not null default now()
);
create index obra_costos_proyectados_scope_idx on public.obra_costos_proyectados(empresa,obra_id);
alter table public.obra_costos_proyectados enable row level security;
revoke all on public.obra_costos_proyectados from anon,authenticated;
grant select,insert,update,delete on public.obra_costos_proyectados to authenticated;
create policy costos_proyectados_empresa on public.obra_costos_proyectados for all to authenticated
using (exists(select 1 from public.usuarios u where u.auth_user_id=(select auth.uid()) and (u.empresa=obra_costos_proyectados.empresa or lower(u.empresa)='obraxis')))
with check (exists(select 1 from public.usuarios u where u.auth_user_id=(select auth.uid()) and (u.empresa=obra_costos_proyectados.empresa or lower(u.empresa)='obraxis')) and exists(select 1 from public.obras o where o.id=obra_costos_proyectados.obra_id and o.empresa=obra_costos_proyectados.empresa));
