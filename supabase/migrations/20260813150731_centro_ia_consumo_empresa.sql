-- Gobierno, presupuesto y auditoría del consumo de IA por empresa.
-- Los secretos del proveedor permanecen exclusivamente en Edge Function Secrets.

create table if not exists public.ia_config_empresas (
  empresa text primary key,
  habilitada boolean not null default true,
  presupuesto_mensual_usd numeric(12,2) not null default 10 check (presupuesto_mensual_usd >= 0),
  bloquear_al_limite boolean not null default true,
  alerta_porcentaje smallint not null default 80 check (alerta_porcentaje between 1 and 100),
  modelo text not null default 'gpt-4.1-mini',
  funciones jsonb not null default '{"lectura_documental":true,"informes":false,"copiloto":false,"revision_legal":false}'::jsonb,
  actualizado_por text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.ia_consumos (
  id uuid primary key default gen_random_uuid(), empresa text not null, obra_nombre text,
  auth_user_id uuid references auth.users(id) on delete set null, usuario text,
  funcion text not null, modelo text not null,
  estado text not null default 'Reservado' check (estado in ('Reservado','Completado','Error','Bloqueado')),
  tokens_entrada integer not null default 0 check (tokens_entrada >= 0),
  tokens_salida integer not null default 0 check (tokens_salida >= 0),
  tokens_total integer not null default 0 check (tokens_total >= 0),
  costo_usd numeric(12,6) not null default 0 check (costo_usd >= 0),
  confianza numeric(5,2), duracion_ms integer, error_detalle text,
  metadatos jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), completed_at timestamptz
);
create index if not exists ia_consumos_empresa_fecha_idx on public.ia_consumos (empresa, created_at desc);
create index if not exists ia_consumos_funcion_fecha_idx on public.ia_consumos (funcion, created_at desc);

alter table public.ia_config_empresas enable row level security;
alter table public.ia_consumos enable row level security;
revoke all on table public.ia_config_empresas, public.ia_consumos from anon;
grant select, insert, update on table public.ia_config_empresas to authenticated;
grant select on table public.ia_consumos to authenticated;

drop policy if exists ia_config_empresas_select on public.ia_config_empresas;
create policy ia_config_empresas_select on public.ia_config_empresas for select to authenticated using (private.obraxis_actor_can_manage_company(empresa));
drop policy if exists ia_config_empresas_insert on public.ia_config_empresas;
create policy ia_config_empresas_insert on public.ia_config_empresas for insert to authenticated with check (private.obraxis_actor_can_manage_company(empresa));
drop policy if exists ia_config_empresas_update on public.ia_config_empresas;
create policy ia_config_empresas_update on public.ia_config_empresas for update to authenticated using (private.obraxis_actor_can_manage_company(empresa)) with check (private.obraxis_actor_can_manage_company(empresa));
drop policy if exists ia_consumos_select on public.ia_consumos;
create policy ia_consumos_select on public.ia_consumos for select to authenticated using (private.obraxis_actor_can_manage_company(empresa));

insert into public.ia_config_empresas (empresa)
select distinct empresa from public.config_empresa where nullif(trim(empresa), '') is not null
on conflict (empresa) do nothing;

create or replace function public.ia_reservar_consumo(p_empresa text,p_obra_nombre text,p_auth_user_id uuid,p_usuario text,p_funcion text,p_modelo text,p_reserva_usd numeric default 0.02)
returns uuid language plpgsql security invoker set search_path=public as $$
declare v_config public.ia_config_empresas%rowtype; v_consumido numeric(12,6); v_id uuid;
begin
  perform pg_advisory_xact_lock(hashtext(lower(trim(p_empresa))));
  insert into public.ia_config_empresas (empresa) values (p_empresa) on conflict (empresa) do nothing;
  select * into v_config from public.ia_config_empresas where empresa=p_empresa for update;
  if not v_config.habilitada then raise exception 'La inteligencia artificial está deshabilitada para esta empresa.' using errcode='P0001'; end if;
  if coalesce((v_config.funciones->>p_funcion)::boolean,false) is false then raise exception 'Esta función de inteligencia artificial no está habilitada para la empresa.' using errcode='P0001'; end if;
  select coalesce(sum(costo_usd),0) into v_consumido from public.ia_consumos where empresa=p_empresa and created_at>=date_trunc('month',now()) and estado in ('Reservado','Completado');
  if v_config.bloquear_al_limite and v_config.presupuesto_mensual_usd>0 and v_consumido+greatest(p_reserva_usd,0)>v_config.presupuesto_mensual_usd then raise exception 'Se alcanzó el presupuesto mensual de IA de la empresa.' using errcode='P0001'; end if;
  insert into public.ia_consumos(empresa,obra_nombre,auth_user_id,usuario,funcion,modelo,estado,costo_usd) values(p_empresa,nullif(p_obra_nombre,''),p_auth_user_id,p_usuario,p_funcion,p_modelo,'Reservado',greatest(p_reserva_usd,0)) returning id into v_id;
  return v_id;
end $$;

create or replace function public.ia_finalizar_consumo(p_id uuid,p_estado text,p_tokens_entrada integer,p_tokens_salida integer,p_costo_usd numeric,p_confianza numeric,p_duracion_ms integer,p_error_detalle text,p_metadatos jsonb default '{}'::jsonb)
returns void language sql security invoker set search_path=public as $$
 update public.ia_consumos set estado=case when p_estado in ('Completado','Error','Bloqueado') then p_estado else 'Error' end,tokens_entrada=greatest(coalesce(p_tokens_entrada,0),0),tokens_salida=greatest(coalesce(p_tokens_salida,0),0),tokens_total=greatest(coalesce(p_tokens_entrada,0),0)+greatest(coalesce(p_tokens_salida,0),0),costo_usd=greatest(coalesce(p_costo_usd,0),0),confianza=p_confianza,duracion_ms=p_duracion_ms,error_detalle=nullif(p_error_detalle,''),metadatos=coalesce(p_metadatos,'{}'::jsonb),completed_at=now() where id=p_id;
$$;
revoke all on function public.ia_reservar_consumo(text,text,uuid,text,text,text,numeric) from public,anon,authenticated;
revoke all on function public.ia_finalizar_consumo(uuid,text,integer,integer,numeric,numeric,integer,text,jsonb) from public,anon,authenticated;
grant execute on function public.ia_reservar_consumo(text,text,uuid,text,text,text,numeric) to service_role;
grant execute on function public.ia_finalizar_consumo(uuid,text,integer,integer,numeric,numeric,integer,text,jsonb) to service_role;

;
