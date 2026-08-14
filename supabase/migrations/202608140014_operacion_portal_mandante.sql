alter table public.mandante_contratos
  add column if not exists token_externo uuid not null default gen_random_uuid(),
  add column if not exists clave_externa_hash text,
  add column if not exists ultimo_acceso_externo timestamptz;

create unique index if not exists mandante_contratos_token_externo_idx
  on public.mandante_contratos (token_externo);

create table if not exists public.mandante_entregas (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.mandante_contratos(id) on delete restrict,
  empresa_mandante text not null,
  empresa_origen text not null,
  tipo text not null check (tipo in ('Avance','Programacion','Hito','Estado de pago','RDI','Libro de obra','Calidad','Prevencion','Documento','Acreditacion')),
  titulo text not null,
  periodo_desde date,
  periodo_hasta date,
  fecha_compromiso date,
  monto numeric not null default 0,
  datos jsonb not null default '{}'::jsonb,
  archivo_nombre text,
  archivo_url text,
  estado text not null default 'Recibido' check (estado in ('Borrador','Recibido','En revision','Observado','Reenviado','Aceptado','Rechazado')),
  observacion_mandante text,
  respuesta_contratista text,
  enviado_por text,
  revisado_por text,
  enviado_at timestamptz not null default now(),
  revisado_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.mandante_obligaciones (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.mandante_contratos(id) on delete restrict,
  empresa_mandante text not null,
  tipo text not null,
  nombre text not null,
  periodicidad text not null default 'Por evento',
  proxima_fecha date,
  responsable text,
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.mandante_acreditaciones (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.mandante_contratos(id) on delete restrict,
  empresa_mandante text not null,
  categoria text not null check (categoria in ('Empresa','Personal','Equipos')),
  estado text not null default 'Pendiente' check (estado in ('Pendiente','Incompleta','En revision','Observada','Aprobada','Rechazada','Vencida')),
  total_requeridos integer not null default 0,
  total_recibidos integer not null default 0,
  total_aprobados integer not null default 0,
  proximo_vencimiento date,
  observacion text,
  updated_at timestamptz not null default now(),
  unique (contrato_id, categoria)
);

create index if not exists mandante_entregas_contrato_estado_idx on public.mandante_entregas (contrato_id, estado, enviado_at desc);
create index if not exists mandante_obligaciones_contrato_fecha_idx on public.mandante_obligaciones (contrato_id, proxima_fecha) where activa;
create index if not exists mandante_acreditaciones_contrato_idx on public.mandante_acreditaciones (contrato_id, estado);

alter table public.mandante_entregas enable row level security;
alter table public.mandante_obligaciones enable row level security;
alter table public.mandante_acreditaciones enable row level security;

grant select, insert, update, delete on public.mandante_entregas, public.mandante_obligaciones, public.mandante_acreditaciones to authenticated;

create policy mandante_entregas_empresas on public.mandante_entregas for all to authenticated
using (exists (select 1 from public.mandante_contratos c where c.id=contrato_id and ((select private.usuario_puede_empresa(c.empresa_mandante)) or (c.empresa_obraxis_vinculada is not null and (select private.usuario_puede_empresa(c.empresa_obraxis_vinculada))))))
with check (exists (select 1 from public.mandante_contratos c where c.id=contrato_id and ((select private.usuario_puede_empresa(c.empresa_mandante)) or (c.empresa_obraxis_vinculada is not null and (select private.usuario_puede_empresa(c.empresa_obraxis_vinculada))))));

create policy mandante_obligaciones_empresas on public.mandante_obligaciones for select to authenticated
using (exists (select 1 from public.mandante_contratos c where c.id=contrato_id and ((select private.usuario_puede_empresa(c.empresa_mandante)) or (c.empresa_obraxis_vinculada is not null and (select private.usuario_puede_empresa(c.empresa_obraxis_vinculada))))));
create policy mandante_obligaciones_mandante on public.mandante_obligaciones for all to authenticated
using ((select private.usuario_puede_empresa(empresa_mandante))) with check ((select private.usuario_puede_empresa(empresa_mandante)));

create policy mandante_acreditaciones_empresas on public.mandante_acreditaciones for select to authenticated
using (exists (select 1 from public.mandante_contratos c where c.id=contrato_id and ((select private.usuario_puede_empresa(c.empresa_mandante)) or (c.empresa_obraxis_vinculada is not null and (select private.usuario_puede_empresa(c.empresa_obraxis_vinculada))))));
create policy mandante_acreditaciones_mandante on public.mandante_acreditaciones for all to authenticated
using ((select private.usuario_puede_empresa(empresa_mandante))) with check ((select private.usuario_puede_empresa(empresa_mandante)));

drop policy if exists mandante_contratos_empresa on public.mandante_contratos;
create policy mandante_contratos_empresas on public.mandante_contratos for select to authenticated
using ((select private.usuario_puede_empresa(empresa_mandante)) or (empresa_obraxis_vinculada is not null and (select private.usuario_puede_empresa(empresa_obraxis_vinculada))));
create policy mandante_contratos_mandante_insert on public.mandante_contratos for insert to authenticated with check ((select private.usuario_puede_empresa(empresa_mandante)));
create policy mandante_contratos_mandante_update on public.mandante_contratos for update to authenticated using ((select private.usuario_puede_empresa(empresa_mandante))) with check ((select private.usuario_puede_empresa(empresa_mandante)));
create policy mandante_contratos_mandante_delete on public.mandante_contratos for delete to authenticated using ((select private.usuario_puede_empresa(empresa_mandante)));
