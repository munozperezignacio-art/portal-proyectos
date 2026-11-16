create or replace function public.resolver_pendientes_sin_cargo(p_empresa text,p_trabajador integer,p_motivo text)
returns integer language plpgsql security invoker set search_path='' as $$
declare dia bigint; total integer:=0;
begin
 if not private.rrhh_imputaciones_permiso(p_empresa,'aprobar') or not private.rrhh_imputaciones_permiso(p_empresa,'ver') then raise exception 'Sin permiso'; end if;
 for dia in select id from public.rrhh_imputaciones_diarias where empresa=p_empresa and trabajador_id=p_trabajador and estado='Pendiente' and fecha <= (now() at time zone 'America/Santiago')::date order by id loop
   perform private.resolver_dia_sin_cargo(p_empresa,dia,p_motivo);
   total:=total+1;
 end loop;
 return total;
end; $$;
revoke all on function public.resolver_pendientes_sin_cargo(text,integer,text) from public,anon;
grant execute on function public.resolver_pendientes_sin_cargo(text,integer,text) to authenticated;
