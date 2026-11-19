begin;
-- One independent checklist per equipment. No equipment update / cost trigger.
create unique index prevencion_checklist_equipo_unique on public.prevencion_formularios
 (empresa,(campos #>> '{control_documental,equipo_checklist_id}'))
 where campos #>> '{control_documental,equipo_checklist_id}' is not null;

create function private.equipo_copiar_checklist(p_equipo integer,p_formulario integer) returns jsonb
language plpgsql security definer set search_path='' as $$
declare e public.inventario_maquinaria%rowtype; s public.prevencion_formularios%rowtype;
 result public.prevencion_formularios%rowtype; fields jsonb; control jsonb; core jsonb;
begin
 if auth.uid() is null then raise exception 'Sesión requerida'; end if;
 select * into e from public.inventario_maquinaria where id=p_equipo for update;
 if not found or not coalesce(private.obraxis_actor_can_access_company(e.empresa),false)
 or not coalesce(private.obraxis_permission(e.empresa,'formularios.formularios.crear'),false)
 or not coalesce(private.obraxis_permission(e.empresa,'formularios.formularios.editar'),false)
 then raise exception 'Necesitas permiso para crear y editar formularios de esta empresa'; end if;
 select * into result from public.prevencion_formularios where empresa=e.empresa
 and campos #>> '{control_documental,equipo_checklist_id}'=e.id::text;
 if found then return to_jsonb(result); end if;
 select * into s from public.prevencion_formularios where id=p_formulario and empresa=e.empresa;
 if not found then raise exception 'Formulario no disponible en esta empresa'; end if;
 fields:=case when jsonb_typeof(s.campos)='array' then s.campos else s.campos->'items' end;
 if jsonb_typeof(fields) is distinct from 'array' or jsonb_array_length(fields)=0 then raise exception 'El formulario no tiene campos para copiar'; end if;
 control:=coalesce(s.campos->'control_documental','{}'::jsonb)-'tipo_registro';
 control:=control||jsonb_build_object('equipo_checklist_id',e.id,'formulario_origen_id',s.id,'todas_las_obras',true,'centros_gestion_ids','[]'::jsonb);
 core:='[
 {"id":"qr_equipo","type":"text","label":"Equipo","required":true,"systemRequired":true,"autoFilled":true},
 {"id":"qr_rut","type":"text","label":"RUT de quien registra","required":true,"systemRequired":true,"autoFilled":true},
 {"id":"qr_nombre","type":"text","label":"Nombre de quien registra","required":true,"systemRequired":true,"autoFilled":true},
 {"id":"qr_cargo","type":"text","label":"Cargo","required":true,"systemRequired":true,"autoFilled":true},
 {"id":"qr_fecha","type":"date","label":"Fecha","required":true,"systemRequired":true},
 {"id":"qr_horometro","type":"number","label":"Horómetro / lectura","required":true,"systemRequired":true}
 ]'::jsonb;
 select coalesce(jsonb_agg(f order by n),'[]'::jsonb) into fields from jsonb_array_elements(fields) with ordinality as x(f,n)
 where not exists(select 1 from jsonb_array_elements(core) c where c->>'id'=f->>'id');
 insert into public.prevencion_formularios(titulo,descripcion,categoria,campos,creado_por,publico_token,empresa,codigo,revision,fecha_revision)
 values(s.titulo||' · '||coalesce(e.patente,e.id::text),s.descripcion,s.categoria,
 jsonb_build_object('items',core||fields,'control_documental',control),auth.uid()::text,
 'FORM_'||replace(gen_random_uuid()::text,'-',''),e.empresa,s.codigo,s.revision,s.fecha_revision) returning * into result;
 return to_jsonb(result);
end $$;
revoke all on function private.equipo_copiar_checklist(integer,integer) from public,anon;
grant execute on function private.equipo_copiar_checklist(integer,integer) to authenticated;
create function public.equipo_copiar_checklist(p_equipo integer,p_formulario integer) returns jsonb
language sql security invoker set search_path='' as $$ select private.equipo_copiar_checklist(p_equipo,p_formulario); $$;
revoke all on function public.equipo_copiar_checklist(integer,integer) from public,anon;
grant execute on function public.equipo_copiar_checklist(integer,integer) to authenticated;

create function private.proteger_checklist_equipo() returns trigger language plpgsql security invoker set search_path='' as $$
declare original jsonb; field jsonb; fields jsonb;
begin
 if old.campos #>> '{control_documental,equipo_checklist_id}' is null then return new; end if;
 if new.empresa is distinct from old.empresa
 or new.campos #> '{control_documental,equipo_checklist_id}' is distinct from old.campos #> '{control_documental,equipo_checklist_id}'
 or new.campos #> '{control_documental,formulario_origen_id}' is distinct from old.campos #> '{control_documental,formulario_origen_id}'
 then raise exception 'No se puede cambiar la vinculación del checklist del equipo'; end if;
 fields:=new.campos->'items';
 if jsonb_typeof(fields) is distinct from 'array' then raise exception 'Faltan los campos protegidos del equipo'; end if;
 for original in select value from jsonb_array_elements(old.campos->'items') where value->>'systemRequired'='true' loop
  select value into field from jsonb_array_elements(fields) where value->>'id'=original->>'id';
  if field is null or field->>'type' is distinct from original->>'type' or field->>'required' is distinct from 'true'
  or field->>'systemRequired' is distinct from 'true' or (original->>'autoFilled'='true' and field->>'autoFilled' is distinct from 'true')
  or coalesce(field->'condition','null'::jsonb) not in ('null'::jsonb,'false'::jsonb)
  or coalesce(field->'showIf','null'::jsonb) not in ('null'::jsonb,'false'::jsonb)
  or coalesce(field->'showWhen','null'::jsonb) not in ('null'::jsonb,'false'::jsonb)
  or field->>'hidden'='true'
  then raise exception 'No se puede eliminar, ocultar ni hacer opcional el campo protegido: %',original->>'label'; end if;
 end loop;
 return new;
end $$;
revoke all on function private.proteger_checklist_equipo() from public,anon,authenticated;
create trigger proteger_checklist_equipo before update on public.prevencion_formularios for each row execute function private.proteger_checklist_equipo();
commit;
