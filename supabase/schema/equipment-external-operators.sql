-- External operators are operational identities, never payroll personnel.
begin;
alter table public.maquinaria_operadores alter column trabajador_id drop not null;
alter table public.maquinaria_operadores
 add column externo boolean not null default false,
 add column rut_externo text,
 add column cargo_externo text,
 add column proveedor text,
 add column equipos_autorizados integer[] not null default '{}',
 add column vigente_desde date,
 add column vigente_hasta date,
 add constraint operador_identidad check (coalesce(
  (not externo and trabajador_id is not null and rut_externo is null) or
  (externo and trabajador_id is null and rut_externo ~ '^[0-9]{7,8}[0-9K]$'
   and length(trim(nombre)) between 2 and 180 and length(trim(cargo_externo)) > 0
   and length(trim(proveedor)) > 0 and cardinality(equipos_autorizados)>0
   and vigente_desde is not null and (vigente_hasta is null or vigente_hasta>=vigente_desde)),false));
create unique index maquinaria_operador_externo_rut on public.maquinaria_operadores(empresa,rut_externo) where externo;

create function private.operador_externo_vigente(op public.maquinaria_operadores,p_equipo integer,p_fecha date)
returns boolean language sql stable set search_path='' as $$
 select coalesce(op.externo and op.activo and p_equipo=any(op.equipos_autorizados)
 and p_fecha>=op.vigente_desde and (op.vigente_hasta is null or p_fecha<=op.vigente_hasta)
 and (now() at time zone 'America/Santiago')::date>=op.vigente_desde
 and (op.vigente_hasta is null or (now() at time zone 'America/Santiago')::date<=op.vigente_hasta),false);
$$;
revoke all on function private.operador_externo_vigente(public.maquinaria_operadores,integer,date) from public,anon,authenticated;
grant execute on function private.operador_externo_vigente(public.maquinaria_operadores,integer,date) to service_role;

