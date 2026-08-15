create table if not exists public.ox_consultas_modulo (
  id uuid primary key default gen_random_uuid(),
  empresa text not null,
  modulo text not null,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  usuario text,
  pregunta text not null,
  respuesta jsonb not null default '{}'::jsonb,
  ia_consumo_id uuid,
  created_at timestamptz not null default now()
);
create index if not exists ox_consultas_modulo_empresa_modulo_fecha_idx on public.ox_consultas_modulo (empresa, modulo, created_at desc);
alter table public.ox_consultas_modulo enable row level security;
grant select on public.ox_consultas_modulo to authenticated;
drop policy if exists ox_consultas_modulo_lectura_propia on public.ox_consultas_modulo;
create policy ox_consultas_modulo_lectura_propia on public.ox_consultas_modulo
for select to authenticated
using (
 auth_user_id = auth.uid()
 and exists (
  select 1 from public.usuarios u
  where u.auth_user_id = auth.uid() and lower(u.empresa) = lower(ox_consultas_modulo.empresa)
 )
);;
