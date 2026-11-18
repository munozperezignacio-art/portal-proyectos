begin;
-- Read-only assignment lookup. Not callable by public QR visitors directly.
create function public.equipo_obras_fecha(p_equipo integer,p_fecha date) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',w.id,'nombre',w.nombre,'centro_gestion_id',w.centro_gestion_id) order by w.nombre),'[]'::jsonb)
 from public.inventario_maquinaria e join public.obras w on w.empresa=e.empresa
 where e.id=p_equipo and (
 exists(select 1 from public.maquinaria_periodos_costo p where p.empresa=e.empresa and p.equipo_id=e.id and p.obra_id=w.id and p.desde<=p_fecha and (p.hasta is null or p_fecha<p.hasta))
 or (w.nombre=e.obra_nombre and coalesce(e.fecha_asig,e.created_at::date)<=p_fecha and not exists(select 1 from public.maquinaria_periodos_costo p where p.empresa=e.empresa and p.equipo_id=e.id)));
$$;
revoke all on function public.equipo_obras_fecha(integer,date) from public,anon,authenticated;
grant execute on function public.equipo_obras_fecha(integer,date) to service_role;

create function private.equipo_obra_registro(p_equipo integer,p_fecha date,p_obra bigint) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare choices jsonb; chosen jsonb;
begin
 if p_fecha is null or p_fecha>(now() at time zone 'America/Santiago')::date then raise exception 'Fecha de registro inválida'; end if;
 choices:=public.equipo_obras_fecha(p_equipo,p_fecha);
 if jsonb_array_length(choices)=0 then
  if p_obra is not null then raise exception 'El equipo no está asignado a esa obra en la fecha indicada'; end if;
  return null;
 end if;
 if p_obra is null and jsonb_array_length(choices)=1 then return choices->0; end if;
 select value into chosen from jsonb_array_elements(choices) where (value->>'id')::bigint=p_obra;
 if chosen is null then raise exception 'Selecciona una de las obras asignadas al equipo para esta fecha'; end if;
 return chosen;
end;$$;
revoke all on function private.equipo_obra_registro(integer,date,bigint) from public,anon,authenticated;
grant execute on function private.equipo_obra_registro(integer,date,bigint) to service_role;
create function public.equipo_obra_registro(p_equipo integer,p_fecha date,p_obra bigint) returns jsonb
language sql security invoker set search_path='' as $$ select private.equipo_obra_registro(p_equipo,p_fecha,p_obra); $$;
revoke all on function public.equipo_obra_registro(integer,date,bigint) from public,anon,authenticated;
grant execute on function public.equipo_obra_registro(integer,date,bigint) to service_role;

-- Preserve existing validations, idempotency, permissions, and cost calculation.
-- Only callers supplying obra_id opt into the date-specific assignment selection.
do $$
declare src text; old text; updated text;
begin
 src:=pg_get_functiondef('private.maquinaria_registrar_reporte(integer,jsonb,uuid)'::regprocedure);
 old:='if p_datos ? ''obra_nombre'' and coalesce(p_datos->>''obra_nombre'','''')<>coalesce(eq.obra_nombre,'''') then raise exception ''La asignación del equipo cambió. Actualiza el formulario''; end if;';
 if position(old in src)=0 then raise exception 'Unexpected report function; review before migration'; end if;
 updated:=replace(src,'is_public boolean;', 'selected_work jsonb; report_work text; is_public boolean;');
 updated:=replace(updated,old,$patch$if p_datos ? 'obra_id' then
 selected_work:=private.equipo_obra_registro(eq.id,(p_datos->>'fecha')::date,nullif(p_datos->>'obra_id','')::bigint);
 report_work:=coalesce(selected_work->>'nombre','Bodega / Sin asignar');
 else
 if p_datos ? 'obra_nombre' and coalesce(p_datos->>'obra_nombre','')<>coalesce(eq.obra_nombre,'') then raise exception 'La asignación del equipo cambió. Actualiza el formulario'; end if;
 report_work:=coalesce(eq.obra_nombre,'Bodega / Sin asignar');
 end if;$patch$);
 updated:=replace(updated,'values(eq.id::text,eq.tipo,eq.patente,coalesce(eq.obra_nombre,''Bodega / Sin asignar''),d','values(eq.id::text,eq.tipo,eq.patente,report_work,d');
 updated:=replace(updated,'values(eq.id,eq.tipo,eq.patente,coalesce(eq.obra_nombre,''Bodega / Sin asignar''),d','values(eq.id,eq.tipo,eq.patente,report_work,d');
 updated:=replace(updated,'case when is_public then null else nullif(p_datos->>''obra_cargo_diario'','''') end',
 $patch$case when is_public then (select coalesce(o.nombre,u.obra_cargo_diario,u.obra_nombre) from public.maquinaria_uso_diario u left join public.obras o on o.id=u.cargo_obra_id and o.empresa=u.empresa where u.empresa=eq.empresa and u.equipo_id=eq.id::text and u.fecha=d order by u.cargo_decidido_at desc nulls last,u.id desc limit 1) else nullif(p_datos->>'obra_cargo_diario','') end$patch$);
 execute updated;
 src:=pg_get_functiondef('public.equipo_qr_mantencion(integer,jsonb,uuid)'::regprocedure);
 if position('values(e.id,e.patente,e.tipo,e.empresa,e.obra_nombre,d' in src)=0 then raise exception 'Unexpected maintenance function'; end if;
 updated:=replace(src,'meter numeric;', 'chosen jsonb; meter numeric;');
 updated:=replace(updated,'insert into public.maquinaria_mantenciones', $patch$chosen:=private.equipo_obra_registro(e.id,d,nullif(p_datos->>'obra_id','')::bigint);
 insert into public.maquinaria_mantenciones$patch$);
 updated:=replace(updated,'values(e.id,e.patente,e.tipo,e.empresa,e.obra_nombre,d','values(e.id,e.patente,e.tipo,e.empresa,coalesce(chosen->>''nombre'',''Bodega / Sin asignar''),d');
 execute updated;
end $$;
commit;
