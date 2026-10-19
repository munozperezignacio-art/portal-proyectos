-- Indicadores públicos compartidos (no contienen datos de empresas ni usuarios).
create table public.indicadores_economicos_cache (
  moneda text not null check(moneda in ('UF','USD','UTM')),
  fecha date not null,
  valor numeric not null check(valor>0 and valor<10000000),
  fuente text not null check(fuente in ('mindicador.cl','indicadores.cl')),
  consultado_en timestamptz not null default now(),
  primary key(moneda,fecha)
);
alter table public.indicadores_economicos_cache enable row level security;
revoke all on public.indicadores_economicos_cache from public,anon,authenticated;
grant select on public.indicadores_economicos_cache to authenticated;
grant all on public.indicadores_economicos_cache to service_role;
create policy indicadores_publicados_lectura on public.indicadores_economicos_cache for select to authenticated using(true);
comment on table public.indicadores_economicos_cache is 'Cotizaciones públicas verificadas. Solo el proceso servidor puede escribir; ningún usuario puede modificar el indicador compartido.';

create function private.actualizar_indicadores_economicos_cron()
returns bigint language sql security invoker set search_path='' as $$
  select net.http_post(
    url:='https://wegphblwwcfidvdbdtdq.supabase.co/functions/v1/indicadores-economicos',
    headers:=jsonb_build_object('Content-Type','application/json','x-cron-secret',
      (select decrypted_secret from vault.decrypted_secrets where name='obraxis_cron_secret')),
    body:='{}'::jsonb,timeout_milliseconds:=55000);
$$;
revoke all on function private.actualizar_indicadores_economicos_cron() from public,anon,authenticated;
select cron.schedule('obraxis-indicadores-economicos','15 * * * *','select private.actualizar_indicadores_economicos_cron();');
notify pgrst,'reload schema';
