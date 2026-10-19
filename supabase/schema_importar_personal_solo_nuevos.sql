-- Importación aditiva: nunca actualiza ni reactiva fichas. La fecha contractual
-- existente sigue siendo el límite de vigencia para asistencia/costeo.
alter table public.maestro_personal add column if not exists causal_termino_contrato text;
comment on column public.maestro_personal.causal_termino_contrato is 'Causal del archivo: 159i2 renuncia, 159i4 plazo, 159i5 conclusión del trabajo. Una fecha futura no implica salida efectiva actual.';

create or replace function private.rrhh_rut_valido(p_rut text)
returns boolean language plpgsql immutable security invoker set search_path='' as $$
declare r text:=upper(regexp_replace(coalesce(p_rut,''),'[^0-9kK]','','g')); suma integer:=0; factor integer:=2; v integer; i integer;
begin
  if r !~ '^[0-9]{7,8}[0-9K]$' then return false; end if;
  for i in reverse length(r)-1..1 loop
    suma:=suma+substring(r,i,1)::integer*factor;
    factor:=case when factor=7 then 2 else factor+1 end;
  end loop;
  v:=11-suma%11;
  return right(r,1)=case when v=11 then '0' when v=10 then 'K' else v::text end;
end; $$;
revoke all on function private.rrhh_rut_valido(text) from public,anon,authenticated;

