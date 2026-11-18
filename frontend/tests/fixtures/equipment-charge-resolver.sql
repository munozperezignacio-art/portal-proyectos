CREATE OR REPLACE FUNCTION private.maquinaria_cargo_para_imputar(c text, w integer, e integer, d date)
 RETURNS TABLE(equipo_id integer, fecha date, monto_real numeric, obra_liquidaciones_partidas jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
 if amount is null or amount<0 or amount::text in ('NaN','Infinity','-Infinity') then raise exception 'El equipo no tiene un costo válido para imputar'; end if;
 return query select e,d,amount,'[]'::jsonb;
end $function$;
