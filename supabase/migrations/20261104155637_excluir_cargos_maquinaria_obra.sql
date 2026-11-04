create function private.excluir_cargo_maquinaria_obra(p_empresa text,p_obra integer,p_cargo text,p_version integer,p_monto numeric,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b record; v integer; e integer; d date; decision public.maquinaria_decisiones_costo;
begin
 if auth.uid() is null or not private.rrhh_partidas_permiso(p_empresa,p_obra,'aprobar') or not private.rrhh_partidas_permiso(p_empresa,p_obra,'editar') then
  raise exception 'Solo Administrador de Empresa o Administrador de Contratos puede excluir cargos' using errcode='42501';
 end if;
 if length(btrim(coalesce(p_motivo,'')))<5 or length(p_motivo)>1000 then raise exception 'Indica un motivo entre 5 y 1000 caracteres'; end if;
 e:=split_part(p_cargo,':',1)::integer; d:=split_part(p_cargo,':',2)::date;
 if d is null or d>(now() at time zone 'America/Santiago')::date then raise exception 'Fecha de cargo inválida o futura'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_empresa||':'||p_obra||':'||e||':'||d,0));
 select version into v from public.maquinaria_partidas_decisiones where empresa=p_empresa and obra_id=p_obra and equipo_id=e and fecha=d for update;
 select * into decision from public.maquinaria_decisiones_costo where empresa=p_empresa and equipo_id=e and fecha=d for update;
 if decision.tipo='retiro' then raise exception 'Este día tiene un retiro registrado. Revisa esa decisión antes de excluir el cargo'; end if;
 if decision.empresa is not null and decision.obra_id<>p_obra then raise exception 'Existe una decisión para otra obra'; end if;
 select * into b from private.maquinaria_cargo_para_imputar(p_empresa,p_obra,e,d);
 if not found then raise exception 'El cargo ya no está vigente. Actualiza antes de continuar'; end if;
 if p_version is distinct from coalesce(v,0) or p_monto is distinct from b.monto_real then raise exception 'El cargo cambió. Actualiza antes de guardar'; end if;
 insert into public.maquinaria_decisiones_costo(empresa,equipo_id,fecha,obra_id,tipo,monto,motivo,actualizado_por,actualizado_at)
 values(p_empresa,e,d,p_obra,'no_uso',null,btrim(p_motivo),auth.uid(),now())
 on conflict(empresa,equipo_id,fecha) do update set tipo='no_uso',monto=null,motivo=excluded.motivo,actualizado_por=auth.uid(),actualizado_at=now();
 -- Existing auditar_decisiones_costo trigger preserves before/after and actor.
 return jsonb_build_object('guardado',true,'excluido',true);
end $$;
revoke all on function private.excluir_cargo_maquinaria_obra(text,integer,text,integer,numeric,text) from public,anon;
grant execute on function private.excluir_cargo_maquinaria_obra(text,integer,text,integer,numeric,text) to authenticated;
create function public.excluir_cargo_maquinaria_obra(p_empresa text,p_obra integer,p_cargo text,p_version integer,p_monto numeric,p_motivo text)
returns jsonb language sql security invoker set search_path='' as $$
 select private.excluir_cargo_maquinaria_obra(p_empresa,p_obra,p_cargo,p_version,p_monto,p_motivo);
$$;
revoke all on function public.excluir_cargo_maquinaria_obra(text,integer,text,integer,numeric,text) from public,anon;
grant execute on function public.excluir_cargo_maquinaria_obra(text,integer,text,integer,numeric,text) to authenticated;
notify pgrst,'reload schema';