create function private.maquinaria_guardar_externo(p_empresa text,p_datos jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor integer; rid uuid; r text; digits text; total integer:=0; factor integer:=2; expected text; ids integer[]; d date; h date;
begin
 if auth.uid() is null or not private.obraxis_actor_can_access_company(p_empresa) then raise exception 'Sin acceso'; end if;
 select id into actor from public.usuarios where auth_user_id=auth.uid();
 if not (private.obraxis_permission(p_empresa,'maquinaria.inventario.configurar') or
 (private.obraxis_permission(p_empresa,'maquinaria.inventario.ver') and exists(select 1 from public.maquinaria_reporte_config where empresa=p_empresa and responsable_id=actor))) then raise exception 'Requiere responsable o configuración de maquinaria'; end if;
 r:=regexp_replace(upper(coalesce(p_datos->>'rut_externo','')),'[.\s-]','','g');
 if r !~ '^[0-9]{7,8}[0-9K]$' then raise exception 'RUT inválido'; end if;
 digits:=left(r,length(r)-1);
 for i in reverse length(digits)..1 loop total:=total+substring(digits,i,1)::integer*factor; factor:=case when factor=7 then 2 else factor+1 end; end loop;
 expected:=case 11-total%11 when 11 then '0' when 10 then 'K' else (11-total%11)::text end;
 if right(r,1)<>expected then raise exception 'Revisa el dígito verificador del RUT'; end if;
 if exists(select 1 from public.maestro_personal where empresa=p_empresa and regexp_replace(upper(rut),'[^0-9K]','','g')=r) then raise exception 'Este RUT ya tiene ficha de personal. Habilítalo desde Personal propio o revisa su ficha; no se duplicará como externo.'; end if;
 if coalesce(length(trim(p_datos->>'nombre')),0) not between 2 and 180 or coalesce(length(trim(p_datos->>'cargo_externo')),0) not between 1 and 180 or coalesce(length(trim(p_datos->>'proveedor')),0) not between 1 and 180 then raise exception 'Completa nombre, cargo y empresa o proveedor (máximo 180 caracteres)'; end if;
 select array_agg(distinct v::integer) into ids from jsonb_array_elements_text(p_datos->'equipos_autorizados') v;
 if coalesce(cardinality(ids),0)=0 or exists(select 1 from unnest(ids) as t(eqid) where not exists(select 1 from public.inventario_maquinaria e where e.id=t.eqid and e.empresa=p_empresa)) then raise exception 'Selecciona equipos de esta empresa'; end if;
 d:=nullif(p_datos->>'vigente_desde','')::date; h:=nullif(p_datos->>'vigente_hasta','')::date;
 if d is null or h<d then raise exception 'Revisa la vigencia de la autorización'; end if;
 rid:=nullif(p_datos->>'id','')::uuid;
 if rid is null then
  if exists(select 1 from public.maquinaria_operadores where empresa=p_empresa and externo and rut_externo=r) then raise exception 'El operador externo ya existe. Edita su autorización.'; end if;
  insert into public.maquinaria_operadores(empresa,nombre,externo,rut_externo,cargo_externo,proveedor,equipos_autorizados,vigente_desde,vigente_hasta)
  values(p_empresa,trim(p_datos->>'nombre'),true,r,trim(p_datos->>'cargo_externo'),trim(p_datos->>'proveedor'),ids,d,h) returning id into rid;
 else
  update public.maquinaria_operadores set nombre=trim(p_datos->>'nombre'),cargo_externo=trim(p_datos->>'cargo_externo'),proveedor=trim(p_datos->>'proveedor'),equipos_autorizados=ids,vigente_desde=d,vigente_hasta=h
  where id=rid and empresa=p_empresa and externo and rut_externo=r;
  if not found then raise exception 'Operador no disponible; el RUT no puede cambiarse'; end if;
 end if;
 return jsonb_build_object('ok',true,'id',rid);
end;$$;
revoke all on function private.maquinaria_guardar_externo(text,jsonb) from public,anon;
grant execute on function private.maquinaria_guardar_externo(text,jsonb) to authenticated;
create function public.guardar_operador_externo(p_empresa text,p_datos jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.maquinaria_guardar_externo(p_empresa,p_datos);$$;
revoke all on function public.guardar_operador_externo(text,jsonb) from public,anon;
grant execute on function public.guardar_operador_externo(text,jsonb) to authenticated;

-- Only the QR server may resolve a RUT. Internal personnel retain their existing access.
create function public.equipo_qr_actor(p_empresa text,p_rut text,p_equipo integer,p_fecha date)
returns jsonb language sql stable security invoker set search_path='' as $$
 select case when not exists(select 1 from public.inventario_maquinaria where id=p_equipo and empresa=p_empresa) then '[]'::jsonb
 when jsonb_array_length(public.equipo_qr_persona(p_empresa,p_rut))>0 then public.equipo_qr_persona(p_empresa,p_rut)
 else (select coalesce(jsonb_agg(jsonb_build_object('operador_id',o.id,'nombre',o.nombre,'cargo',o.cargo_externo,'rut',o.rut_externo,'externo',true,'proveedor',o.proveedor)),'[]'::jsonb)
 from public.maquinaria_operadores o where o.empresa=p_empresa and o.externo and o.rut_externo=p_rut and private.operador_externo_vigente(o,p_equipo,p_fecha)) end;
$$;
revoke all on function public.equipo_qr_actor(text,text,integer,date) from public,anon,authenticated;
grant execute on function public.equipo_qr_actor(text,text,integer,date) to service_role;

-- Enforce authorization for every report writer, including web and mobile inserts.
create function private.maquinaria_validar_externo() returns trigger language plpgsql security definer set search_path='' as $$
declare op public.maquinaria_operadores%rowtype;
begin
 select * into op from public.maquinaria_operadores where id=coalesce(new.operador_id,nullif(new.reporte_datos->>'operador_id','')::uuid) and empresa=new.empresa;
 if op.externo then
  if not private.operador_externo_vigente(op,new.equipo_id::integer,new.fecha::date) then raise exception 'Operador externo no habilitado para este equipo o fuera de vigencia'; end if;
  new.reporte_datos:=coalesce(new.reporte_datos,'{}'::jsonb)||jsonb_build_object('operador_externo',true,'operador_proveedor',op.proveedor,'operador_cargo',op.cargo_externo);
 end if;
 return new;
end;$$;
revoke all on function private.maquinaria_validar_externo() from public,anon,authenticated;
create trigger validar_operador_externo before insert on public.maquinaria_uso_diario for each row execute function private.maquinaria_validar_externo();
notify pgrst,'reload schema';
commit;
