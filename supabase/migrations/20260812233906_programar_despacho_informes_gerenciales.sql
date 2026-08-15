
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net with schema extensions;

do $$
declare existing_job bigint;
begin
  select jobid into existing_job
  from cron.job
  where jobname = 'obraxis-despachar-informes'
  limit 1;
  if existing_job is not null then
    perform cron.unschedule(existing_job);
  end if;
end $$;

select cron.schedule(
  'obraxis-despachar-informes',
  '*/15 * * * *',
  $cron$
  select net.http_post(
    url := 'https://wegphblwwcfidvdbdtdq.supabase.co/functions/v1/despachar-informes',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndlZ3BoYmx3d2NmaWR2ZGJkdGRxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQwNDk4MTQsImV4cCI6MjA5OTYyNTgxNH0.TnJj36SxATzj-_rxPCHdWO_EA3yWAxPHxKHS81P2csg'
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  $cron$
);
;
