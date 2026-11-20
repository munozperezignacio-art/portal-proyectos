-- Independent earnings actions; never grant salary access or change role assignments.
create or replace function private.obra_haber_permiso(p_empresa text,p_obra integer,p_accion text)
returns boolean language sql stable security invoker set search_path='' as $$
select (select auth.uid()) is not null
 and p_accion in ('crear','editar','descargar')
 and private.rrhh_partidas_permiso(p_empresa,p_obra,'ver')
 and coalesce((select coalesce(
   ((coalesce(r.permisos,'{}'::jsonb)||coalesce(u.permisos,'{}'::jsonb))->>('obras.haberes.'||p_accion))::boolean,
   concat_ws(' ',u.rol,u.rol_base) ~* 'administrador.*(empresa|contrato)')
 from public.usuarios u left join public.roles r on r.empresa=u.empresa and r.nombre=u.rol
 where u.empresa=p_empresa and u.auth_user_id=(select auth.uid())),false)
$$;
revoke all on function private.obra_haber_permiso(text,integer,text) from public,anon;
grant execute on function private.obra_haber_permiso(text,integer,text) to authenticated;
alter policy lectura on public.rrhh_haberes_obra using (
 private.obra_haber_permiso(empresa,obra_id,'editar') or private.obra_haber_permiso(empresa,obra_id,'descargar'));
alter policy alta on public.rrhh_haberes_obra with check (private.obra_haber_permiso(empresa,obra_id,'crear'));
alter policy cambio on public.rrhh_haberes_obra using (private.obra_haber_permiso(empresa,obra_id,'editar'))
 with check (private.obra_haber_permiso(empresa,obra_id,'editar'));
notify pgrst,'reload schema';
