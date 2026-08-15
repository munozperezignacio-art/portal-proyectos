alter table public.mandante_contratos
  add column if not exists sincronizacion_automatica boolean not null default false,
  add column if not exists sincronizacion_frecuencia text not null default 'Diaria'
    check (sincronizacion_frecuencia in ('Cada hora','Diaria','Semanal')),
  add column if not exists ultima_sincronizacion_at timestamptz,
  add column if not exists proxima_sincronizacion_at timestamptz,
  add column if not exists sincronizacion_estado text,
  add column if not exists sincronizacion_error text;

do $$
begin
  if not exists (select 1 from vault.decrypted_secrets where name='mandante_cron_secret') then
    perform vault.create_secret(gen_random_uuid()::text, 'mandante_cron_secret', 'Autenticación del cron de integración contractual Obraxis');
  end if;
end $$;

create or replace function public.validar_cron_mandante(p_secret text)
returns boolean
language sql
stable
security definer
set search_path=public,vault
as $$
  select exists (
    select 1 from vault.decrypted_secrets
    where name='mandante_cron_secret'
      and decrypted_secret=p_secret
  );
$$;
revoke all on function public.validar_cron_mandante(text) from public, anon, authenticated;
grant execute on function public.validar_cron_mandante(text) to service_role;

create or replace function private.despachar_sincronizaciones_mandante()
returns void
language plpgsql
security definer
set search_path=public,private,vault,net
as $$
declare
  item record;
  cron_secret text;
begin
  select decrypted_secret into cron_secret from vault.decrypted_secrets where name='mandante_cron_secret';
  if cron_secret is null then return; end if;
  for item in
    select id from public.mandante_contratos
    where modalidad='Empresa Obraxis'
      and sincronizacion_automatica
      and estado not in ('Suspendido','Terminado','Archivado')
      and obra_contratista_id is not null
      and (proxima_sincronizacion_at is null or proxima_sincronizacion_at<=now())
    limit 100
  loop
    perform net.http_post(
      url:='https://wegphblwwcfidvdbdtdq.supabase.co/functions/v1/sincronizar-mandante',
      headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',cron_secret),
      body:=jsonb_build_object('contrato_id',item.id),
      timeout_milliseconds:=10000
    );
  end loop;
end;
$$;
revoke all on function private.despachar_sincronizaciones_mandante() from public, anon, authenticated;

select cron.schedule(
  'obraxis-sincronizacion-mandante',
  '*/15 * * * *',
  $$select private.despachar_sincronizaciones_mandante();$$
);

;
