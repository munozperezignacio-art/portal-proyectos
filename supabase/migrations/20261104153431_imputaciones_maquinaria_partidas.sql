create table public.maquinaria_partidas_decisiones (
 empresa text not null, obra_id integer not null references public.obras(id),
 equipo_id integer not null, fecha date not null,
 distribucion jsonb not null, motivo text not null, version integer not null default 1,
 actualizado_por uuid not null, actualizado_en timestamptz not null default now(),
 historial jsonb not null default '[]',
 primary key(empresa,obra_id,equipo_id,fecha),
 check(jsonb_typeof(distribucion)='array' and jsonb_array_length(distribucion)>0),
 check(jsonb_typeof(historial)='array')
);
alter table public.maquinaria_partidas_decisiones enable row level security;


revoke all on public.maquinaria_partidas_decisiones from public,anon,authenticated;
grant select on public.maquinaria_partidas_decisiones to authenticated;
create policy maquinaria_partidas_lectura on public.maquinaria_partidas_decisiones for select to authenticated using(private.rrhh_partidas_permiso(empresa,obra_id,'ver'));

-- Resolves the existing daily charge, never creates a cost.
create function private.maquinaria_cargo_para_imputar(c text,w integer,e integer,d date)
returns table(equipo_id integer,fecha date,monto_real numeric,obra_liquidaciones_partidas jsonb)
language plpgsql stable security definer set search_path='' as $$
declare r record; p record; decision record; obra_nombre text; amount numeric;
begin
 if auth.uid() is null or not private.rrhh_partidas_permiso(c,w,'ver') then raise exception 'Sin acceso a la obra' using errcode='42501'; end if;
 select nombre into obra_nombre from public.obras where id=w and empresa=c;
 select src.* into p from public.maquinaria_periodos_costo src where src.empresa=c and src.equipo_id=e and src.desde<=d and (src.hasta is null or d<src.hasta) order by src.desde desc,src.id desc limit 1;
 select src.* into r from public.maquinaria_uso_diario src where src.empresa=c and src.equipo_id=e::text and src.fecha=d order by coalesce(src.cargo_decidido_at,src.created_at) desc,src.id desc limit 1;
 if r.id is not null then
  if (r.cargo_obra_id is not null and r.cargo_obra_id<>w) or (r.cargo_obra_id is null and coalesce(r.obra_cargo_diario,r.obra_nombre) is distinct from obra_nombre) then return; end if;
  amount:=coalesce(r.tarifa_diaria_aplicada,p.tarifa);
 else
  if p.id is null or p.obra_id<>w or extract(isodow from d)>5 then return; end if;
  if exists(select 1 from public.maquinaria_decisiones_costo dc join public.maquinaria_periodos_costo old on old.id=dc.periodo_id
    where dc.empresa=c and dc.equipo_id=e and dc.tipo='retiro' and dc.fecha<=d and coalesce(old.asignacion_id,old.id)=coalesce(p.asignacion_id,p.id)) then return; end if;
  amount:=p.tarifa;
 end if;
 select src.* into decision from public.maquinaria_decisiones_costo src where src.empresa=c and src.equipo_id=e and src.fecha=d and src.obra_id=w;
 if decision.tipo='no_uso' then return; end if;
 if decision.tipo='confirmar' then amount:=decision.monto; end if;
 if amount is null or amount<=0 then raise exception 'El equipo no tiene un costo válido para imputar'; end if;
 return query select e,d,amount,'[]'::jsonb;
