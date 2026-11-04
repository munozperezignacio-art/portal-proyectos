create table public.rrhh_partidas_decisiones (
 empresa text not null, obra_id integer not null references public.obras(id),
 trabajador_id integer not null references public.maestro_personal(id), fecha date not null,
 distribucion jsonb not null, motivo text not null, version integer not null default 1,
 actualizado_por uuid not null, actualizado_en timestamptz not null default now(),
 historial jsonb not null default '[]',
 primary key(empresa,obra_id,trabajador_id,fecha),
 check(jsonb_typeof(distribucion)='array' and jsonb_array_length(distribucion)>0),
 check(jsonb_typeof(historial)='array')
);
alter table public.rrhh_partidas_decisiones enable row level security;

create function private.rrhh_partidas_permiso(p_empresa text,p_obra integer,p_accion text)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and private.obraxis_actor_can_access_company(p_empresa) and exists(
 select 1 from public.usuarios u join public.obras o on o.id=p_obra and o.empresa=u.empresa
 left join public.roles r on r.empresa=u.empresa and r.nombre=u.rol
 where u.auth_user_id=auth.uid() and u.empresa=p_empresa
 and exists(select 1 from unnest(string_to_array(u.obras,',')) w where lower(btrim(w)) in ('todas',lower(o.nombre)))
 and (p_accion='ver' or (
   p_accion in ('editar','aprobar')
   and (lower(btrim(u.rol)) in ('administrador de empresa','administrador empresa','administrador de contratos','administrador de contrato')
     or lower(btrim(coalesce(u.rol_base,r.rol_base,''))) in ('administrador empresa','administrador de empresa','administrador de contratos','administrador de contrato'))
   and coalesce((coalesce(r.permisos,'{}'::jsonb)||coalesce(u.permisos,'{}'::jsonb))->>('rrhh.imputaciones.'||p_accion),'true')='true'
 ))
 );
$$;
revoke all on function private.rrhh_partidas_permiso(text,integer,text) from public,anon;
grant execute on function private.rrhh_partidas_permiso(text,integer,text) to authenticated;
create policy decisiones_lectura on public.rrhh_partidas_decisiones for select to authenticated
 using(private.rrhh_partidas_permiso(empresa,obra_id,'ver'));
revoke all on public.rrhh_partidas_decisiones from public,anon,authenticated;
grant select on public.rrhh_partidas_decisiones to authenticated;

-- La autorización del usuario habilita estos dos roles; no amplía otros roles.
update public.roles set permisos=coalesce(permisos,'{}'::jsonb)||'{"rrhh.imputaciones.editar":true,"rrhh.imputaciones.aprobar":true}'::jsonb
where empresa='EMINSG' and nombre in ('Administrador de Empresa','Administrador de Contratos');

alter view public.rrhh_costos_personal_vigentes rename to rrhh_costos_personal_automaticos;
create view public.rrhh_costos_personal_vigentes with(security_invoker=true) as
select b.id,b.empresa,b.trabajador_id,b.trabajador,b.fecha,b.centro_gestion_id,b.monto_real,b.nomina_id,b.nomina_item_id,
 b.fuente,b.desglose,b.obra_id,b.obra_nombre,b.periodo,
 coalesce(m.detalle,b.obra_liquidaciones_partidas) obra_liquidaciones_partidas,
 case when d.version is not null then 'Aprobada manualmente' else b.estado_imputacion_partidas end estado_imputacion_partidas,
 coalesce(d.version,0) version_imputacion,
 coalesce(d.historial,'[]'::jsonb) historial_imputacion
