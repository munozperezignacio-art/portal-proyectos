-- Propuestas diarias independientes de las liquidaciones y de la asistencia salarial.
alter table public.maestro_personal add column if not exists centro_gestion_defecto_id integer
  references public.facturacion_centros_gestion(id);
create index if not exists maestro_personal_centro_defecto_idx on public.maestro_personal(centro_gestion_defecto_id);

create or replace function private.rrhh_validar_centro_defecto()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.centro_gestion_defecto_id is not null and not exists(select 1 from public.facturacion_centros_gestion c
    where c.id=new.centro_gestion_defecto_id and c.empresa=new.empresa and c.activo) then
    raise exception 'El centro predeterminado debe estar activo y pertenecer a la empresa'; end if;
  return new;
end; $$;
revoke all on function private.rrhh_validar_centro_defecto() from public,anon,authenticated;
create trigger rrhh_valida_centro_defecto before insert or update of centro_gestion_defecto_id,empresa on public.maestro_personal
for each row execute function private.rrhh_validar_centro_defecto();

create table public.rrhh_imputaciones_diarias (
  id bigint generated always as identity primary key,
  empresa text not null,
  trabajador_id integer not null references public.maestro_personal(id),
  fecha date not null,
  origen text not null,
  evidencia jsonb not null,
  centro_propuesto_id integer references public.facturacion_centros_gestion(id),
  centro_aprobado_id integer references public.facturacion_centros_gestion(id),
  estado text not null default 'Pendiente' check(estado in ('Pendiente','Aprobada')),
  aprobado_por uuid,
  aprobado_en timestamptz,
  comentario text,
  historial jsonb not null default '[]',
  unique(empresa,trabajador_id,fecha),
  check(estado <> 'Aprobada' or (centro_aprobado_id is not null and aprobado_por is not null and aprobado_en is not null))
);
create index rrhh_imputaciones_fecha_idx on public.rrhh_imputaciones_diarias(empresa,fecha,estado);
create index rrhh_imputaciones_trabajador_idx on public.rrhh_imputaciones_diarias(trabajador_id);
create index rrhh_imputaciones_propuesto_idx on public.rrhh_imputaciones_diarias(centro_propuesto_id);
create index rrhh_imputaciones_aprobado_idx on public.rrhh_imputaciones_diarias(centro_aprobado_id);
alter table public.rrhh_imputaciones_diarias enable row level security;
revoke all on public.rrhh_imputaciones_diarias from anon,authenticated;
grant select on public.rrhh_imputaciones_diarias to authenticated;

-- Centraliza autorización con permisos explícitos del rol y del usuario.
create or replace function private.rrhh_imputaciones_permiso(p_empresa text,p_accion text)
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and private.obraxis_actor_can_access_company(p_empresa) and exists(
    select 1 from public.usuarios u left join public.roles r on r.empresa=u.empresa and r.nombre=u.rol
    cross join lateral (select coalesce(r.permisos,'{}'::jsonb)||coalesce(u.permisos,'{}'::jsonb) permisos,
      lower(coalesce(u.rol_base,r.rol_base,u.rol,'')) rol) e
    where u.auth_user_id=auth.uid() and (u.empresa=p_empresa or (u.empresa='Obraxis' and e.rol in ('superusuario','superadmin')))
    and case when e.rol in ('superusuario','superadmin') then true
      when e.permisos ? ('rrhh.imputaciones.'||p_accion) then (e.permisos->>('rrhh.imputaciones.'||p_accion))='true'
      when e.rol like '%admin%' or e.rol like '%gerencia%' then true
      when e.rol like '%jefe%' or e.rol like '%profesional%' or e.rol like '%creador%' then p_accion <> 'aprobar'
      when e.rol like '%revisor%' or e.rol like '%supervisor%' then p_accion in ('ver','aprobar')
      else p_accion='ver' end);
$$;
revoke all on function private.rrhh_imputaciones_permiso(text,text) from public,anon;
grant execute on function private.rrhh_imputaciones_permiso(text,text) to authenticated;
create policy imputaciones_lectura on public.rrhh_imputaciones_diarias for select to authenticated
using(private.rrhh_imputaciones_permiso(empresa,'ver'));

