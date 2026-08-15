create or replace function private.despachar_informes_mandante()
returns void language plpgsql security definer set search_path=public,private,vault,net as $$
declare item record; cron_secret text;
begin
 select decrypted_secret into cron_secret from vault.decrypted_secrets where name='mandante_cron_secret';
 if cron_secret is null then return; end if;
 for item in select id from public.mandante_informes_config where activo and cardinality(destinatarios)>0 and coalesce(proxima_ejecucion_at,now())<=now() limit 100 loop
  perform net.http_post(url:='https://wegphblwwcfidvdbdtdq.supabase.co/functions/v1/informes-mandante',
   headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',cron_secret),
   body:=jsonb_build_object('config_id',item.id,'enviar',true),timeout_milliseconds:=15000);
 end loop;
end $$;
revoke all on function private.despachar_informes_mandante() from public,anon,authenticated;
do $$ begin if exists(select 1 from cron.job where jobname='obraxis-informes-mandante') then perform cron.unschedule('obraxis-informes-mandante'); end if; end $$;
select cron.schedule('obraxis-informes-mandante','0 * * * *',$$select private.despachar_informes_mandante();$$);;
