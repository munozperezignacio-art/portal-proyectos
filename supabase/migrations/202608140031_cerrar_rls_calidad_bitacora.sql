-- Cierra el acceso directo y multiempresa de Calidad y Bitácora.
-- Los portales externos acceden a estos datos exclusivamente mediante
-- Edge Functions validadas, que operan con service_role.

alter table public.calidad_pac
  alter column empresa set not null;
alter table public.calidad_rdi
  alter column empresa set not null;
alter table public.calidad_recepciones_partidas
  alter column empresa set not null;

alter table public.bitacora_eventos_obra enable row level security;
alter table public.calidad_pac enable row level security;
alter table public.calidad_rdi enable row level security;
alter table public.calidad_recepciones_partidas enable row level security;
alter table public.calidad_recepcion_controles enable row level security;

drop policy if exists "Allow_All_Operations_Anon_Authenticated" on public.bitacora_eventos_obra;
drop policy if exists "Allow_All_Operations_Anon_Authenticated" on public.calidad_pac;
drop policy if exists "Allow_All_Operations_Anon_Authenticated" on public.calidad_rdi;
drop policy if exists "Allow_All_Operations_Anon_Authenticated" on public.calidad_recepciones_partidas;
drop policy if exists "Allow_All_Operations_Anon_Authenticated" on public.calidad_recepcion_controles;

create policy bitacora_select_empresa
on public.bitacora_eventos_obra for select to authenticated
using ((select private.obraxis_actor_can_access_company(empresa)));

create policy bitacora_insert_empresa
on public.bitacora_eventos_obra for insert to authenticated
with check ((select private.obraxis_actor_can_access_company(empresa)));

create policy bitacora_update_empresa
on public.bitacora_eventos_obra for update to authenticated
using ((select private.obraxis_actor_can_access_company(empresa)))
with check ((select private.obraxis_actor_can_access_company(empresa)));

create policy bitacora_delete_empresa
on public.bitacora_eventos_obra for delete to authenticated
using ((select private.obraxis_actor_can_access_company(empresa)));

create policy calidad_pac_select_empresa
on public.calidad_pac for select to authenticated
using ((select private.obraxis_actor_can_access_company(empresa)));

create policy calidad_pac_insert_empresa
on public.calidad_pac for insert to authenticated
with check ((select private.obraxis_actor_can_access_company(empresa)));

create policy calidad_pac_update_empresa
on public.calidad_pac for update to authenticated
using ((select private.obraxis_actor_can_access_company(empresa)))
with check ((select private.obraxis_actor_can_access_company(empresa)));

create policy calidad_pac_delete_empresa
on public.calidad_pac for delete to authenticated
using ((select private.obraxis_actor_can_access_company(empresa)));

create policy calidad_rdi_select_empresa
on public.calidad_rdi for select to authenticated
using ((select private.obraxis_actor_can_access_company(empresa)));

create policy calidad_rdi_insert_empresa
on public.calidad_rdi for insert to authenticated
with check ((select private.obraxis_actor_can_access_company(empresa)));

create policy calidad_rdi_update_empresa
on public.calidad_rdi for update to authenticated
using ((select private.obraxis_actor_can_access_company(empresa)))
with check ((select private.obraxis_actor_can_access_company(empresa)));

create policy calidad_rdi_delete_empresa
on public.calidad_rdi for delete to authenticated
using ((select private.obraxis_actor_can_access_company(empresa)));

create policy calidad_recepciones_select_empresa
on public.calidad_recepciones_partidas for select to authenticated
using ((select private.obraxis_actor_can_access_company(empresa)));

create policy calidad_recepciones_insert_empresa
on public.calidad_recepciones_partidas for insert to authenticated
with check ((select private.obraxis_actor_can_access_company(empresa)));

create policy calidad_recepciones_update_empresa
on public.calidad_recepciones_partidas for update to authenticated
using ((select private.obraxis_actor_can_access_company(empresa)))
with check ((select private.obraxis_actor_can_access_company(empresa)));

create policy calidad_recepciones_delete_empresa
on public.calidad_recepciones_partidas for delete to authenticated
using ((select private.obraxis_actor_can_access_company(empresa)));

create policy calidad_controles_select_empresa
on public.calidad_recepcion_controles for select to authenticated
using (exists (
  select 1
  from public.calidad_recepciones_partidas recepcion
  where recepcion.id = calidad_recepcion_controles.recepcion_id
    and (select private.obraxis_actor_can_access_company(recepcion.empresa))
));

create policy calidad_controles_insert_empresa
on public.calidad_recepcion_controles for insert to authenticated
with check (exists (
  select 1
  from public.calidad_recepciones_partidas recepcion
  where recepcion.id = calidad_recepcion_controles.recepcion_id
    and (select private.obraxis_actor_can_access_company(recepcion.empresa))
));

create policy calidad_controles_update_empresa
on public.calidad_recepcion_controles for update to authenticated
using (exists (
  select 1
  from public.calidad_recepciones_partidas recepcion
  where recepcion.id = calidad_recepcion_controles.recepcion_id
    and (select private.obraxis_actor_can_access_company(recepcion.empresa))
))
with check (exists (
  select 1
  from public.calidad_recepciones_partidas recepcion
  where recepcion.id = calidad_recepcion_controles.recepcion_id
    and (select private.obraxis_actor_can_access_company(recepcion.empresa))
));

create policy calidad_controles_delete_empresa
on public.calidad_recepcion_controles for delete to authenticated
using (exists (
  select 1
  from public.calidad_recepciones_partidas recepcion
  where recepcion.id = calidad_recepcion_controles.recepcion_id
    and (select private.obraxis_actor_can_access_company(recepcion.empresa))
));

revoke all on public.bitacora_eventos_obra from anon, authenticated;
revoke all on public.calidad_pac from anon, authenticated;
revoke all on public.calidad_rdi from anon, authenticated;
revoke all on public.calidad_recepciones_partidas from anon, authenticated;
revoke all on public.calidad_recepcion_controles from anon, authenticated;

grant select, insert, update, delete on public.bitacora_eventos_obra to authenticated;
grant select, insert, update, delete on public.calidad_pac to authenticated;
grant select, insert, update, delete on public.calidad_rdi to authenticated;
grant select, insert, update, delete on public.calidad_recepciones_partidas to authenticated;
grant select, insert, update, delete on public.calidad_recepcion_controles to authenticated;

revoke all on sequence public.bitacora_eventos_obra_id_seq from anon, authenticated;
revoke all on sequence public.calidad_pac_id_seq from anon, authenticated;
revoke all on sequence public.calidad_rdi_id_seq from anon, authenticated;
revoke all on sequence public.calidad_recepciones_partidas_id_seq from anon, authenticated;
revoke all on sequence public.calidad_recepcion_controles_id_seq from anon, authenticated;

grant usage, select on sequence public.bitacora_eventos_obra_id_seq to authenticated;
grant usage, select on sequence public.calidad_pac_id_seq to authenticated;
grant usage, select on sequence public.calidad_rdi_id_seq to authenticated;
grant usage, select on sequence public.calidad_recepciones_partidas_id_seq to authenticated;
grant usage, select on sequence public.calidad_recepcion_controles_id_seq to authenticated;

create index if not exists calidad_recepcion_controles_recepcion_id_idx
  on public.calidad_recepcion_controles (recepcion_id);