create or replace function private.rrhh_importar_solo_nuevos(p_empresa text,p_filas jsonb)
returns jsonb language plpgsql security definer set search_path='' as $$
declare x jsonb; p public.maestro_personal; salida jsonb:='[]'; clave text; v_id integer; v_fila integer; tipo text; permitido boolean;
begin
  select exists(
    select 1 from public.usuarios u left join public.roles r on r.empresa=u.empresa and r.nombre=u.rol
    cross join lateral(select coalesce(r.permisos,'{}'::jsonb)||coalesce(u.permisos,'{}'::jsonb) permisos,
      lower(coalesce(u.rol_base,r.rol_base,u.rol,'')) rol) e
    where u.auth_user_id=auth.uid() and not coalesce(r.archivado,false)
      and (u.empresa=p_empresa or (u.empresa='Obraxis' and e.rol in ('superusuario','superadmin')))
      and case when e.rol in ('superusuario','superadmin') then true
        when e.permisos ? 'rrhh.personal.importar' then e.permisos->>'rrhh.personal.importar'='true'
        else e.rol like '%admin%' or e.rol like '%gerencia%' or e.rol like '%jefe%' or e.rol like '%profesional%' or e.rol like '%creador%' end
  ) into permitido;
  if auth.uid() is null or not private.obraxis_actor_can_access_company(p_empresa) or not permitido then
    raise exception 'Sin permiso para importar personal en esta empresa' using errcode='42501';
  end if;
  if jsonb_typeof(p_filas) is distinct from 'array' then raise exception 'Se requiere una lista de trabajadores'; end if;
  if jsonb_array_length(p_filas) not between 1 and 500 then raise exception 'Importe de 1 a 500 trabajadores por archivo'; end if;
  -- Coordina también con altas manuales mientras se comprueban e insertan RUT.
  -- No requiere borrar/normalizar duplicados históricos de otras empresas.
  lock table public.maestro_personal in share row exclusive mode;
  for x in select value from jsonb_array_elements(p_filas) loop
    v_fila:=null;
    begin
      v_fila:=nullif(x->>'fila','')::integer;
      clave:=upper(regexp_replace(coalesce(x->>'rut',''),'[^0-9kK]','','g'));
      if coalesce(x->>'empresa',p_empresa)<>p_empresa then raise exception 'La fila pertenece a otra empresa'; end if;
      if exists(select 1 from public.maestro_personal m where m.empresa=p_empresa and upper(regexp_replace(m.rut,'[^0-9kK]','','g'))=clave) then
        salida:=salida||jsonb_build_array(jsonb_build_object('fila',v_fila,'estado','existente')); continue;
      end if;
      if not private.rrhh_rut_valido(clave) then raise exception 'RUT inválido'; end if;
      -- Dos filas nuevas con el mismo RUT no se resuelven tomando la primera.
      if (select count(*) from jsonb_array_elements(p_filas) y where upper(regexp_replace(coalesce(y->>'rut',''),'[^0-9kK]','','g'))=clave)>1 then raise exception 'RUT repetido en el archivo'; end if;
      p:=jsonb_populate_record(null::public.maestro_personal,x);
      if nullif(btrim(p.nombre),'') is null or nullif(btrim(p.cargo),'') is null then raise exception 'Falta nombre o cargo'; end if;
      p.causal_termino_contrato:=nullif(replace(lower(coalesce(p.causal_termino_contrato,'')),' ',''),'sindefinir');
      p.causal_termino_contrato:=nullif(p.causal_termino_contrato,'');
      if p.causal_termino_contrato is not null and p.causal_termino_contrato not in ('159i2','159i4','159i5') then raise exception 'Causal no reconocida'; end if;
      tipo:=nullif(btrim(p.tipo_contrato),'');
      if extract(year from p.fecha_vencimiento_contrato)=3000 then
        if p.causal_termino_contrato is not null or (tipo is not null and tipo<>'Indefinido') then raise exception 'Fecha año 3000 incompatible con tipo o causal'; end if;
        p.tipo_contrato:='Indefinido'; p.fecha_vencimiento_contrato:=null;
      else
        p.tipo_contrato:=coalesce(tipo,case p.causal_termino_contrato when '159i4' then 'Plazo Fijo' when '159i5' then 'Por Obra o Faena' else 'No informado' end);
      end if;
      if p.tipo_contrato not in ('Indefinido','Plazo Fijo','Por Obra o Faena','No informado') then raise exception 'Tipo de contrato inválido'; end if;
      if p.tipo_contrato='Indefinido' and p.fecha_vencimiento_contrato is not null and p.causal_termino_contrato is null then raise exception 'Indefinido con vencimiento sin causal'; end if;
      if p.causal_termino_contrato is not null and p.fecha_vencimiento_contrato is null then raise exception 'Falta fecha de término'; end if;
      if p.fecha_vencimiento_contrato<p.fecha_inicio_contrato then raise exception 'Término anterior al ingreso'; end if;
      if p.email is not null and p.email<>'' and p.email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then raise exception 'Correo inválido'; end if;
      if coalesce(p.sueldo_base,0)<0 or coalesce(p.colacion,0)<0 or coalesce(p.movilizacion,0)<0 then raise exception 'Monto negativo'; end if;
      if nullif(p.obra_nombre,'') is not null and not exists(select 1 from public.obras o where o.empresa=p_empresa and o.nombre=p.obra_nombre) then raise exception 'Obra no encontrada en la empresa'; end if;
      insert into public.maestro_personal(empresa,rut,nombre,cargo,fono,email,obra_nombre,fecha_asig,centro_trabajo,area,sueldo_base,tipo_contrato,
        fecha_inicio_contrato,fecha_vencimiento_contrato,causal_termino_contrato,banco,tipo_cuenta,numero_cuenta,afp,prevision_salud,colacion,movilizacion)
      values(p_empresa,left(clave,length(clave)-1)||'-'||right(clave,1),btrim(p.nombre),btrim(p.cargo),nullif(p.fono,''),lower(nullif(p.email,'')),
        nullif(p.obra_nombre,''),p.fecha_asig,nullif(p.centro_trabajo,''),nullif(p.area,''),p.sueldo_base,p.tipo_contrato,p.fecha_inicio_contrato,
        p.fecha_vencimiento_contrato,p.causal_termino_contrato,nullif(p.banco,''),nullif(p.tipo_cuenta,''),nullif(p.numero_cuenta,''),nullif(p.afp,''),nullif(p.prevision_salud,''),p.colacion,p.movilizacion)
      returning id into v_id;
      salida:=salida||jsonb_build_array(jsonb_build_object('fila',v_fila,'estado','creado','id',v_id));
    exception when others then
      salida:=salida||jsonb_build_array(jsonb_build_object('fila',v_fila,'estado','error','mensaje',SQLERRM));
    end;
  end loop;
  return salida;
end; $$;
revoke all on function private.rrhh_importar_solo_nuevos(text,jsonb) from public,anon;
grant execute on function private.rrhh_importar_solo_nuevos(text,jsonb) to authenticated;
create or replace function public.importar_personal_solo_nuevos(p_empresa text,p_filas jsonb)
returns jsonb language sql security invoker set search_path='' as $$
select private.rrhh_importar_solo_nuevos(p_empresa,p_filas); $$;
revoke all on function public.importar_personal_solo_nuevos(text,jsonb) from public,anon;
grant execute on function public.importar_personal_solo_nuevos(text,jsonb) to authenticated;
notify pgrst,'reload schema';
