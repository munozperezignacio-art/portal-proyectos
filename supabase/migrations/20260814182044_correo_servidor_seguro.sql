create table if not exists public.correo_sistema_intentos (
  id bigint generated always as identity primary key,
  actor_id uuid,
  ip_hash text not null,
  canal text not null check (canal in ('interno','contacto')),
  exitoso boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.correo_sistema_intentos enable row level security;
revoke all on public.correo_sistema_intentos from public, anon, authenticated;
create index if not exists correo_sistema_intentos_limite_idx
  on public.correo_sistema_intentos (canal, actor_id, ip_hash, created_at desc);;
