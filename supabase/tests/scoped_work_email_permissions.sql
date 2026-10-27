-- Run in one transaction. No recipients, rules, assignments or audit rows survive.
begin;
do $$
declare actor public.usuarios; w public.obras; other_work public.obras; cfg public.config_empresa;
 payload jsonb; stamp timestamptz; rid uuid; affected integer; denied boolean;
 original jsonb; checks integer:=0;
begin
 select * into actor from public.usuarios where empresa='EMINSG' and rol='Administrador de Contratos' and auth_user_id is not null order by id limit 1;
 select * into w from public.obras where empresa=actor.empresa order by id limit 1;
 select * into other_work from public.obras where empresa=actor.empresa and id<>w.id order by id limit 1;
 if actor.id is null or other_work.id is null then raise exception 'Missing test fixtures'; end if;
 select * into cfg from public.config_empresa where empresa=actor.empresa;
 original:=to_jsonb(cfg)-'correos_contextuales'-'updated_at';
 -- Exercise restricted work access without changing the persisted user assignment.
 update public.usuarios set obras=w.nombre where id=actor.id;
 perform set_config('request.jwt.claim.sub',actor.auth_user_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor.auth_user_id,'email',actor.correo,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 payload:=coalesce(cfg.correos_contextuales,'{}')||jsonb_build_object('obra:'||w.id,jsonb_build_object('events',jsonb_build_object('avance_registrado',jsonb_build_object('emails',jsonb_build_array('qa-scope@example.invalid'),'emailsCC','[]'::jsonb,'autoNotify',false))));
 stamp:=public.guardar_correos_obra(actor.empresa,w.id,payload,cfg.updated_at);
 if not exists(select 1 from public.config_empresa c where c.empresa=actor.empresa and c.correos_contextuales=payload and (to_jsonb(c)-'correos_contextuales'-'updated_at')=original) then raise exception 'Local save or field isolation failed'; end if; checks:=checks+1;
 denied:=false; begin perform public.guardar_correos_obra(actor.empresa,w.id,payload,cfg.updated_at); exception when serialization_failure then denied:=true; end;
 if not denied then raise exception 'Stale write accepted'; end if; checks:=checks+1;
 denied:=false; begin perform public.guardar_correos_obra(actor.empresa,w.id,payload||jsonb_build_object('obras:global',jsonb_build_object('events','{}'::jsonb)),stamp); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Global email write accepted'; end if; checks:=checks+1;
 denied:=false; begin perform public.guardar_correos_obra(actor.empresa,other_work.id,payload,stamp); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Unassigned work accepted'; end if; checks:=checks+1;
 denied:=false; begin perform public.guardar_correos_obra('Other company',w.id,payload,stamp); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Cross-company write accepted'; end if; checks:=checks+1;
 update public.config_empresa set color_primario='#000000' where empresa=actor.empresa;
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'General config write allowed'; end if; checks:=checks+1;
 insert into public.notificaciones_reglas(empresa,nombre,evento_codigo,modulo,activa,canal_email,canal_plataforma,condiciones)
 values(actor.empresa,'QA rollback','avance_registrado','Obras',false,false,false,jsonb_build_object('alcance_tipo','seleccionadas','obras_seleccionadas',jsonb_build_array(w.nombre))) returning id into rid;
 update public.notificaciones_reglas set nombre='QA updated rollback' where id=rid;
 get diagnostics affected=row_count;
 if affected<>1 then raise exception 'Scoped responsibility update failed'; end if; checks:=checks+1;
 denied:=false; begin update public.notificaciones_reglas set condiciones='{"alcance_tipo":"todas"}' where id=rid; exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Global responsibility escalation accepted'; end if; checks:=checks+1;
 denied:=false; begin update public.notificaciones_reglas set condiciones=jsonb_build_object('alcance_tipo','seleccionadas','obras_seleccionadas',jsonb_build_array(other_work.nombre)) where id=rid; exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Responsibility for unassigned work accepted'; end if; checks:=checks+1;
 delete from public.notificaciones_reglas where id=rid;
 get diagnostics affected=row_count;
 if affected<>1 then raise exception 'Scoped responsibility delete failed'; end if; checks:=checks+1;
 execute 'reset role';
 select * into actor from public.usuarios where empresa='EMINSG' and rol='Oficina Técnica' and auth_user_id is not null limit 1;
 perform set_config('request.jwt.claim.sub',actor.auth_user_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor.auth_user_id,'email',actor.correo,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 denied:=false; begin perform public.guardar_correos_obra(actor.empresa,w.id,payload,stamp); exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Unauthorized role email write accepted'; end if; checks:=checks+1;
 denied:=false; begin
 insert into public.notificaciones_reglas(empresa,nombre,evento_codigo,modulo,activa,canal_email,canal_plataforma,condiciones)
 values(actor.empresa,'QA forbidden','avance_registrado','Obras',false,false,false,jsonb_build_object('alcance_tipo','seleccionadas','obras_seleccionadas',jsonb_build_array(w.nombre)));
 exception when insufficient_privilege then denied:=true; end;
 if not denied then raise exception 'Responsibility role restriction bypassed'; end if; checks:=checks+1;
 execute 'reset role';
 select * into actor from public.usuarios where empresa='EMINSG' and rol='Administrador de Empresa' and auth_user_id is not null limit 1;
 perform set_config('request.jwt.claim.sub',actor.auth_user_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',actor.auth_user_id,'email',actor.correo,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 payload:=payload||jsonb_build_object('obras:global',jsonb_build_object('events',jsonb_build_object('asistencia_registrada',jsonb_build_object('emails',jsonb_build_array('qa-general@example.invalid'),'emailsCC','[]'::jsonb,'autoNotify',false))));
 stamp:=public.guardar_correos_obra(actor.empresa,w.id,payload,stamp);
 if stamp is null then raise exception 'Global admin email write failed'; end if; checks:=checks+1;
 insert into public.notificaciones_reglas(empresa,nombre,evento_codigo,modulo,activa,canal_email,canal_plataforma,condiciones)
 values(actor.empresa,'QA global rollback','avance_registrado','Obras',false,false,false,'{"alcance_tipo":"todas"}') returning id into rid;
 delete from public.notificaciones_reglas where id=rid; checks:=checks+1;
 execute 'reset role';
 if has_function_privilege('anon','public.guardar_correos_obra(text,integer,jsonb,timestamp with time zone)','EXECUTE') then raise exception 'Anonymous RPC enabled'; end if; checks:=checks+1;
 perform set_config('qa.scoped_checks',checks::text,true);
end $$;
select current_setting('qa.scoped_checks')::integer as checks_passed;
rollback;
