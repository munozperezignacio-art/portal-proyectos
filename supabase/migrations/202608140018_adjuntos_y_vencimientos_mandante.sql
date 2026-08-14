insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'mandante-contractual',
  'mandante-contractual',
  false,
  20971520,
  array['application/pdf','image/jpeg','image/png','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','application/vnd.ms-excel','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.mandante_adjuntos (
  id uuid primary key default gen_random_uuid(),
  contrato_id uuid not null references public.mandante_contratos(id) on delete restrict,
  entrega_id uuid references public.mandante_entregas(id) on delete restrict,
  empresa_mandante text not null,
  storage_path text not null unique,
  nombre_archivo text not null,
  mime_type text,
  tamano_bytes bigint not null default 0 check (tamano_bytes between 0 and 20971520),
  estado text not null default 'Pendiente' check (estado in ('Pendiente','Adjunto','Eliminado')),
  subido_por text,
  created_at timestamptz not null default now()
);

alter table public.mandante_adjuntos enable row level security;
grant select, insert, update on public.mandante_adjuntos to authenticated;

create policy mandante_adjuntos_empresas on public.mandante_adjuntos
for select to authenticated
using (exists (
  select 1 from public.mandante_contratos c
  where c.id = contrato_id and (
    (select private.usuario_puede_empresa(c.empresa_mandante))
    or (c.empresa_obraxis_vinculada is not null and (select private.usuario_puede_empresa(c.empresa_obraxis_vinculada)))
  )
));

create policy mandante_adjuntos_empresas_insert on public.mandante_adjuntos
for insert to authenticated
with check (exists (
  select 1 from public.mandante_contratos c
  where c.id = contrato_id and (
    (select private.usuario_puede_empresa(c.empresa_mandante))
    or (c.empresa_obraxis_vinculada is not null and (select private.usuario_puede_empresa(c.empresa_obraxis_vinculada)))
  )
));

create policy mandante_adjuntos_empresas_update on public.mandante_adjuntos
for update to authenticated
using (exists (
  select 1 from public.mandante_contratos c
  where c.id = contrato_id and (
    (select private.usuario_puede_empresa(c.empresa_mandante))
    or (c.empresa_obraxis_vinculada is not null and (select private.usuario_puede_empresa(c.empresa_obraxis_vinculada)))
  )
))
with check (exists (
  select 1 from public.mandante_contratos c
  where c.id = contrato_id and (
    (select private.usuario_puede_empresa(c.empresa_mandante))
    or (c.empresa_obraxis_vinculada is not null and (select private.usuario_puede_empresa(c.empresa_obraxis_vinculada)))
  )
));

create policy mandante_storage_select on storage.objects
for select to authenticated
using (
  bucket_id = 'mandante-contractual'
  and exists (
    select 1 from public.mandante_contratos c
    where c.id::text = split_part(name, '/', 1) and (
      (select private.usuario_puede_empresa(c.empresa_mandante))
      or (c.empresa_obraxis_vinculada is not null and (select private.usuario_puede_empresa(c.empresa_obraxis_vinculada)))
    )
  )
);

create policy mandante_storage_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'mandante-contractual'
  and exists (
    select 1 from public.mandante_contratos c
    where c.id::text = split_part(name, '/', 1) and (
      (select private.usuario_puede_empresa(c.empresa_mandante))
      or (c.empresa_obraxis_vinculada is not null and (select private.usuario_puede_empresa(c.empresa_obraxis_vinculada)))
    )
  )
);

alter table public.mandante_obligaciones
  add column if not exists ultima_entrega_id uuid references public.mandante_entregas(id) on delete restrict,
  add column if not exists ultima_entrega_at timestamptz,
  add column if not exists correo_responsable text,
  add column if not exists notificar_dias_antes smallint not null default 2 check (notificar_dias_antes between 0 and 30);

create or replace function public.avanzar_obligacion_mandante()
returns trigger language plpgsql security invoker set search_path = public as $$
declare siguiente date;
begin
  siguiente := case
    when lower(coalesce((select periodicidad from public.mandante_obligaciones where contrato_id=new.contrato_id and tipo=new.tipo and activa limit 1),'')) like '%diari%' then current_date + 1
    when lower(coalesce((select periodicidad from public.mandante_obligaciones where contrato_id=new.contrato_id and tipo=new.tipo and activa limit 1),'')) like '%quinc%' then current_date + 14
    when lower(coalesce((select periodicidad from public.mandante_obligaciones where contrato_id=new.contrato_id and tipo=new.tipo and activa limit 1),'')) like '%seman%' then current_date + 7
    when lower(coalesce((select periodicidad from public.mandante_obligaciones where contrato_id=new.contrato_id and tipo=new.tipo and activa limit 1),'')) like '%mens%' then (current_date + interval '1 month')::date
    else null
  end;
  update public.mandante_obligaciones
  set ultima_entrega_id=new.id, ultima_entrega_at=new.enviado_at,
      proxima_fecha=coalesce(siguiente,proxima_fecha), updated_at=now()
  where contrato_id=new.contrato_id and tipo=new.tipo and activa;
  return new;
end; $$;

drop trigger if exists trg_avanzar_obligacion_mandante on public.mandante_entregas;
create trigger trg_avanzar_obligacion_mandante
after insert on public.mandante_entregas
for each row execute function public.avanzar_obligacion_mandante();

create index if not exists mandante_adjuntos_entrega_idx on public.mandante_adjuntos (entrega_id, created_at);
create index if not exists mandante_obligaciones_vencimiento_idx on public.mandante_obligaciones (empresa_mandante, proxima_fecha) where activa;