end $$;
revoke all on function private.maquinaria_cargo_para_imputar(text,integer,integer,date) from public,anon,authenticated;
create function private.maquinaria_guardar_partidas(p_empresa text,p_obra integer,p_cargo text,p_version integer,p_monto numeric,p_distribucion jsonb,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b record; previo public.maquinaria_partidas_decisiones; detalle jsonb; evento jsonb; accion text; total numeric; actor_nombre text;
begin
 if auth.uid() is null or not private.rrhh_partidas_permiso(p_empresa,p_obra,'ver') then raise exception 'Sin acceso a la obra' using errcode='42501'; end if;
 select * into b from private.maquinaria_cargo_para_imputar(p_empresa,p_obra,split_part(p_cargo,':',1)::integer,split_part(p_cargo,':',2)::date);
 if not found or b.fecha>(now() at time zone 'America/Santiago')::date then raise exception 'Cargo inexistente o futuro'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_empresa||':'||p_obra||':'||b.equipo_id||':'||b.fecha,0));
 select * into previo from public.maquinaria_partidas_decisiones where empresa=p_empresa and obra_id=p_obra and equipo_id=b.equipo_id and fecha=b.fecha for update;
 accion:=case when coalesce(previo.version,0)>0 or jsonb_array_length(b.obra_liquidaciones_partidas)>0 then 'editar' else 'aprobar' end;
 if not private.rrhh_partidas_permiso(p_empresa,p_obra,accion) then raise exception 'Solo Administrador de Empresa o Administrador de Contratos puede editar o aprobar' using errcode='42501'; end if;
 if p_version is distinct from coalesce(previo.version,0) or p_monto is distinct from b.monto_real then raise exception 'El cargo cambió. Actualiza y revisa antes de guardar'; end if;
 if length(btrim(coalesce(p_motivo,'')))<5 or length(p_motivo)>1000 then raise exception 'Indica un motivo entre 5 y 1000 caracteres'; end if;
 if p_distribucion is null or jsonb_typeof(p_distribucion)<>'array' or jsonb_array_length(p_distribucion) not between 1 and 100 then raise exception 'Selecciona partidas y porcentajes'; end if;
 if exists(select 1 from jsonb_array_elements(p_distribucion) x where jsonb_typeof(x->'partida_id') is distinct from 'number' or jsonb_typeof(x->'porcentaje') is distinct from 'number') then raise exception 'Formato de distribución inválido'; end if;
 if exists(select 1 from jsonb_array_elements(p_distribucion) x where (x->>'porcentaje')::numeric<=0 or (x->>'porcentaje')::numeric>100)
 or (select count(distinct (x->>'partida_id')::integer) from jsonb_array_elements(p_distribucion) x)<>jsonb_array_length(p_distribucion) then raise exception 'Porcentajes inválidos o partidas repetidas'; end if;
 select sum((x->>'porcentaje')::numeric) into total from jsonb_array_elements(p_distribucion) x;
 if total<>100 then raise exception 'Los porcentajes deben sumar 100'; end if;
 select jsonb_agg(jsonb_build_object('partida_id',p.id,'partida',p.partida,'porcentaje',(x->>'porcentaje')::numeric) order by p.id) into detalle
 from jsonb_array_elements(p_distribucion) x join public.partidas_obra p on p.id=(x->>'partida_id')::integer
 where p.empresa=p_empresa and p.obra_id=p_obra and not coalesce(p.es_titulo,false) and coalesce(p.unidad,'') not in ('TITULO','GRUPO');
 if coalesce(jsonb_array_length(detalle),0)<>jsonb_array_length(p_distribucion) then raise exception 'Hay partidas que no pertenecen a esta obra'; end if;
 select nombre into actor_nombre from public.usuarios where auth_user_id=auth.uid() and empresa=p_empresa limit 1;
 evento:=jsonb_build_object('fecha',now(),'actor',auth.uid(),'responsable',actor_nombre,'accion',accion,'motivo',btrim(p_motivo),
 'costo_al_aprobar',b.monto_real,'anterior',coalesce(previo.distribucion,b.obra_liquidaciones_partidas),'nueva',detalle);
 insert into public.maquinaria_partidas_decisiones(empresa,obra_id,equipo_id,fecha,distribucion,motivo,version,actualizado_por,historial)
 values(p_empresa,p_obra,b.equipo_id,b.fecha,detalle,btrim(p_motivo),1,auth.uid(),jsonb_build_array(evento))
 on conflict(empresa,obra_id,equipo_id,fecha) do update set distribucion=excluded.distribucion,motivo=excluded.motivo,
 version=maquinaria_partidas_decisiones.version+1,actualizado_por=auth.uid(),actualizado_en=now(),historial=maquinaria_partidas_decisiones.historial||jsonb_build_array(evento);
 return jsonb_build_object('guardado',true,'version',coalesce(previo.version,0)+1);
end $$;
revoke all on function private.maquinaria_guardar_partidas(text,integer,text,integer,numeric,jsonb,text) from public,anon;
grant execute on function private.maquinaria_guardar_partidas(text,integer,text,integer,numeric,jsonb,text) to authenticated;
create function public.guardar_imputacion_maquinaria_partidas(p_empresa text,p_obra integer,p_cargo text,p_version integer,p_monto numeric,p_distribucion jsonb,p_motivo text)
returns jsonb language sql security invoker set search_path='' as $$
 select private.maquinaria_guardar_partidas(p_empresa,p_obra,p_cargo,p_version,p_monto,p_distribucion,p_motivo);
$$;
revoke all on function public.guardar_imputacion_maquinaria_partidas(text,integer,text,integer,numeric,jsonb,text) from public,anon;
grant execute on function public.guardar_imputacion_maquinaria_partidas(text,integer,text,integer,numeric,jsonb,text) to authenticated;
notify pgrst,'reload schema';


