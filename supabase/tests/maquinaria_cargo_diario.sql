begin;
do $$
declare
 perfil public.usuarios; equipo integer; reporte bigint; primera text; segunda text;
 monto numeric; destino text; cantidad integer; bloqueado boolean;
begin
 select * into perfil from public.usuarios where empresa='EMINSG' and rol='Oficina Técnica' and auth_user_id is not null limit 1;
 if not found then raise exception 'Falta perfil de prueba'; end if;
 select nombre into primera from public.obras where empresa=perfil.empresa order by id limit 1;
 select nombre into segunda from public.obras where empresa=perfil.empresa and nombre<>primera order by id limit 1;
 if segunda is null then raise exception 'Se necesitan dos obras'; end if;
 insert into public.inventario_maquinaria(empresa,tipo,patente,costo_interno,unidad_costo_interno)
 values(perfil.empresa,'__PRUEBA_CARGO__','__TEST__',700,'$/día') returning id into equipo;
 perform set_config('request.jwt.claim.sub',perfil.auth_user_id::text,true);
 execute 'set local role authenticated';
 insert into public.maquinaria_uso_diario(empresa,equipo_id,obra_nombre,fecha) values(perfil.empresa,equipo::text,primera,'2099-01-01');
 insert into public.maquinaria_uso_diario(empresa,equipo_id,obra_nombre,fecha) values(perfil.empresa,equipo::text,primera,'2099-01-01');
 select count(*),sum(c.monto) into cantidad,monto from public.maquinaria_cargos_diarios c where equipo_id=equipo::text;
 if cantidad<>1 or monto<>700 then raise exception 'Duplicación del cargo'; end if;
 bloqueado:=false;
 begin
   insert into public.maquinaria_uso_diario(empresa,equipo_id,obra_nombre,fecha) values(perfil.empresa,equipo::text,segunda,'2099-01-01');
 exception when raise_exception then bloqueado:=SQLERRM='MAQUINARIA_DESTINO_REQUERIDO'; end;
 if not bloqueado then raise exception 'Falta aviso de segundo destino'; end if;
 insert into public.maquinaria_uso_diario(empresa,equipo_id,obra_nombre,fecha,obra_cargo_diario)
 values(perfil.empresa,equipo::text,segunda,'2099-01-01',segunda) returning id into reporte;
 select c.monto,c.obra_nombre into monto,destino from public.maquinaria_cargos_diarios c where equipo_id=equipo::text;
 if monto<>700 or destino<>segunda then raise exception 'No trasladó el cargo'; end if;
 update public.inventario_maquinaria set costo_interno=900 where id=equipo;
 insert into public.maquinaria_uso_diario(empresa,equipo_id,obra_nombre,fecha,obra_cargo_diario)
 values(perfil.empresa,equipo::text,segunda,'2099-01-01',primera);
 select c.monto,c.obra_nombre into monto,destino from public.maquinaria_cargos_diarios c where equipo_id=equipo::text;
 if monto<>700 or destino<>primera then raise exception 'Cambió la tarifa congelada o perdió la elección'; end if;
 bloqueado:=false;
 begin
   insert into public.maquinaria_uso_diario(empresa,equipo_id,obra_nombre,fecha,obra_cargo_diario)
   values(perfil.empresa,equipo::text,segunda,'2099-01-01','__DESTINO_AJENO__');
 exception when raise_exception then bloqueado:=true; end;
 if not bloqueado then raise exception 'Admite destino ajeno'; end if;
 bloqueado:=false;
 begin update public.maquinaria_uso_diario set tarifa_diaria_aplicada=1 where id=reporte;
 exception when raise_exception then bloqueado:=true; end;
 if not bloqueado then raise exception 'Permite adulterar tarifa'; end if;
 if exists(select 1 from public.maquinaria_cargos_diarios where empresa<>perfil.empresa) then raise exception 'Fuga de otra empresa'; end if;
 execute 'reset role';
 if has_table_privilege('anon','public.maquinaria_cargos_diarios','select') then raise exception 'Vista pública'; end if;
end $$;
rollback;
