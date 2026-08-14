create extension if not exists pgcrypto with schema extensions;

do $$
begin
  if not exists (
    select 1
    from vault.decrypted_secrets
    where name = 'obraxis_cron_secret'
  ) then
    perform vault.create_secret(
      encode(extensions.gen_random_bytes(32), 'hex'),
      'obraxis_cron_secret',
      'Secreto interno para autenticar tareas Cron de Obraxis'
    );
  end if;
end;
$$;

create or replace function public.verify_internal_cron_secret(p_secret text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    nullif(p_secret, '') is not null
    and extensions.digest(p_secret, 'sha256') = extensions.digest(secret.decrypted_secret, 'sha256')
  from vault.decrypted_secrets secret
  where secret.name = 'obraxis_cron_secret'
  limit 1;
$$;

revoke all on function public.verify_internal_cron_secret(text) from public, anon, authenticated;
grant execute on function public.verify_internal_cron_secret(text) to service_role;

do $$
declare
  existing_job record;
begin
  for existing_job in
    select jobid
    from cron.job
    where jobname in ('obraxis-despachar-informes', 'obraxis-detectar-reportes-pendientes')
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;
end;
$$;

select cron.schedule(
  'obraxis-despachar-informes',
  '*/15 * * * *',
  $cron$
    select net.http_post(
      url := 'https://wegphblwwcfidvdbdtdq.supabase.co/functions/v1/despachar-informes',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer sb_publishable_LKC9XEmI711b7nm7rVPalQ_FxZPKis2',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'obraxis_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $cron$
);

select cron.schedule(
  'obraxis-detectar-reportes-pendientes',
  '*/15 * * * *',
  $cron$
    select net.http_post(
      url := 'https://wegphblwwcfidvdbdtdq.supabase.co/functions/v1/detectar-reportes-pendientes',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer sb_publishable_LKC9XEmI711b7nm7rVPalQ_FxZPKis2',
        'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'obraxis_cron_secret')
      ),
      body := '{}'::jsonb,
      timeout_milliseconds := 30000
    );
  $cron$
);
