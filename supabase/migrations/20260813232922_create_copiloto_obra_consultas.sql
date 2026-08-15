create table if not exists public.copiloto_obra_consultas (
  id uuid primary key default gen_random_uuid(),
  empresa text not null,
  obra_nombre text not null,
  auth_user_id uuid not null references auth.users(id) on delete cascade,
  usuario text,
  pregunta text not null,
  respuesta jsonb not null default '{}'::jsonb,
  ia_consumo_id uuid,
  created_at timestamptz not null default now()
);

create index if not exists copiloto_obra_consultas_usuario_obra_fecha_idx
  on public.copiloto_obra_consultas (auth_user_id, obra_nombre, created_at desc);

alter table public.copiloto_obra_consultas enable row level security;

drop policy if exists "copiloto_consultas_propias_select" on public.copiloto_obra_consultas;
create policy "copiloto_consultas_propias_select"
  on public.copiloto_obra_consultas for select to authenticated
  using ((select auth.uid()) = auth_user_id);

revoke all on public.copiloto_obra_consultas from anon;
revoke insert, update, delete on public.copiloto_obra_consultas from authenticated;
grant select on public.copiloto_obra_consultas to authenticated;

comment on table public.copiloto_obra_consultas is
  'Historial auditable y de solo lectura de consultas del Copiloto contextual por obra.';

;