create or replace function private.rrhh_preparar_imputaciones(p_empresa text,p_periodo text)
returns integer language plpgsql security definer set search_path='' as $$
declare v_inicio date; v_fin date; v_total integer;
begin
  if not private.rrhh_imputaciones_permiso(p_empresa,'editar') and not private.rrhh_imputaciones_permiso(p_empresa,'aprobar') then
    raise exception 'Sin permiso para preparar imputaciones'; end if;
  if p_periodo !~ '^\d{4}-\d{2}$' then raise exception 'Período inválido'; end if;
  v_inicio := (p_periodo||'-01')::date; v_fin := (v_inicio+interval '1 month - 1 day')::date;
  perform pg_advisory_xact_lock(hashtextextended(p_empresa||p_periodo, 0));
  with dias as (
    select p.*, d::date fecha from public.maestro_personal p
    cross join generate_series(v_inicio,v_fin,interval '1 day') d
    where p.empresa=p_empresa and lower(coalesce(to_jsonb(p)->>'estado','Activo')) <> 'inactivo'
      and d::date >= coalesce(p.fecha_inicio_contrato,v_inicio)
      and d::date <= coalesce(p.fecha_vencimiento_contrato,v_fin)
  ), propuestas as (
    select d.id trabajador_id,d.fecha,
      case when a.obras>1 then 'Múltiples obras' when a.obras=1 then 'Asistencia' else 'Sin asistencia' end origen,
      jsonb_build_object('marcas',coalesce(a.marcas,'[]'::jsonb),'defecto',d.centro_gestion_defecto_id) evidencia,
      case when a.obras=1 then a.centro when a.obras=0 then c.id else null end centro
    from dias d
    left join public.facturacion_centros_gestion c on c.id=d.centro_gestion_defecto_id and c.empresa=p_empresa and c.activo
    cross join lateral (
      select count(distinct a.obra_id) filter(where upper(coalesce(a.asistencia,''))='PRESENTE') obras,
        min(o.centro_gestion_id) filter(where upper(coalesce(a.asistencia,''))='PRESENTE') centro,
        jsonb_agg(jsonb_build_array(a.id,a.obra_id,a.asistencia,o.centro_gestion_id) order by a.id) marcas
      from public.asistencia_personal a left join public.obras o on o.id=a.obra_id and o.empresa=p_empresa
      where a.empresa=p_empresa and a.fecha_marcacion=d.fecha
        and upper(regexp_replace(coalesce(a.rut_normalizado,a.rut,''),'[^0-9kK]','','g'))=
            upper(regexp_replace(coalesce(d.rut,''),'[^0-9kK]','','g'))
        and coalesce(d.rut,'')<>''
    ) a
    where extract(isodow from d.fecha)<=5 or a.obras>0
  )
  insert into public.rrhh_imputaciones_diarias as t(empresa,trabajador_id,fecha,origen,evidencia,centro_propuesto_id)
  select p_empresa,trabajador_id,fecha,origen,evidencia,centro from propuestas
  on conflict(empresa,trabajador_id,fecha) do update set origen=excluded.origen,evidencia=excluded.evidencia,
    centro_propuesto_id=excluded.centro_propuesto_id,estado='Pendiente',centro_aprobado_id=null,aprobado_por=null,aprobado_en=null,
    historial=t.historial||jsonb_build_array(jsonb_build_object('accion','Evidencia actualizada; requiere revisión','fecha',now(),'actor',auth.uid(),'centro_anterior',t.centro_aprobado_id))
  where t.evidencia is distinct from excluded.evidencia or t.centro_propuesto_id is distinct from excluded.centro_propuesto_id;
  get diagnostics v_total=row_count;
  return v_total;
end; $$;
revoke all on function private.rrhh_preparar_imputaciones(text,text) from public,anon;
grant execute on function private.rrhh_preparar_imputaciones(text,text) to authenticated;
create or replace function public.preparar_imputaciones_personal(p_empresa text,p_periodo text)
returns integer language sql security invoker set search_path='' as $$ select private.rrhh_preparar_imputaciones(p_empresa,p_periodo); $$;
revoke all on function public.preparar_imputaciones_personal(text,text) from public,anon;
grant execute on function public.preparar_imputaciones_personal(text,text) to authenticated;

