-- Formularios de Prevención: las tablas quedan aisladas por empresa.
-- Los enlaces públicos operan por la Edge Function formulario-publico.

update public.prevencion_formularios set empresa='Obraxis'
where empresa is null or btrim(empresa)='';
alter table public.prevencion_formularios alter column empresa set not null;
alter table public.prevencion_formularios enable row level security;
alter table public.prevencion_respuestas enable row level security;

drop policy if exists "Allow_All_Operations_Anon_Authenticated" on public.prevencion_formularios;
drop policy if exists "Allow_All_Operations_Anon_Authenticated" on public.prevencion_respuestas;

create policy prevencion_formularios_select_empresa on public.prevencion_formularios
for select to authenticated using ((select private.obraxis_actor_can_access_company(empresa)));
create policy prevencion_formularios_insert_empresa on public.prevencion_formularios
for insert to authenticated with check ((select private.obraxis_actor_can_access_company(empresa)));
create policy prevencion_formularios_update_empresa on public.prevencion_formularios
for update to authenticated using ((select private.obraxis_actor_can_access_company(empresa)))
with check ((select private.obraxis_actor_can_access_company(empresa)));
create policy prevencion_formularios_delete_empresa on public.prevencion_formularios
for delete to authenticated using ((select private.obraxis_actor_can_access_company(empresa)));

create policy prevencion_respuestas_select_empresa on public.prevencion_respuestas
for select to authenticated using (exists(select 1 from public.prevencion_formularios f
where f.id=prevencion_respuestas.formulario_id and (select private.obraxis_actor_can_access_company(f.empresa))));
create policy prevencion_respuestas_insert_empresa on public.prevencion_respuestas
for insert to authenticated with check (exists(select 1 from public.prevencion_formularios f
where f.id=prevencion_respuestas.formulario_id and (select private.obraxis_actor_can_access_company(f.empresa))));
create policy prevencion_respuestas_update_empresa on public.prevencion_respuestas
for update to authenticated using (exists(select 1 from public.prevencion_formularios f
where f.id=prevencion_respuestas.formulario_id and (select private.obraxis_actor_can_access_company(f.empresa))))
with check (exists(select 1 from public.prevencion_formularios f
where f.id=prevencion_respuestas.formulario_id and (select private.obraxis_actor_can_access_company(f.empresa))));
create policy prevencion_respuestas_delete_empresa on public.prevencion_respuestas
for delete to authenticated using (exists(select 1 from public.prevencion_formularios f
where f.id=prevencion_respuestas.formulario_id and (select private.obraxis_actor_can_access_company(f.empresa))));

revoke all on public.prevencion_formularios from anon,authenticated;
revoke all on public.prevencion_respuestas from anon,authenticated;
grant select,insert,update,delete on public.prevencion_formularios to authenticated;
grant select,insert,update,delete on public.prevencion_respuestas to authenticated;
revoke all on sequence public.prevencion_formularios_id_seq from anon,authenticated;
revoke all on sequence public.prevencion_respuestas_id_seq from anon,authenticated;
grant usage,select on sequence public.prevencion_formularios_id_seq to authenticated;
grant usage,select on sequence public.prevencion_respuestas_id_seq to authenticated;
create index if not exists prevencion_formularios_empresa_idx on public.prevencion_formularios(empresa);
create index if not exists prevencion_respuestas_formulario_id_idx on public.prevencion_respuestas(formulario_id);

create table if not exists public.formulario_publico_intentos(
  id bigint generated always as identity primary key,
  token_hash text not null,
  ip_hash text not null,
  accion text not null check(accion in ('cargar','enviar')),
  exitoso boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.formulario_publico_intentos enable row level security;
revoke all on public.formulario_publico_intentos from public,anon,authenticated;
create index if not exists formulario_publico_intentos_limite_idx
on public.formulario_publico_intentos(token_hash,ip_hash,accion,created_at desc);
;
