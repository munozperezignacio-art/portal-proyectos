-- Permissions authorize actions. Role duties remain unchanged for pending-work routing.
begin;
do $migration$
declare definition text; old_text text; new_text text; duty text; permission text; start_at integer; end_at integer;
begin
 select pg_get_functiondef('private.specialty_api(integer,text,jsonb)'::regprocedure) into definition;
 definition:=replace(definition,chr(13),'');
 old_text:='adm:=lower(coalesce(nullif(actor.rol_base,''''),actor.rol,'''')) in (''administrador de empresa'',''administrador empresa'',''administrador de contratos'',''administrador de contrato'');';
 if strpos(definition,old_text)=0 then raise exception 'Specialty API configuration guard differs';end if;
 definition:=replace(definition,old_text,'adm:=coalesce(private.obraxis_permission(w.empresa,''obras.especialidad.configurar''),false);');
 old_text:='(private.specialty_role_can(p_work,''ejecucion'') and coalesce(private.obraxis_permission(w.empresa,''obras.avances.crear''),false))';
 if strpos(definition,old_text)=0 then raise exception 'Specialty API execution guard differs';end if;
 definition:=replace(definition,old_text,'coalesce(private.obraxis_permission(w.empresa,''obras.avances.crear''),false)');
 for duty,permission in select * from (values ('ejecucion','obras.avances.crear'),('topografia','obras.topografia.editar'),('calidad','obras.calidad.aprobar')) as mapping(d,p) loop
  definition:=replace(definition,format('private.specialty_role_can(p_work,%L)',duty),format('coalesce(private.obraxis_permission(w.empresa,%L),false)',permission));
 end loop;
 definition:=replace(definition,'''can_configure'',adm','''can_configure'',adm,''can_import'',coalesce(private.obraxis_permission(w.empresa,''obras.especialidad.importar''),false)');
 definition:=replace(definition,'if not adm then raise exception ''Solo administración puede cargar el catálogo'';', 'if not coalesce(private.obraxis_permission(w.empresa,''obras.especialidad.importar''),false) then raise exception ''Falta el permiso Importar coordenadas de especialidad'';');
 definition:=replace(definition,'Solo administración puede asignar responsables','Falta el permiso Configurar especialidades de obra');
 definition:=replace(definition,'Configura primero la especialidad y sus responsables','Configura primero el detalle por pila en Configuración → Especialidades de obra. El reporte normal sigue disponible');
 definition:=replace(definition,'Solo el topógrafo designado puede completar estos datos','Falta el permiso Editar mediciones de topografía');
 definition:=replace(definition,'La aprobación corresponde al responsable de Calidad','Falta el permiso Aprobar de Calidad de obra');
 -- Creating/editing protocols and approving are separate permissions too.
 start_at:=strpos(definition,E'elsif p_action=''protocol'' then\n');
 end_at:=strpos(definition,'  if s.id is null or s.estado=''abierta'' then');
 if start_at=0 or end_at<=start_at then raise exception 'Specialty API protocol guard differs';end if;
 new_text:=E'elsif p_action=''protocol'' then\n  if not coalesce(private.obraxis_permission(w.empresa,case when p_data->>''estado''=''aprobado'' then ''obras.calidad.aprobar'' when exists(select 1 from private.specialty_protocols where id=(p_data->>''protocol_id'')::uuid) then ''obras.calidad.editar'' else ''obras.calidad.crear'' end),false) then raise exception ''Falta el permiso de crear, editar o aprobar protocolos de Calidad'';end if;\n';
 definition:=substr(definition,1,start_at-1)||new_text||substr(definition,end_at);
 if strpos(definition,'private.specialty_role_can(')>0 then raise exception 'Responsibility still used in authorization';end if;
 execute definition;
end $migration$;
notify pgrst,'reload schema';
commit;