create or replace function private.rrhh_aprobar_imputaciones(p_empresa text,p_decisiones jsonb)
returns integer language plpgsql security definer set search_path='' as $$
declare d jsonb; r public.rrhh_imputaciones_diarias; v_centro integer; v_count integer:=0; v_periodo text;
begin
  if not private.rrhh_imputaciones_permiso(p_empresa,'aprobar') then raise exception 'Sin permiso para aprobar imputaciones'; end if;
  if jsonb_typeof(p_decisiones)<>'array' or jsonb_array_length(p_decisiones) not between 1 and 1000 then raise exception 'Seleccione entre 1 y 1000 registros'; end if;
  for v_periodo in select distinct to_char(t.fecha,'YYYY-MM') from public.rrhh_imputaciones_diarias t
    join jsonb_array_elements(p_decisiones) x on t.id=(x->>'id')::bigint where t.empresa=p_empresa order by 1
  loop perform private.rrhh_preparar_imputaciones(p_empresa,v_periodo); end loop;
  for d in select * from jsonb_array_elements(p_decisiones) loop
    select * into r from public.rrhh_imputaciones_diarias where id=(d->>'id')::bigint and empresa=p_empresa for update;
    if not found then raise exception 'Imputación no encontrada o sin acceso'; end if;
    if r.evidencia is distinct from d->'evidencia' then raise exception 'Cambió la asistencia o el centro predeterminado. Actualice y revise nuevamente.'; end if;
    v_centro := (d->>'centro_id')::integer;
    if not exists(select 1 from public.facturacion_centros_gestion c where c.id=v_centro and c.empresa=p_empresa and c.activo) then raise exception 'Centro inválido o inactivo'; end if;
    if (select count(*) from public.obras o where o.empresa=p_empresa and o.centro_gestion_id=v_centro)>1 then raise exception 'El centro está asociado a más de una obra; corrija su configuración'; end if;
    if (v_centro is distinct from r.centro_propuesto_id or r.origen='Múltiples obras') and length(btrim(coalesce(d->>'comentario','')))<3 then raise exception 'Indique el motivo de la reasignación'; end if;
    update public.rrhh_imputaciones_diarias set estado='Aprobada',centro_aprobado_id=v_centro,aprobado_por=auth.uid(),aprobado_en=now(),comentario=d->>'comentario',
      historial=historial||jsonb_build_array(jsonb_build_object('accion','Aprobada','fecha',now(),'actor',auth.uid(),'centro',v_centro,'centro_anterior',r.centro_aprobado_id,'comentario',d->>'comentario'))
    where id=r.id;
    v_count:=v_count+1;
  end loop;
  return v_count;
end; $$;
revoke all on function private.rrhh_aprobar_imputaciones(text,jsonb) from public,anon;
grant execute on function private.rrhh_aprobar_imputaciones(text,jsonb) to authenticated;
create or replace function public.aprobar_imputaciones_personal(p_empresa text,p_decisiones jsonb)
returns integer language sql security invoker set search_path='' as $$ select private.rrhh_aprobar_imputaciones(p_empresa,p_decisiones); $$;
revoke all on function public.aprobar_imputaciones_personal(text,jsonb) from public,anon;
grant execute on function public.aprobar_imputaciones_personal(text,jsonb) to authenticated;

-- Una marca tardía no debe conservar una aprobación basada en evidencia anterior.
create or replace function private.rrhh_invalidar_imputacion_asistencia()
returns trigger language plpgsql security definer set search_path='' as $$
declare v record;
begin
  for v in select empresa,fecha_marcacion,rut from (
    select old.empresa,old.fecha_marcacion,old.rut where TG_OP<>'INSERT'
    union select new.empresa,new.fecha_marcacion,new.rut where TG_OP<>'DELETE'
  ) x loop
    perform pg_advisory_xact_lock(hashtextextended(v.empresa||to_char(v.fecha_marcacion,'YYYY-MM'),0));
    update public.rrhh_imputaciones_diarias t set estado='Pendiente',evidencia='{"invalidada":true}',
      centro_aprobado_id=null,aprobado_por=null,aprobado_en=null,
      historial=historial||jsonb_build_array(jsonb_build_object('accion','Asistencia modificada; revisar y recalcular costos','fecha',now(),'actor',auth.uid(),'centro_anterior',t.centro_aprobado_id))
    from public.maestro_personal p where t.trabajador_id=p.id and t.empresa=v.empresa and t.fecha=v.fecha_marcacion
      and coalesce(v.rut,'')<>'' and upper(regexp_replace(coalesce(p.rut,''),'[^0-9kK]','','g'))=upper(regexp_replace(v.rut,'[^0-9kK]','','g'));
  end loop;
  return null;
