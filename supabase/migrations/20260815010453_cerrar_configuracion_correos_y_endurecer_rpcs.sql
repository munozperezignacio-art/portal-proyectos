alter table public.config_empresa
  add column if not exists email_notificaciones text,
  add column if not exists email_notificaciones_cc text,
  add column if not exists notificaciones_automaticas boolean not null default true,
  add column if not exists correos_contextuales jsonb not null default '{}'::jsonb;

comment on column public.config_empresa.correos_contextuales is
  'Destinatarios por módulo y alcance. Fuente persistente; no usar localStorage para operación.';

alter function public.aprobar_ep_subcontrato_y_cargar_costo(bigint, text)
  set search_path = pg_catalog, public, pg_temp;
alter function public.revisar_documento_ep_subcontrato(bigint, text, text)
  set search_path = pg_catalog, public, pg_temp;
alter function public.registrar_error_cliente(text, text, jsonb)
  set search_path = pg_catalog, public, pg_temp;

comment on function public.aprobar_ep_subcontrato_y_cargar_costo(bigint, text) is
  'RPC SECURITY DEFINER intencional para usuarios autenticados; valida sesión, empresa y permisos antes de aprobar.';
comment on function public.revisar_documento_ep_subcontrato(bigint, text, text) is
  'RPC SECURITY DEFINER intencional para usuarios autenticados; valida sesión, empresa, estado y permisos antes de revisar.';
comment on function public.registrar_error_cliente(text, text, jsonb) is
  'RPC SECURITY DEFINER intencional de observabilidad; exige usuario activo, aplica límite de frecuencia y sanea el contenido.';
