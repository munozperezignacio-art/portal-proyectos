do $patch$
declare def text := pg_get_functiondef('private.specialty_api(integer,text,jsonb)'::regprocedure);
begin
 if strpos(def,$old$'can_configure',adm,'actor',uid,$old$)=0 then raise exception 'Definición inesperada; se cancela el cambio'; end if;
 def:=replace(def,$old$'can_configure',adm,'actor',uid,$old$,$new$'can_execute',coalesce(private.obraxis_permission(w.empresa,'obras.avances.crear'),false),'can_configure',adm,'actor',uid,$new$);
 if strpos(def,$old$if uid is distinct from cfg.ejecucion and not (adm and p_action='reconcile') then raise exception 'Solo el responsable de ejecución designado puede guardar o cerrar';end if;$old$)=0 then raise exception 'Definición inesperada; se cancela el cambio'; end if;
 def:=replace(def,$old$if uid is distinct from cfg.ejecucion and not (adm and p_action='reconcile') then raise exception 'Solo el responsable de ejecución designado puede guardar o cerrar';end if;$old$,$new$if (p_action='reconcile' and not adm) or (p_action<>'reconcile' and not coalesce(private.obraxis_permission(w.empresa,'obras.avances.crear'),false)) then raise exception 'Falta permiso para registrar avances de obra';end if;$new$);
 if strpos(def,$old$if s.id is not null and ((p_data->>'fecha')::date<>s.fecha or s.responsable<>uid and p_action<>'reconcile') then raise exception 'No se puede cambiar la fecha ni el autor de una jornada';end if;$old$)=0 then raise exception 'Definición inesperada; se cancela el cambio'; end if;
 def:=replace(def,$old$if s.id is not null and ((p_data->>'fecha')::date<>s.fecha or s.responsable<>uid and p_action<>'reconcile') then raise exception 'No se puede cambiar la fecha ni el autor de una jornada';end if;$old$,$new$if s.id is not null and (p_data->>'fecha')::date is distinct from s.fecha then raise exception 'No se puede cambiar la fecha ni el autor de una jornada';end if;$new$);
 execute def;
end $patch$;
