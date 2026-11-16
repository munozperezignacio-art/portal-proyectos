begin;
alter table public.rrhh_imputaciones_diarias drop constraint rrhh_imputaciones_diarias_estado_check;
alter table public.rrhh_imputaciones_diarias add constraint rrhh_imputaciones_diarias_estado_check check (estado in ('Pendiente','Aprobada','Sin cargo'));
create or replace function private.resolver_dia_sin_cargo(p_empresa text,p_id bigint,p_motivo text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not private.rrhh_imputaciones_permiso(p_empresa,'aprobar') or not private.rrhh_imputaciones_permiso(p_empresa,'ver') then raise exception 'Sin permiso'; end if;
 if length(trim(coalesce(p_motivo,''))) < 3 then raise exception 'Indique un motivo de al menos tres caracteres'; end if;
 update public.rrhh_imputaciones_diarias set estado='Sin cargo',centro_aprobado_id=null,costo_total=0,comentario=trim(p_motivo),aprobado_por=auth.uid(),aprobado_en=now(),
 historial=historial||jsonb_build_array(jsonb_build_object('estado','Sin cargo','motivo',trim(p_motivo),'usuario',auth.uid(),'fecha',now(),'costo_propuesto',costo_total))
 where empresa=p_empresa and id=p_id and estado='Pendiente' and fecha<=(now() at time zone 'America/Santiago')::date;
 if not found then raise exception 'El día ya no está pendiente o es futuro'; end if;
end; $$;
create or replace function public.resolver_dia_sin_cargo(p_empresa text,p_id bigint,p_motivo text) returns void language sql security invoker set search_path='' as $$select private.resolver_dia_sin_cargo(p_empresa,p_id,p_motivo)$$;
revoke all on function private.resolver_dia_sin_cargo(text,bigint,text),public.resolver_dia_sin_cargo(text,bigint,text) from public,anon;
grant execute on function private.resolver_dia_sin_cargo(text,bigint,text),public.resolver_dia_sin_cargo(text,bigint,text) to authenticated;
commit;
