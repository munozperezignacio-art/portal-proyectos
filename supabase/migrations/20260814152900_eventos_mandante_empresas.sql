drop policy if exists mandante_eventos_empresa on public.mandante_eventos;

create policy mandante_eventos_empresas on public.mandante_eventos
for select to authenticated
using (
  (select private.usuario_puede_empresa(empresa_mandante))
  or exists (
    select 1 from public.mandante_contratos c
    where c.id = contrato_id
      and c.empresa_obraxis_vinculada is not null
      and (select private.usuario_puede_empresa(c.empresa_obraxis_vinculada))
  )
);

create policy mandante_eventos_empresas_insert on public.mandante_eventos
for insert to authenticated
with check (
  (select private.usuario_puede_empresa(empresa_mandante))
  or exists (
    select 1 from public.mandante_contratos c
    where c.id = contrato_id
      and c.empresa_obraxis_vinculada is not null
      and (select private.usuario_puede_empresa(c.empresa_obraxis_vinculada))
  )
);;
