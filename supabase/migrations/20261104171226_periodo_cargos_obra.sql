create table public.obra_periodo_cargos(
 empresa text not null,obra_id integer not null references public.obras(id),
 desde date,hasta date,version integer not null default 1,
 actualizado_por uuid not null,actualizado_en timestamptz not null default now(),
 historial jsonb not null default '[]',primary key(empresa,obra_id),
 check(desde is null or hasta is null or desde<=hasta)
);
alter table public.obra_periodo_cargos enable row level security;
revoke all on public.obra_periodo_cargos from public,anon,authenticated;
grant select on public.obra_periodo_cargos to authenticated;
create policy periodo_cargos_lectura on public.obra_periodo_cargos for select to authenticated
using(private.rrhh_partidas_permiso(empresa,obra_id,'ver'));
create function private.guardar_periodo_cargos_obra(p_empresa text,p_obra integer,p_desde date,p_hasta date,p_version integer,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare anterior public.obra_periodo_cargos; evento jsonb;
begin
 if auth.uid() is null or not private.rrhh_partidas_permiso(p_empresa,p_obra,'editar') or not private.rrhh_partidas_permiso(p_empresa,p_obra,'aprobar') then raise exception 'Solo administradores de empresa o contratos pueden modificar el período' using errcode='42501'; end if;
 if p_desde is not null and p_hasta is not null and p_desde>p_hasta then raise exception 'El cierre no puede ser anterior al inicio'; end if;
 if length(btrim(coalesce(p_motivo,'')))<5 or length(p_motivo)>1000 then raise exception 'Indica un motivo entre 5 y 1000 caracteres'; end if;
 perform pg_advisory_xact_lock(hashtextextended('periodo_cargos:'||p_empresa||':'||p_obra,0));
 select * into anterior from public.obra_periodo_cargos where empresa=p_empresa and obra_id=p_obra for update;
 if p_version is distinct from coalesce(anterior.version,0) then raise exception 'El período cambió. Actualiza antes de guardar'; end if;
 evento:=jsonb_build_object('fecha',now(),'actor',auth.uid(),'motivo',btrim(p_motivo),'desde_anterior',anterior.desde,'hasta_anterior',anterior.hasta,'desde',p_desde,'hasta',p_hasta);
 insert into public.obra_periodo_cargos(empresa,obra_id,desde,hasta,actualizado_por,historial)
 values(p_empresa,p_obra,p_desde,p_hasta,auth.uid(),jsonb_build_array(evento))
 on conflict(empresa,obra_id) do update set desde=excluded.desde,hasta=excluded.hasta,version=obra_periodo_cargos.version+1,actualizado_por=auth.uid(),actualizado_en=now(),historial=obra_periodo_cargos.historial||jsonb_build_array(evento);
 return jsonb_build_object('guardado',true);
end $$;
revoke all on function private.guardar_periodo_cargos_obra(text,integer,date,date,integer,text) from public,anon;
grant execute on function private.guardar_periodo_cargos_obra(text,integer,date,date,integer,text) to authenticated;
create function public.guardar_periodo_cargos_obra(p_empresa text,p_obra integer,p_desde date,p_hasta date,p_version integer,p_motivo text)
returns jsonb language sql security invoker set search_path='' as $$
 select private.guardar_periodo_cargos_obra(p_empresa,p_obra,p_desde,p_hasta,p_version,p_motivo);
$$;
revoke all on function public.guardar_periodo_cargos_obra(text,integer,date,date,integer,text) from public,anon;
grant execute on function public.guardar_periodo_cargos_obra(text,integer,date,date,integer,text) to authenticated;

-- Skip the generator BEFORE its insert/upsert. Existing payroll, attendance and
-- historical costs remain untouched. Default centres and no-attendance rules
-- have already been resolved at this point in the original function.
do $$
declare source text; anchor text:='  v_evidencia:=jsonb_build_object';
begin
 source:=pg_get_functiondef('private.rrhh_sincronizar_cargo_dia(text,integer,date)'::regprocedure);
 if position(anchor in source)=0 then raise exception 'No se encontró el punto seguro del generador de personal'; end if;
 source:=replace(source,anchor,$guard$
  if exists(select 1 from public.obras o join public.obra_periodo_cargos pc on pc.empresa=o.empresa and pc.obra_id=o.id
    where o.empresa=p_empresa and o.centro_gestion_id=centro
    and ((pc.desde is not null and p_fecha<pc.desde) or (pc.hasta is not null and p_fecha>pc.hasta))) then return; end if;
$guard$||anchor);
 execute source;
end $$;
notify pgrst,'reload schema';