end; $$;
revoke all on function private.rrhh_invalidar_imputacion_asistencia() from public,anon,authenticated;
create trigger rrhh_invalida_imputacion after insert or update or delete on public.asistencia_personal
for each row execute function private.rrhh_invalidar_imputacion_asistencia();

create table public.rrhh_costos_centros_aprobados (
  nomina_id bigint not null references public.rrhh_nominas_mensuales(id),
  nomina_item_id bigint not null references public.rrhh_nomina_items(id),
  empresa text not null,
  centro_gestion_id integer not null references public.facturacion_centros_gestion(id),
  dias numeric not null, monto numeric not null,
  distribuido_por uuid not null, distribuido_en timestamptz not null default now(),
  primary key(nomina_item_id,centro_gestion_id)
);
create index rrhh_costos_centros_nomina_idx on public.rrhh_costos_centros_aprobados(nomina_id);
create index rrhh_costos_centros_centro_idx on public.rrhh_costos_centros_aprobados(centro_gestion_id);
alter table public.rrhh_costos_centros_aprobados enable row level security;
revoke all on public.rrhh_costos_centros_aprobados from anon,authenticated;
grant select on public.rrhh_costos_centros_aprobados to authenticated;
create policy costos_centros_lectura on public.rrhh_costos_centros_aprobados for select to authenticated using(private.rrhh_imputaciones_permiso(empresa,'ver'));

-- Distribución transaccional: únicamente la nómina seleccionada y liquidaciones automáticas.
create or replace function private.rrhh_distribuir_nomina_aprobada(p_nomina_id bigint)
returns jsonb language plpgsql security definer set search_path=public,pg_temp as $$
declare n public.rrhh_nominas_mensuales; v_pendientes integer; v_total integer; v_partidas jsonb;
begin
  select * into n from public.rrhh_nominas_mensuales where id=p_nomina_id for update;
  if not found or not private.rrhh_imputaciones_permiso(n.empresa,'aprobar') then raise exception 'Nómina no encontrada o sin permiso para distribuir costos'; end if;
  if n.estado not in ('Cerrada','Pagada') then raise exception 'Cierre la nómina antes de distribuir costos'; end if;
  perform private.rrhh_preparar_imputaciones(n.empresa,n.periodo);
  select count(*) into v_pendientes from public.rrhh_imputaciones_diarias t
    join public.rrhh_nomina_items i on i.trabajador_id=t.trabajador_id and i.nomina_id=n.id
    left join public.facturacion_centros_gestion c on c.id=t.centro_aprobado_id and c.empresa=n.empresa and c.activo
    where t.empresa=n.empresa and to_char(t.fecha,'YYYY-MM')=n.periodo and (t.estado<>'Aprobada' or c.id is null);
  if v_pendientes>0 then return jsonb_build_object('pendientes',v_pendientes,'distribuida',false); end if;
  if exists(select 1 from public.rrhh_nomina_items i where i.nomina_id=n.id and not exists(
    select 1 from public.rrhh_imputaciones_diarias t where t.empresa=n.empresa and t.trabajador_id=i.trabajador_id and to_char(t.fecha,'YYYY-MM')=n.periodo and t.estado='Aprobada')) then
    raise exception 'Existen trabajadores de la nómina sin días aprobados'; end if;
  if exists(select 1 from public.rrhh_imputaciones_diarias t join public.obras o on o.centro_gestion_id=t.centro_aprobado_id and o.empresa=n.empresa
    where t.empresa=n.empresa and to_char(t.fecha,'YYYY-MM')=n.periodo group by t.id having count(*)>1) then raise exception 'Hay centros vinculados a múltiples obras'; end if;
  delete from public.obra_liquidaciones_partidas where nomina_id=n.id and nomina_item_id is not null;
  delete from public.obra_liquidaciones where nomina_id=n.id and nomina_item_id is not null;
  delete from public.rrhh_costos_centros_aprobados where nomina_id=n.id;
  with bases as (
    select i.id item_id,i.trabajador_id,i.trabajador_nombre,t.centro_aprobado_id,c.nombre centro_nombre,
      o.id obra_id,o.nombre obra_nombre,count(*)::numeric dias,
      greatest(0,round(coalesce(nullif(i.calculo->>'employerCost','')::numeric,nullif(i.calculo->>'totalAssets','')::numeric,i.sueldo_liquido,0))) monto
    from public.rrhh_nomina_items i join public.rrhh_imputaciones_diarias t on t.trabajador_id=i.trabajador_id and t.empresa=n.empresa and to_char(t.fecha,'YYYY-MM')=n.periodo and t.estado='Aprobada'
    join public.facturacion_centros_gestion c on c.id=t.centro_aprobado_id and c.empresa=n.empresa
    left join public.obras o on o.centro_gestion_id=c.id and o.empresa=n.empresa
    where i.nomina_id=n.id group by i.id,t.centro_aprobado_id,c.nombre,o.id,o.nombre
  ), pesos as (
    select b.*,sum(dias) over(partition by item_id) total_dias,
      floor(monto*dias/sum(dias) over(partition by item_id)) base,
      row_number() over(partition by item_id order by dias desc,centro_aprobado_id) orden from bases b
  ), ajuste as (select p.*,monto-sum(base) over(partition by item_id) residuo from pesos p)
  insert into public.rrhh_costos_centros_aprobados(nomina_id,nomina_item_id,empresa,centro_gestion_id,dias,monto,distribuido_por)
  select n.id,item_id,n.empresa,centro_aprobado_id,dias,base+case when orden<=residuo then 1 else 0 end,auth.uid() from ajuste;
  insert into public.obra_liquidaciones(empresa,obra_id,obra_nombre,trabajador,periodo,num_folio,monto_real,partida,nomina_id,nomina_item_id,trabajador_id,monto_liquidacion_total,dias_imputados,porcentaje_imputacion,criterio_imputacion)
  select n.empresa,o.id,o.nombre,i.trabajador_nombre,n.periodo,'NOM-'||n.id||'-'||i.id,
    c.monto,'Gastos Generales',n.id,i.id,i.trabajador_id,
    greatest(0,round(coalesce(nullif(i.calculo->>'employerCost','')::numeric,nullif(i.calculo->>'totalAssets','')::numeric,i.sueldo_liquido,0))),
    c.dias,round(c.dias*100/(select sum(x.dias) from public.rrhh_costos_centros_aprobados x where x.nomina_item_id=i.id),4),
    'Días aprobados · centro '||c.centro_gestion_id
  from public.rrhh_costos_centros_aprobados c join public.rrhh_nomina_items i on i.id=c.nomina_item_id
  join public.obras o on o.centro_gestion_id=c.centro_gestion_id and o.empresa=n.empresa where c.nomina_id=n.id;
  get diagnostics v_total=row_count;
  v_partidas:=public.distribuir_nomina_partidas_por_asistencia(n.id);
  return jsonb_build_object('distribuida',true,'imputaciones_obras',v_total)||v_partidas;
