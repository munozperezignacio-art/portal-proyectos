create table if not exists public.mandante_informes_config (
 id uuid primary key default gen_random_uuid(), contrato_id uuid not null unique references public.mandante_contratos(id) on delete cascade,
 empresa_mandante text not null, activo boolean not null default false, frecuencia text not null default 'Semanal' check (frecuencia in ('Semanal','Mensual')),
 dia_semana smallint not null default 1 check (dia_semana between 1 and 7), dia_mes smallint not null default 1 check (dia_mes between 1 and 28),
 hora time not null default '08:00', destinatarios text[] not null default '{}', ultima_ejecucion_at timestamptz, proxima_ejecucion_at timestamptz,
 ultimo_estado text, ultimo_error text, creado_por text, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.mandante_informes_historial (
 id uuid primary key default gen_random_uuid(), contrato_id uuid not null references public.mandante_contratos(id) on delete cascade,
 config_id uuid references public.mandante_informes_config(id) on delete set null, empresa_mandante text not null, periodo text not null,
 resumen jsonb not null default '{}'::jsonb, html text not null, destinatarios text[] not null default '{}', estado text not null default 'Generado',
 error text, generado_por text, generado_at timestamptz not null default now(), enviado_at timestamptz
);
create table if not exists public.acreditaciones_resumen_obra (
 id uuid primary key default gen_random_uuid(), empresa text not null, obra_id integer, obra_nombre text not null,
 categoria text not null check (categoria in ('Empresa','Personal','Equipos')), total_requeridos integer not null default 0 check (total_requeridos >= 0),
 total_recibidos integer not null default 0 check (total_recibidos >= 0), total_aprobados integer not null default 0 check (total_aprobados >= 0),
 proximo_vencimiento date, estado text not null default 'Pendiente', observacion text, updated_at timestamptz not null default now(),
 unique (empresa,obra_nombre,categoria)
);
create index if not exists mandante_informes_config_due_idx on public.mandante_informes_config(activo,proxima_ejecucion_at);
create index if not exists mandante_informes_historial_contract_idx on public.mandante_informes_historial(contrato_id,generado_at desc);
create index if not exists acreditaciones_resumen_obra_lookup_idx on public.acreditaciones_resumen_obra(empresa,obra_nombre);
alter table public.mandante_informes_config enable row level security; alter table public.mandante_informes_historial enable row level security; alter table public.acreditaciones_resumen_obra enable row level security;
drop policy if exists mandante_informes_config_select on public.mandante_informes_config;
create policy mandante_informes_config_select on public.mandante_informes_config for select to authenticated using (exists(select 1 from public.mandante_contratos c join public.usuarios u on u.auth_user_id=(select auth.uid()) where c.id=contrato_id and u.empresa in(c.empresa_mandante,c.empresa_obraxis_vinculada)));
drop policy if exists mandante_informes_config_manage on public.mandante_informes_config;
create policy mandante_informes_config_manage on public.mandante_informes_config for all to authenticated using (exists(select 1 from public.usuarios u where u.auth_user_id=(select auth.uid()) and u.empresa=empresa_mandante)) with check (exists(select 1 from public.usuarios u where u.auth_user_id=(select auth.uid()) and u.empresa=empresa_mandante));
drop policy if exists mandante_informes_historial_select on public.mandante_informes_historial;
create policy mandante_informes_historial_select on public.mandante_informes_historial for select to authenticated using (exists(select 1 from public.mandante_contratos c join public.usuarios u on u.auth_user_id=(select auth.uid()) where c.id=contrato_id and u.empresa in(c.empresa_mandante,c.empresa_obraxis_vinculada)));
drop policy if exists acreditaciones_resumen_obra_select on public.acreditaciones_resumen_obra;
create policy acreditaciones_resumen_obra_select on public.acreditaciones_resumen_obra for select to authenticated using (exists(select 1 from public.usuarios u where u.auth_user_id=(select auth.uid()) and u.empresa=empresa));
drop policy if exists acreditaciones_resumen_obra_manage on public.acreditaciones_resumen_obra;
create policy acreditaciones_resumen_obra_manage on public.acreditaciones_resumen_obra for all to authenticated using (exists(select 1 from public.usuarios u where u.auth_user_id=(select auth.uid()) and u.empresa=empresa)) with check (exists(select 1 from public.usuarios u where u.auth_user_id=(select auth.uid()) and u.empresa=empresa));
grant select,insert,update,delete on public.mandante_informes_config to authenticated; grant select on public.mandante_informes_historial to authenticated; grant select,insert,update,delete on public.acreditaciones_resumen_obra to authenticated;;
