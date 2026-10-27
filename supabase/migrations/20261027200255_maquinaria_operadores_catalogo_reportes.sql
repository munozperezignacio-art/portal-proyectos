create table public.maquinaria_operadores (
 id uuid primary key default gen_random_uuid(), empresa text not null,
 trabajador_id integer not null references public.maestro_personal(id),
 nombre text not null, activo boolean not null default true,
 created_at timestamptz not null default now(), unique(empresa,trabajador_id)
);
alter table public.maquinaria_operadores enable row level security;
revoke all on public.maquinaria_operadores from public,anon,authenticated;
grant select on public.maquinaria_operadores to authenticated;
grant all on public.maquinaria_operadores to service_role;
create policy operadores_lectura on public.maquinaria_operadores for select to authenticated using(
 private.obraxis_actor_can_access_company(empresa) and
 (private.obraxis_permission(empresa,'maquinaria.inventario.ver') or private.obraxis_permission(empresa,'maquinaria.uso.crear')));
create index maquinaria_operadores_persona_idx on public.maquinaria_operadores(trabajador_id);
alter table public.maquinaria_uso_diario add column operador_id uuid references public.maquinaria_operadores(id);
create index maquinaria_uso_operador_fecha_idx on public.maquinaria_uso_diario(empresa,operador_id,fecha);

create function private.maquinaria_gestionar_operadores(p_empresa text,p_accion text,p_datos jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare admin boolean; actor integer; worker public.maestro_personal%rowtype;
begin
 if auth.uid() is null or not private.obraxis_actor_can_access_company(p_empresa) then raise exception 'Sin acceso'; end if;
 select id into actor from public.usuarios where auth_user_id=auth.uid();
 admin:=private.obraxis_permission(p_empresa,'maquinaria.inventario.configurar') or
 (private.obraxis_permission(p_empresa,'maquinaria.inventario.ver') and exists(select 1 from public.maquinaria_reporte_config where empresa=p_empresa and responsable_id=actor));
 if not admin then raise exception 'Requiere responsable o configuración de maquinaria'; end if;
 if p_accion='personas' then
  return (select coalesce(jsonb_agg(jsonb_build_object('id',id,'nombre',nombre,'cargo',cargo) order by nombre),'[]') from public.maestro_personal where empresa=p_empresa);
 elsif p_accion='agregar' then
  select * into worker from public.maestro_personal where id=(p_datos->>'trabajador_id')::integer and empresa=p_empresa;
  if not found then raise exception 'Persona no disponible en Recursos Humanos de esta empresa'; end if;
  insert into public.maquinaria_operadores(empresa,trabajador_id,nombre) values(p_empresa,worker.id,worker.nombre)
  on conflict(empresa,trabajador_id) do update set activo=true,nombre=excluded.nombre;
 elsif p_accion='estado' then
  update public.maquinaria_operadores set activo=(p_datos->>'activo')::boolean where id=(p_datos->>'id')::uuid and empresa=p_empresa;
  if not found then raise exception 'Operador no disponible'; end if;
 else raise exception 'Acción inválida'; end if;
 return '{"ok":true}'::jsonb;
end;$$;
revoke all on function private.maquinaria_gestionar_operadores(text,text,jsonb) from public,anon;
grant execute on function private.maquinaria_gestionar_operadores(text,text,jsonb) to authenticated;
create function public.gestionar_operadores_maquinaria(p_empresa text,p_accion text,p_datos jsonb default '{}') returns jsonb
language sql security invoker set search_path='' as $$select private.maquinaria_gestionar_operadores(p_empresa,p_accion,p_datos);$$;
revoke all on function public.gestionar_operadores_maquinaria(text,text,jsonb) from public,anon;
grant execute on function public.gestionar_operadores_maquinaria(text,text,jsonb) to authenticated;

-- Validate every new report, including the legacy web entry point. Never match by name.
create function private.maquinaria_validar_operador() returns trigger language plpgsql security definer set search_path='' as $$
declare op public.maquinaria_operadores%rowtype;
begin
 new.operador_id:=coalesce(new.operador_id,nullif(new.reporte_datos->>'operador_id','')::uuid);
 select * into op from public.maquinaria_operadores where id=new.operador_id and empresa=new.empresa and activo;
 if not found then raise exception 'Selecciona un operador habilitado en Maquinaria > Operadores. Actualiza la aplicación si no aparece el listado.'; end if;
 new.operador:=op.nombre;
 if coalesce(auth.jwt()->>'role','')='service_role' and new.reporte_datos->>'origen'='qr' then
  new.registrado_por:=coalesce(nullif(new.reporte_datos->>'autor_declarado',''),'Sin nombre declarado')||' (declarado por QR, no verificado)';
 end if;
 if auth.uid() is not null then select coalesce(nombre,usuario) into new.registrado_por from public.usuarios where auth_user_id=auth.uid(); end if;
 return new;
end;$$;
revoke all on function private.maquinaria_validar_operador() from public,anon,authenticated;
create trigger validar_operador_maquinaria before insert on public.maquinaria_uso_diario for each row execute function private.maquinaria_validar_operador();

-- Preserve the atomic implementation and idempotency hash, adding only the selected ID to its snapshot.
do $$declare definition text; begin
 select pg_get_functiondef('private.maquinaria_registrar_reporte(integer,jsonb,uuid)'::regprocedure) into definition;
 definition:=replace(definition,'''unidad'',coalesce(ec.unidad,''h'')','''autor_declarado'',left(p_datos->>''autor_declarado'',180),''operador_id'',p_datos->>''operador_id'',''unidad'',coalesce(ec.unidad,''h'')');
 execute definition;
end;$$;
notify pgrst,'reload schema';
