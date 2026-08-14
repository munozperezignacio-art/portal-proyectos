-- La credencial de Resend vive exclusivamente en Supabase Secrets.
-- Ningun cliente ni tabla publica conserva una copia de la clave.
alter table if exists public.config_empresa
  drop column if exists email_api_key;
