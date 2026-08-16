-- Despacho periódico del canal Push móvil. El secreto permanece en Vault.
do $$
declare existing_job record;
begin
  for existing_job in
    select jobid from cron.job where jobname = 'obraxis-despachar-notificaciones-moviles'
  loop
    perform cron.unschedule(existing_job.jobid);
  end loop;
end;
$$;

select cron.schedule(
  'obraxis-despachar-notificaciones-moviles', '* * * * *',
  $cron$
    select net.http_post(
      url := 'https://wegphblwwcfidvdbdtdq.supabase.co/functions/v1/despachar-notificaciones-moviles',
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
