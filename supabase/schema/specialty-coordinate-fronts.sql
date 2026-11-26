-- Additive upgrade. Existing coordinates, reports and protocol snapshots stay unchanged.
begin;
alter table private.specialty_elements add column if not exists frente text;
-- A journal may produce one progress row per front, never two for the same front.
drop index if exists public.progress_specialty_session;
create unique index if not exists progress_specialty_session_front on public.avances_produccion_partidas(specialty_session_id,coalesce(frente,'Frente Principal')) where specialty_session_id is not null;
do $patch$
declare src text; old text; replacement text;
begin
 src:=pg_get_functiondef('private.specialty_api(integer,text,jsonb)'::regprocedure);
 if position('coordinate_fronts_v1' in src)>0 then return;end if;
 src:=replace(src,'original_input jsonb:=p_data;', 'coordinate_fronts_v1 text; front_name text; front_group record; original_input jsonb:=p_data;');
 src:=replace(src,'''elements'',coalesce(', $s$'fronts',coalesce((select jsonb_agg(f order by f) from (select distinct trim(frente) f from public.avances_produccion_partidas where obra_id=p_work and nullif(trim(frente),'') is not null union select distinct frente from private.specialty_elements where obra_id=p_work and frente is not null) fronts),'["Frente Principal"]'::jsonb),
   'elements',coalesce($s$);
 old:=$s$for x in select value from jsonb_array_elements(p_data->'rows') loop$s$;
 replacement:=old||$s$
   front_name:=nullif(trim(x->>'frente'),'');
   if front_name is not null and not (
    exists(select 1 from public.avances_produccion_partidas where obra_id=p_work and trim(frente)=front_name)
    or exists(select 1 from private.specialty_elements where obra_id=p_work and frente=front_name)
    or (front_name='Frente Principal' and not exists(select 1 from public.avances_produccion_partidas where obra_id=p_work and nullif(trim(frente),'') is not null))
   ) then raise exception 'El frente % no coincide con los reportes de esta obra. Selecciona un frente existente',front_name;end if;
   if nullif(trim(x->>'numero'),'') is null or nullif(trim(x->>'etapa'),'') is null or nullif(x->>'norte','') is null or nullif(x->>'este','') is null or x->>'norte' in ('NaN','Infinity','-Infinity') or x->>'este' in ('NaN','Infinity','-Infinity') then raise exception 'Número, etapa o coordenadas inválidos';end if;
   if exists(select 1 from jsonb_array_elements(p_data->'rows') r group by r->>'etapa',r->>'numero' having count(*)>1) then raise exception 'Hay pilas duplicadas en el archivo';end if;
$s$;
 if position(old in src)=0 then raise exception 'Catalog branch changed; review before upgrading';end if;
 src:=replace(src,old,replacement);
 src:=replace(src,'if el.norte<>','if (front_name is not null and el.frente is distinct from front_name) or el.norte<>');
 old:=$s$insert into private.specialty_elements(obra_id,partida_id,etapa,numero,norte,este,longitud_diseno) values(p_work,pid,x->>'etapa',x->>'numero',(x->>'norte')::numeric,(x->>'este')::numeric,nullif(x->>'longitud_diseno','')::numeric);$s$;
 replacement:=$s$insert into private.specialty_elements(obra_id,partida_id,etapa,numero,norte,este,longitud_diseno,frente) values(p_work,pid,x->>'etapa',x->>'numero',(x->>'norte')::numeric,(x->>'este')::numeric,nullif(x->>'longitud_diseno','')::numeric,front_name);$s$;
 if position(old in src)=0 then raise exception 'Catalog insert changed';end if;
 src:=replace(src,old,replacement);
 old:=$s$insert into public.avances_produccion_partidas(empresa,obra_id,obra_nombre,supervisor,partida_id,partida,unidad,cantidad,observaciones,created_at,specialty_session_id)
     values(w.empresa,p_work,w.nombre,coalesce(actor.nombre,actor.usuario),pid,part.partida,part.unidad,count_piles,p_data->'datos'->>'observaciones',((p_data->>'fecha')::date+time '12:00') at time zone 'America/Santiago',sid) returning id into rid;
    ids:=array[rid];$s$;
 replacement:=$s$ids:='{}';
    for front_group in select coalesce(e.frente,'Frente Principal') nombre,count(*) cantidad
     from jsonb_array_elements(p_data->'datos'->'pilas') j join private.specialty_elements e on e.id=(j->>'element_id')::uuid
     where coalesce((j->>'terminada')::boolean,false) group by coalesce(e.frente,'Frente Principal') loop
     insert into public.avances_produccion_partidas(empresa,obra_id,obra_nombre,supervisor,partida_id,partida,unidad,cantidad,observaciones,created_at,specialty_session_id,frente)
      values(w.empresa,p_work,w.nombre,coalesce(actor.nombre,actor.usuario),pid,part.partida,part.unidad,front_group.cantidad,p_data->'datos'->>'observaciones',((p_data->>'fecha')::date+time '12:00') at time zone 'America/Santiago',sid,front_group.nombre) returning id into rid;
     ids:=array_append(ids,rid);
    end loop;$s$;
 if position(old in src)=0 then raise exception 'Progress insert changed';end if;
 src:=replace(src,old,replacement);
 -- Reconciliation never changes reports and must match counts by front as well as day/part.
 old:=$s$else
    perform set_config('obraxis.specialty_write',sid::text,true);$s$;
 replacement:=$s$if exists(select 1 from jsonb_array_elements(p_data->'datos'->'pilas') j join private.specialty_elements e on e.id=(j->>'element_id')::uuid where e.frente is not null) and exists(
     select 1 from (
      select coalesce(e.frente,'Frente Principal') f,count(*)::numeric n from jsonb_array_elements(p_data->'datos'->'pilas') j join private.specialty_elements e on e.id=(j->>'element_id')::uuid where coalesce((j->>'terminada')::boolean,false) group by 1
     ) piles full join (
      select coalesce(nullif(trim(frente),''),'Frente Principal') f,sum(cantidad) n from public.avances_produccion_partidas where id=any(ids) group by 1
     ) reports using(f) where piles.n is distinct from reports.n
    ) then raise exception 'Los frentes y cantidades de las pilas no coinciden con los reportes. No se modificó el avance';end if;
   else
    perform set_config('obraxis.specialty_write',sid::text,true);$s$;
 if position(old in src)=0 then raise exception 'Reconciliation branch changed';end if;
 src:=replace(src,old,replacement);
 src:=replace(src,'Configura primero el detalle por pila en Configuración → Especialidades de obra. El reporte normal sigue disponible','Configura primero el detalle por pila en esta obra → Avance por especialidad → Configurar especialidad y cargar coordenadas. El reporte normal sigue disponible');
 execute src;
end $patch$;
commit;
