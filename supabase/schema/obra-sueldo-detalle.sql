create or replace function private.obra_permiso_salarial(p_empresa text,p_clave text) returns boolean language sql stable security invoker set search_path='' as $$
select coalesce((select ((coalesce(r.permisos,'{}') || coalesce(u.permisos,'{}'))->>p_clave)::boolean from public.usuarios u left join public.roles r on r.empresa=u.empresa and r.nombre=u.rol where u.empresa=p_empresa and u.auth_user_id=(select auth.uid())),null)
$$;
revoke all on function private.obra_permiso_salarial(text,text) from public,anon;
grant execute on function private.obra_permiso_salarial(text,text) to authenticated;
update public.roles set permisos=coalesce(permisos,'{}')||'{"obras.sueldos.ver":false,"obras.haberes.crear":true}'::jsonb where empresa='EMINSG' and nombre in ('Supervisor','Oficina Técnica');
alter policy lectura on public.rrhh_haberes_obra using(private.rrhh_partidas_permiso(empresa,obra_id,'ver') and coalesce(private.obra_permiso_salarial(empresa,'obras.sueldos.ver'),true));
alter policy alta on public.rrhh_haberes_obra with check(private.rrhh_partidas_permiso(empresa,obra_id,'ver') and coalesce(private.obra_permiso_salarial(empresa,'obras.haberes.crear'),private.rrhh_partidas_permiso(empresa,obra_id,'editar')));
create function public.costos_laborales_obra_agrupados(p_empresa text,p_obra integer) returns table(fecha date,monto_real numeric,obra_liquidaciones_partidas jsonb) language sql stable security invoker set search_path='' as $$
with vivos as materialized (select v.fecha::date d,v.monto_real::numeric m,v.nomina_item_id,v.obra_liquidaciones_partidas::jsonb partes from public.rrhh_costos_personal_vigentes v where v.empresa=p_empresa and v.obra_id=p_obra and private.rrhh_partidas_permiso(p_empresa,p_obra,'ver')),
filas as (select d,m,partes from vivos union all select l.created_at::date,l.monto_real,coalesce((select jsonb_agg(jsonb_build_object('partida',p.partida,'monto_imputado',p.monto_imputado)) from public.obra_liquidaciones_partidas p where p.liquidacion_id=l.id and p.empresa=p_empresa),'[]') from public.obra_liquidaciones l where l.empresa=p_empresa and l.obra_id=p_obra and private.rrhh_partidas_permiso(p_empresa,p_obra,'ver') and not exists(select 1 from vivos v where v.nomina_item_id=l.nomina_item_id)),
partidas as (select d,part->>'partida' partida,sum((part->>'monto_imputado')::numeric) monto from filas cross join lateral jsonb_array_elements(partes) part group by 1,2)
select f.d,sum(f.m),coalesce((select jsonb_agg(jsonb_build_object('partida',p.partida,'monto_imputado',p.monto)) from partidas p where p.d=f.d),'[]') from filas f group by f.d order by f.d
$$;
revoke all on function public.costos_laborales_obra_agrupados(text,integer) from public,anon;
grant execute on function public.costos_laborales_obra_agrupados(text,integer) to authenticated;notify pgrst,'reload schema';
