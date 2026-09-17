create table if not exists public.correo_conversaciones (
  id uuid primary key default gen_random_uuid(),
  empresa text not null default 'Obraxis' check (empresa = 'Obraxis'),
  buzon text not null default 'contacto@obraxis.cl',
  contacto_id bigint references public.contactos_publicos(id) on delete set null,
  participante_nombre text,
  participante_correo text not null,
  asunto text not null default '(sin asunto)',
  estado text not null default 'nuevo' check (estado in ('nuevo','abierto','pendiente','cerrado','spam')),
  responsable_auth_user_id uuid references auth.users(id) on delete set null,
  responsable_nombre text,
  notas_internas text,
  no_leidos integer not null default 0 check (no_leidos >= 0),
  ultimo_mensaje_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.correo_mensajes (
  id uuid primary key default gen_random_uuid(),
  conversacion_id uuid not null references public.correo_conversaciones(id) on delete cascade,
  direccion text not null check (direccion in ('entrada','salida')),
  estado text not null default 'recibido' check (estado in ('recibido','pendiente','enviado','error')),
  resend_email_id text unique,
  message_id text,
  in_reply_to text,
  remitente_nombre text,
  remitente_correo text not null,
  destinatarios jsonb not null default '[]'::jsonb check (jsonb_typeof(destinatarios) = 'array'),
  cc jsonb not null default '[]'::jsonb check (jsonb_typeof(cc) = 'array'),
  asunto text not null default '(sin asunto)',
  cuerpo_texto text,
  cuerpo_html text,
  adjuntos jsonb not null default '[]'::jsonb check (jsonb_typeof(adjuntos) = 'array'),
  error_detalle text,
  actor_auth_user_id uuid references auth.users(id) on delete set null,
  actor_nombre text,
  enviado_at timestamptz,
  recibido_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists correo_conversaciones_ultimo_idx
  on public.correo_conversaciones (ultimo_mensaje_at desc);
create index if not exists correo_conversaciones_participante_idx
  on public.correo_conversaciones (lower(participante_correo), ultimo_mensaje_at desc);
create index if not exists correo_mensajes_conversacion_idx
  on public.correo_mensajes (conversacion_id, created_at asc);
create unique index if not exists correo_mensajes_message_id_idx
  on public.correo_mensajes (message_id) where message_id is not null;

alter table public.correo_conversaciones enable row level security;
alter table public.correo_mensajes enable row level security;

revoke all on public.correo_conversaciones from public, anon, authenticated;
revoke all on public.correo_mensajes from public, anon, authenticated;
grant select on public.correo_conversaciones to authenticated;
grant update (estado, responsable_auth_user_id, responsable_nombre, notas_internas, no_leidos)
  on public.correo_conversaciones to authenticated;
grant select on public.correo_mensajes to authenticated;

create policy correo_conversaciones_select on public.correo_conversaciones
for select to authenticated
using ((select private.usuario_puede_gestionar_contactos()));

create policy correo_conversaciones_update on public.correo_conversaciones
for update to authenticated
using ((select private.usuario_puede_gestionar_contactos()))
with check ((select private.usuario_puede_gestionar_contactos()) and empresa = 'Obraxis');

create policy correo_mensajes_select on public.correo_mensajes
for select to authenticated
using (
  exists (
    select 1 from public.correo_conversaciones c
    where c.id = correo_mensajes.conversacion_id
      and (select private.usuario_puede_gestionar_contactos())
  )
);

create or replace function private.actualizar_correo_conversacion()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_correo_conversaciones_updated
before update on public.correo_conversaciones
for each row execute function private.actualizar_correo_conversacion();

create or replace function private.sincronizar_correo_conversacion_desde_mensaje()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
begin
  update public.correo_conversaciones
  set ultimo_mensaje_at = coalesce(new.recibido_at, new.enviado_at, new.created_at),
      no_leidos = no_leidos + case when new.direccion = 'entrada' then 1 else 0 end,
      estado = case when new.direccion = 'entrada' and estado = 'cerrado' then 'abierto' else estado end
  where id = new.conversacion_id;
  return new;
end;
$$;

create trigger trg_correo_mensaje_sincroniza_conversacion
after insert on public.correo_mensajes
for each row execute function private.sincronizar_correo_conversacion_desde_mensaje();

insert into public.correo_conversaciones (
  contacto_id, participante_nombre, participante_correo, asunto, estado,
  responsable_auth_user_id, responsable_nombre, notas_internas,
  no_leidos, ultimo_mensaje_at, created_at
)
select
  c.id, c.nombre, lower(c.correo), 'Solicitud desde obraxis.cl',
  case when c.estado in ('cerrado','descartado') then 'cerrado' else 'abierto' end,
  c.responsable_auth_user_id, c.responsable_nombre, c.notas_internas,
  0, c.created_at, c.created_at
from public.contactos_publicos c
where not exists (
  select 1 from public.correo_conversaciones existing where existing.contacto_id = c.id
);

insert into public.correo_mensajes (
  conversacion_id, direccion, estado, resend_email_id, remitente_nombre,
  remitente_correo, destinatarios, asunto, cuerpo_texto, recibido_at, created_at
)
select
  conversation.id, 'entrada', 'recibido', contact.resend_id, contact.nombre,
  lower(contact.correo), '["contacto@obraxis.cl"]'::jsonb,
  'Solicitud desde obraxis.cl', contact.mensaje, contact.created_at, contact.created_at
from public.contactos_publicos contact
join public.correo_conversaciones conversation on conversation.contacto_id = contact.id
where not exists (
  select 1 from public.correo_mensajes message
  where message.conversacion_id = conversation.id and message.direccion = 'entrada'
);

create or replace function private.crear_correo_desde_contacto_publico()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  conversation_id uuid;
begin
  insert into public.correo_conversaciones (
    contacto_id, participante_nombre, participante_correo, asunto, estado,
    no_leidos, ultimo_mensaje_at, created_at
  ) values (
    new.id, new.nombre, lower(new.correo), 'Solicitud desde obraxis.cl', 'nuevo',
    0, new.created_at, new.created_at
  )
  returning id into conversation_id;

  insert into public.correo_mensajes (
    conversacion_id, direccion, estado, remitente_nombre, remitente_correo,
    destinatarios, asunto, cuerpo_texto, recibido_at, created_at
  ) values (
    conversation_id, 'entrada', 'recibido', new.nombre, lower(new.correo),
    '["contacto@obraxis.cl"]'::jsonb, 'Solicitud desde obraxis.cl', new.mensaje,
    new.created_at, new.created_at
  );

  return new;
end;
$$;

revoke all on function private.crear_correo_desde_contacto_publico() from public;

create trigger trg_contacto_publico_crea_correo
after insert on public.contactos_publicos
for each row execute function private.crear_correo_desde_contacto_publico();

comment on table public.correo_conversaciones is 'Hilos de la bandeja de correo interna de Obraxis.';
comment on table public.correo_mensajes is 'Mensajes entrantes y salientes procesados mediante Resend.';