end; $$;
revoke all on function private.rrhh_distribuir_nomina_aprobada(bigint) from public,anon;
grant execute on function private.rrhh_distribuir_nomina_aprobada(bigint) to authenticated;
create or replace function public.distribuir_nomina_a_obras(p_nomina_id bigint)
returns jsonb language sql security invoker set search_path='' as $$ select private.rrhh_distribuir_nomina_aprobada(p_nomina_id); $$;
-- El antiguo punto de entrada no puede saltarse la aprobación.
create or replace function public.distribuir_nomina_a_obras_base(p_nomina_id bigint)
returns jsonb language sql security invoker set search_path='' as $$ select public.distribuir_nomina_a_obras(p_nomina_id); $$;
revoke all on function public.distribuir_nomina_a_obras(bigint), public.distribuir_nomina_a_obras_base(bigint) from public,anon;
grant execute on function public.distribuir_nomina_a_obras(bigint), public.distribuir_nomina_a_obras_base(bigint) to authenticated;
notify pgrst,'reload schema';

-- El detalle por partida consume los mismos días aprobados, incluidas reasignaciones.
create or replace function public.distribuir_nomina_partidas_por_asistencia(p_nomina_id bigint)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare n public.rrhh_nominas_mensuales; v_total integer; v_generales integer;
begin
  select * into n from public.rrhh_nominas_mensuales where id=p_nomina_id and estado in ('Cerrada','Pagada');
  if not found or not private.rrhh_imputaciones_permiso(n.empresa,'aprobar') then raise exception 'Nómina no encontrada o sin permiso'; end if;
  if exists(select 1 from public.rrhh_imputaciones_diarias t join public.rrhh_nomina_items i on i.trabajador_id=t.trabajador_id
    where i.nomina_id=n.id and t.empresa=n.empresa and to_char(t.fecha,'YYYY-MM')=n.periodo and t.estado<>'Aprobada') then raise exception 'Hay imputaciones pendientes'; end if;
  delete from public.obra_liquidaciones_partidas where nomina_id=n.id and nomina_item_id is not null;
  with liquidaciones as (
    select l.* from public.obra_liquidaciones l where l.nomina_id=n.id and l.nomina_item_id is not null and l.empresa=n.empresa
  ), dias as (
    select l.id liquidacion_id,t.fecha from liquidaciones l
    join public.obras o on o.id=l.obra_id and o.empresa=n.empresa
    join public.rrhh_imputaciones_diarias t on t.trabajador_id=l.trabajador_id and t.empresa=n.empresa
      and t.centro_aprobado_id=o.centro_gestion_id and t.estado='Aprobada' and to_char(t.fecha,'YYYY-MM')=n.periodo
  ), partidas_dia as (
    select distinct d.liquidacion_id,d.fecha,a.partida_id,a.partida,a.cuadrilla_id,a.cuadrilla_nombre
    from dias d join liquidaciones l on l.id=d.liquidacion_id
    join public.avances_produccion_partidas a on a.empresa=n.empresa and a.obra_id=l.obra_id
      and (a.created_at at time zone 'America/Santiago')::date=d.fecha and a.cuadrilla_id is not null
      and exists(select 1 from jsonb_array_elements_text(a.cuadrilla_miembros) miembro where lower(btrim(miembro))=lower(btrim(l.trabajador)))
  ), pesos_dia as (
    select p.*,1.0/count(*) over(partition by liquidacion_id,fecha) peso from partidas_dia p
  ), bases as (
    select liquidacion_id,partida_id,partida,cuadrilla_id,cuadrilla_nombre,sum(peso)::numeric ponderador from pesos_dia
    group by liquidacion_id,partida_id,partida,cuadrilla_id,cuadrilla_nombre
    union all
    select d.liquidacion_id,null::integer,'Gastos Generales de Obra',null::bigint,null::text,count(*)::numeric
    from dias d where not exists(select 1 from partidas_dia p where p.liquidacion_id=d.liquidacion_id and p.fecha=d.fecha) group by d.liquidacion_id
  ), calculos as (
    select l.*,b.partida_id,b.partida nombre_partida,b.cuadrilla_id,b.cuadrilla_nombre,b.ponderador,
      sum(b.ponderador) over(partition by l.id) total_peso,
      floor(l.monto_real*b.ponderador/sum(b.ponderador) over(partition by l.id)) base,
      row_number() over(partition by l.id order by b.ponderador desc,b.partida,b.cuadrilla_id) orden
    from liquidaciones l join bases b on b.liquidacion_id=l.id
  ), ajustes as (select c.*,monto_real-sum(base) over(partition by id) residuo from calculos c)
  insert into public.obra_liquidaciones_partidas(empresa,liquidacion_id,nomina_id,nomina_item_id,trabajador_id,obra_id,partida_id,partida,cuadrilla_id,cuadrilla_nombre,monto_imputado,porcentaje_imputacion,ponderador,criterio)
  select empresa,id,nomina_id,nomina_item_id,trabajador_id,obra_id,partida_id,nombre_partida,cuadrilla_id,cuadrilla_nombre,
    base+case when orden<=residuo then 1 else 0 end,round(ponderador*100/total_peso,4),ponderador,
    case when partida_id is null then 'Día aprobado sin avance vinculable' else 'Días aprobados y avances de cuadrilla' end from ajustes;
  get diagnostics v_total=row_count;
  update public.obra_liquidaciones l set partida=d.partida from (
    select liquidacion_id,case when count(*)=1 then min(partida) else count(*)||' partidas según días aprobados' end partida
    from public.obra_liquidaciones_partidas where nomina_id=n.id and nomina_item_id is not null group by liquidacion_id
  ) d where l.id=d.liquidacion_id and l.nomina_id=n.id and l.nomina_item_id is not null;
  select count(*) into v_generales from public.obra_liquidaciones_partidas where nomina_id=n.id and nomina_item_id is not null and partida_id is null;
  return jsonb_build_object('imputaciones_partidas',v_total,'imputaciones_sin_partida',v_generales);
end; $$;
revoke all on function public.distribuir_nomina_partidas_por_asistencia(bigint) from public,anon;
grant execute on function public.distribuir_nomina_partidas_por_asistencia(bigint) to authenticated;
