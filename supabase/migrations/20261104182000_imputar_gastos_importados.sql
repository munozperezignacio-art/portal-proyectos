create function private.ponderar_gastos_importados(c text,w integer,parts jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare r record; n integer; total numeric:=0; acumulado numeric:=0; previo numeric:=0; siguiente numeric; result jsonb:='[]';
begin
 if auth.uid() is null or not coalesce(private.rrhh_partidas_permiso(c,w,'editar'),false) or not coalesce(private.rrhh_partidas_permiso(c,w,'aprobar'),false) then raise exception 'Solo administradores de empresa o contratos pueden imputar gastos' using errcode='42501'; end if;
 if jsonb_typeof(parts)<>'array' or jsonb_array_length(parts)=0 then raise exception 'Selecciona partidas'; end if;
 select count(distinct (v->>'partida_id')::integer) into n from jsonb_array_elements(parts) v;
 if n<>jsonb_array_length(parts) then raise exception 'Partidas repetidas'; end if;
 if n<>(select count(*) from public.partidas_obra p where p.empresa=c and p.obra_id=w
  and not coalesce(p.es_titulo,false) and upper(coalesce(p.unidad,'')) not in ('TITULO','GRUPO')
  and upper(coalesce(p.tipo_item,'')) not in ('TITULO','GRUPO')
  and p.id in(select (v->>'partida_id')::integer from jsonb_array_elements(parts) v)) then raise exception 'Las partidas no pertenecen a esta obra'; end if;
 for r in select p.id,p.cantidad_presupuestada*p.costo_por_dia presupuesto,v->>'presupuesto' esperado
  from public.partidas_obra p join jsonb_array_elements(parts) v on p.id=(v->>'partida_id')::integer
  where p.empresa=c and p.obra_id=w order by p.id for share of p
 loop
  if r.presupuesto is null or r.presupuesto<=0 then raise exception 'El presupuesto de cada partida debe ser mayor a cero'; end if;
  if r.esperado is null or abs(r.presupuesto-r.esperado::numeric)>0.01 then raise exception 'El presupuesto cambió. Actualiza la obra antes de imputar'; end if;
  total:=total+r.presupuesto;
 end loop;
 for r in select p.id,p.partida,p.cantidad_presupuestada*p.costo_por_dia presupuesto
  from public.partidas_obra p where p.empresa=c and p.obra_id=w and p.id in(select (v->>'partida_id')::integer from jsonb_array_elements(parts) v) order by p.id
 loop
  acumulado:=acumulado+r.presupuesto;siguiente:=round(acumulado/total*10000);
  if siguiente<=previo then raise exception 'Ponderación demasiado pequeña. Revisa las partidas'; end if;
  result:=result||jsonb_build_array(jsonb_build_object('partida_id',r.id,'partida',r.partida,'porcentaje',(siguiente-previo)/100));previo:=siguiente;
 end loop;
 return result;
end $$;
revoke all on function private.ponderar_gastos_importados(text,integer,jsonb) from public,anon,authenticated;

create function private.imputar_gastos_importados(c text,w integer,costs jsonb,parts jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
declare distribution jsonb; r public.costos_reales_obra; o public.obras; expected numeric; n integer; result jsonb:='[]';
begin
 distribution:=private.ponderar_gastos_importados(c,w,parts);
 select * into strict o from public.obras where id=w and empresa=c;
 if jsonb_typeof(costs)<>'array' or jsonb_array_length(costs)=0 or jsonb_array_length(costs)>1000 then raise exception 'Selecciona entre 1 y 1000 gastos'; end if;
 select count(distinct(v->>'id')::bigint) into n from jsonb_array_elements(costs) v;
 if n<>jsonb_array_length(costs) then raise exception 'Gastos repetidos'; end if;
 if n<>(select count(*) from public.costos_reales_obra g where g.empresa=c and g.obra_nombre=o.nombre and g.id in(select(v->>'id')::bigint from jsonb_array_elements(costs) v)) then raise exception 'Los gastos no pertenecen a esta obra'; end if;
 for r in select * from public.costos_reales_obra g where g.empresa=c and g.obra_nombre=o.nombre and g.id in(select(v->>'id')::bigint from jsonb_array_elements(costs) v) order by id for update
 loop
  select (v->>'monto')::numeric into expected from jsonb_array_elements(costs) v where (v->>'id')::bigint=r.id;
  if expected is null or r.monto is distinct from expected or coalesce(r.imputaciones,'[]')<>'[]'::jsonb then raise exception 'Un gasto cambió o ya tiene imputación. Actualiza antes de continuar'; end if;
  if r.origen not in ('iconstruye_rendicion','iconstruye_oc') or r.origen is null or r.monto<=0 then raise exception 'Solo gastos importados con monto positivo'; end if;
  update public.costos_reales_obra set imputaciones=distribution where id=r.id returning * into r;
  result:=result||jsonb_build_array(to_jsonb(r));
 end loop;
 return result;
end $$;
revoke all on function private.imputar_gastos_importados(text,integer,jsonb,jsonb) from public,anon;
grant execute on function private.imputar_gastos_importados(text,integer,jsonb,jsonb) to authenticated;
create function public.imputar_gastos_importados(p_empresa text,p_obra integer,p_costos jsonb,p_partidas jsonb) returns jsonb
language sql security invoker set search_path='' as $$ select private.imputar_gastos_importados(p_empresa,p_obra,p_costos,p_partidas) $$;
revoke all on function public.imputar_gastos_importados(text,integer,jsonb,jsonb) from public,anon;
grant execute on function public.imputar_gastos_importados(text,integer,jsonb,jsonb) to authenticated;

create function private.imputar_al_importar_gasto() returns trigger language plpgsql security definer set search_path='' as $$
declare w integer; begin
 if new.origen in ('iconstruye_rendicion','iconstruye_oc') and coalesce(new.imputaciones,'[]')<>'[]'::jsonb then
  select id into strict w from public.obras where empresa=new.empresa and nombre=new.obra_nombre;
  new.imputaciones:=private.ponderar_gastos_importados(new.empresa,w,new.imputaciones);
 end if;
 return new;
end $$;
revoke all on function private.imputar_al_importar_gasto() from public,anon,authenticated;
create trigger imputar_al_importar_gasto before insert on public.costos_reales_obra for each row execute function private.imputar_al_importar_gasto();
