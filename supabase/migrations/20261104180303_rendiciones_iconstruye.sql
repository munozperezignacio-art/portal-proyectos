alter table public.costos_reales_obra add column importacion_clave text,add column importacion_datos jsonb;
create unique index costos_reales_importacion_unica on public.costos_reales_obra(empresa,importacion_clave) where importacion_clave is not null;
create table public.iconstruye_homologacion_gastos(
 empresa text not null,clave text not null,tipo_costo text not null,
 primary key(empresa,clave),check(length(clave) between 2 and 1000),
 check(tipo_costo in ('Materiales','Mano de Obra','Maquinaria & Equipos','Subcontratos','Alimentación','Alojamiento','Combustible','Traslado de equipos','Instalación de faenas','Elementos de protección personal','Costos financieros','Traslado de personal','Reparaciones','Gastos Generales / Varios'))
);
alter table public.iconstruye_homologacion_gastos enable row level security;
revoke all on public.iconstruye_homologacion_gastos from public,anon,authenticated;
grant select,insert,update on public.iconstruye_homologacion_gastos to authenticated;
create policy homologacion_lectura on public.iconstruye_homologacion_gastos for select to authenticated
 using(exists(select 1 from public.usuarios u where u.auth_user_id=(select auth.uid()) and u.empresa=iconstruye_homologacion_gastos.empresa));
create policy homologacion_insertar on public.iconstruye_homologacion_gastos for insert to authenticated
 with check(exists(select 1 from public.obras o where o.empresa=iconstruye_homologacion_gastos.empresa and private.rrhh_partidas_permiso(o.empresa,o.id,'editar')));
create policy homologacion_editar on public.iconstruye_homologacion_gastos for update to authenticated
 using(exists(select 1 from public.obras o where o.empresa=iconstruye_homologacion_gastos.empresa and private.rrhh_partidas_permiso(o.empresa,o.id,'editar')))
 with check(exists(select 1 from public.obras o where o.empresa=iconstruye_homologacion_gastos.empresa and private.rrhh_partidas_permiso(o.empresa,o.id,'editar')));
