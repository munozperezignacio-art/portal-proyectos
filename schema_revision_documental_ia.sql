-- Revisión documental asistida para Acreditaciones.
-- La IA entrega hallazgos; la decisión de acreditar permanece en una persona autorizada.

create table if not exists public.acreditaciones_revisiones_ia (
  id uuid primary key default gen_random_uuid(),
  empresa text not null,
  obra_nombre text,
  subcontratista_nombre text,
  subcontratista_rut text,
  categoria text not null check (categoria in ('empresa','personal','equipos','proveedor')),
  entidad_nombre text,
  documento_clave text not null,
  documento_nombre text not null,
  archivo_nombre text,
  archivo_hash text,
  resultado text not null check (resultado in ('Conforme','Observado','Requiere revisión')),
  confianza numeric(5,2),
  resumen text,
  datos_extraidos jsonb not null default '{}'::jsonb,
  hallazgos jsonb not null default '[]'::jsonb,
  campos_faltantes jsonb not null default '[]'::jsonb,
  recomendacion text,
  advertencia_legal text not null default 'Análisis documental asistido. No reemplaza la revisión ni la decisión de un profesional autorizado.',
  modelo text not null,
  tokens_total integer not null default 0,
  costo_usd numeric(12,6) not null default 0,
  ia_consumo_id uuid references public.ia_consumos(id) on delete set null,
  auth_user_id uuid references auth.users(id) on delete set null,
  revisado_por text,
  decision_humana text check (decision_humana is null or decision_humana in ('Aprobado','Observado','Rechazado')),
  decision_comentario text,
  decision_por text,
  decision_en timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists acreditaciones_revisiones_ia_empresa_fecha_idx on public.acreditaciones_revisiones_ia (empresa, created_at desc);
create index if not exists acreditaciones_revisiones_ia_documento_idx on public.acreditaciones_revisiones_ia (empresa, subcontratista_rut, documento_clave, created_at desc);
create index if not exists acreditaciones_revisiones_ia_auth_user_idx on public.acreditaciones_revisiones_ia (auth_user_id);
create index if not exists acreditaciones_revisiones_ia_consumo_idx on public.acreditaciones_revisiones_ia (ia_consumo_id);

alter table public.acreditaciones_revisiones_ia enable row level security;
revoke all on table public.acreditaciones_revisiones_ia from anon;
grant select, update on table public.acreditaciones_revisiones_ia to authenticated;

drop policy if exists acreditaciones_revisiones_ia_select on public.acreditaciones_revisiones_ia;
create policy acreditaciones_revisiones_ia_select on public.acreditaciones_revisiones_ia for select to authenticated
using (private.obraxis_actor_can_manage_company(empresa));

drop policy if exists acreditaciones_revisiones_ia_update on public.acreditaciones_revisiones_ia;
create policy acreditaciones_revisiones_ia_update on public.acreditaciones_revisiones_ia for update to authenticated
using (private.obraxis_actor_can_manage_company(empresa))
with check (private.obraxis_actor_can_manage_company(empresa));

-- La empresa administradora queda habilitada para probar la segunda etapa.
update public.ia_config_empresas
set funciones = jsonb_set(coalesce(funciones,'{}'::jsonb), '{revision_legal}', 'true'::jsonb, true), updated_at = now()
where lower(empresa) = 'obraxis';