from public.rrhh_costos_personal_automaticos b
left join public.rrhh_partidas_decisiones d on d.empresa=b.empresa and d.obra_id=b.obra_id and d.trabajador_id=b.trabajador_id and d.fecha=b.fecha
left join lateral(
 with factores as (
 select (x->>'partida_id')::integer partida_id,x->>'partida' partida,(x->>'porcentaje')::numeric/100 factor,
 row_number() over(order by (x->>'partida_id')::integer) orden,count(*) over() cantidad,
 sum((x->>'porcentaje')::numeric/100) over(order by (x->>'partida_id')::integer) acumulado
 from jsonb_array_elements(d.distribucion) x
 ), montos as (
 select *,case when orden=cantidad then b.monto_real else round(b.monto_real*acumulado,2) end
 -coalesce(lag(round(b.monto_real*acumulado,2)) over(order by partida_id),0) monto from factores
 )
 select jsonb_agg(jsonb_build_object('partida_id',partida_id,'partida',partida,'factor',factor,
 'monto_imputado',monto,'criterio','Distribución aprobada manualmente') order by partida_id) detalle from montos
) m on true;
revoke all on public.rrhh_costos_personal_vigentes from public,anon;
grant select on public.rrhh_costos_personal_vigentes to authenticated;

create function public.permisos_imputaciones_personal_obra(p_empresa text,p_obra integer)
returns jsonb language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('ver',private.rrhh_partidas_permiso(p_empresa,p_obra,'ver'),
 'editar',private.rrhh_partidas_permiso(p_empresa,p_obra,'editar'),
 'aprobar',private.rrhh_partidas_permiso(p_empresa,p_obra,'aprobar'));
$$;
revoke all on function public.permisos_imputaciones_personal_obra(text,integer) from public,anon;
grant execute on function public.permisos_imputaciones_personal_obra(text,integer) to authenticated;

create function private.rrhh_guardar_partidas(p_empresa text,p_obra integer,p_cargo text,p_version integer,p_monto numeric,p_distribucion jsonb,p_motivo text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare b record; previo public.rrhh_partidas_decisiones; detalle jsonb; evento jsonb; accion text; total numeric; actor_nombre text;
begin
 if auth.uid() is null or not private.rrhh_partidas_permiso(p_empresa,p_obra,'ver') then raise exception 'Sin acceso a la obra' using errcode='42501'; end if;
 select * into b from public.rrhh_costos_personal_automaticos where empresa=p_empresa and obra_id=p_obra and id=p_cargo;
 if not found or b.fecha>(now() at time zone 'America/Santiago')::date then raise exception 'Cargo inexistente o futuro'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_empresa||':'||p_obra||':'||b.trabajador_id||':'||b.fecha,0));
 select * into previo from public.rrhh_partidas_decisiones where empresa=p_empresa and obra_id=p_obra and trabajador_id=b.trabajador_id and fecha=b.fecha for update;
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
 insert into public.rrhh_partidas_decisiones(empresa,obra_id,trabajador_id,fecha,distribucion,motivo,version,actualizado_por,historial)
 values(p_empresa,p_obra,b.trabajador_id,b.fecha,detalle,btrim(p_motivo),1,auth.uid(),jsonb_build_array(evento))
 on conflict(empresa,obra_id,trabajador_id,fecha) do update set distribucion=excluded.distribucion,motivo=excluded.motivo,
 version=rrhh_partidas_decisiones.version+1,actualizado_por=auth.uid(),actualizado_en=now(),historial=rrhh_partidas_decisiones.historial||jsonb_build_array(evento);
 return jsonb_build_object('guardado',true,'version',coalesce(previo.version,0)+1);
end $$;
revoke all on function private.rrhh_guardar_partidas(text,integer,text,integer,numeric,jsonb,text) from public,anon;
grant execute on function private.rrhh_guardar_partidas(text,integer,text,integer,numeric,jsonb,text) to authenticated;
create function public.guardar_imputacion_personal_partidas(p_empresa text,p_obra integer,p_cargo text,p_version integer,p_monto numeric,p_distribucion jsonb,p_motivo text)
returns jsonb language sql security invoker set search_path='' as $$
 select private.rrhh_guardar_partidas(p_empresa,p_obra,p_cargo,p_version,p_monto,p_distribucion,p_motivo);
$$;
revoke all on function public.guardar_imputacion_personal_partidas(text,integer,text,integer,numeric,jsonb,text) from public,anon;
grant execute on function public.guardar_imputacion_personal_partidas(text,integer,text,integer,numeric,jsonb,text) to authenticated;
notify pgrst,'reload schema';
