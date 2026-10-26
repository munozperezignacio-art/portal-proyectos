-- Integration regression. Everything, including notifications, is rolled back.
begin;
do $$
declare
 a public.usuarios%rowtype; b public.usuarios%rowtype; outsider public.usuarios%rowtype; other_company public.usuarios%rowtype;
 sid uuid:=gen_random_uuid(); sid2 uuid:=gen_random_uuid(); eid uuid:=gen_random_uuid(); result jsonb; dep jsonb; denied boolean; n integer;
begin
 select * into a from public.usuarios where empresa='EMINSG' and id=19;
 select * into b from public.usuarios where empresa=a.empresa and id<>a.id and auth_user_id is not null order by id limit 1;
 select * into outsider from public.usuarios where empresa=a.empresa and id not in(a.id,b.id) and auth_user_id is not null order by id limit 1;
 select * into other_company from public.usuarios where empresa<>a.empresa and auth_user_id is not null order by id limit 1;
 if a.id is null or b.id is null or outsider.id is null or other_company.id is null then raise exception 'Missing test actors'; end if;
 perform set_config('request.jwt.claim.sub',a.auth_user_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a.auth_user_id,'email',a.correo,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 dep:=public.solicitudes_api(a.id,'departamento',jsonb_build_object('nombre','QA rollback '||sid,'responsable_id',b.id));
 result:=public.solicitudes_api(a.id,'crear',jsonb_build_object('id',sid,'departamento_id',dep->>'id','categoria','Materiales','titulo','QA solicitud rollback','descripcion','Prueba transaccional, no enviar correos'));
 if result->>'estado'<>'Pendiente' or (result->>'destinatario_id')::integer<>b.id then raise exception 'Create/routing failed'; end if;
 perform public.solicitudes_api(a.id,'crear',jsonb_build_object('id',sid));
 select count(*) into n from public.solicitudes_eventos where solicitud_id=sid;
 if n<>1 then raise exception 'Create retry duplicated event'; end if;
 denied:=false; begin
  perform public.solicitudes_api(a.id,'responder',jsonb_build_object('id',sid,'version',1,'evento_id',eid,'estado','Aprobada'));
 exception when others then denied:=true; end;
 if not denied then raise exception 'Requester approved own request'; end if;
 denied:=false; begin
  perform public.solicitudes_api(a.id,'crear',jsonb_build_object('id',sid2,'destinatario_id',other_company.id,'categoria','Materiales','titulo','Cross company','descripcion','Not allowed'));
 exception when others then denied:=true; end;
 if not denied then raise exception 'Cross company recipient accepted'; end if;
 perform public.solicitudes_api(a.id,'departamento',dep||jsonb_build_object('responsable_id',outsider.id));
 result:=public.solicitudes_api(a.id,'detalle',jsonb_build_object('id',sid));
 if (result#>>'{solicitud,destinatario_id}')::integer<>b.id then raise exception 'Department edit changed history'; end if;
 perform set_config('request.jwt.claim.sub',outsider.auth_user_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',outsider.auth_user_id,'email',outsider.correo,'role','authenticated')::text,true);
 select count(*) into n from public.solicitudes where id=sid;
 if n<>0 then raise exception 'RLS leaked request'; end if;
 select count(*) into n from public.solicitudes_eventos where solicitud_id=sid;
 if n<>0 then raise exception 'RLS leaked history'; end if;
 select count(*) into n from public.notificaciones_entregas where payload->>'solicitud_id'=sid::text;
 if n<>0 then raise exception 'RLS leaked notification'; end if;
 denied:=false; begin perform public.solicitudes_api(a.id,'detalle',jsonb_build_object('id',sid)); exception when others then denied:=true; end;
 if not denied then raise exception 'Impersonation accepted'; end if;
 denied:=false; begin perform public.solicitudes_api(outsider.id,'detalle',jsonb_build_object('id',sid)); exception when others then denied:=true; end;
 if not denied then raise exception 'Outsider read request'; end if;
 perform set_config('request.jwt.claim.sub',b.auth_user_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b.auth_user_id,'email',b.correo,'role','authenticated')::text,true);
 select count(*) into n from public.notificaciones_entregas where payload->>'solicitud_id'=sid::text;
 if n<>1 then raise exception 'Recipient missing notification'; end if;
 denied:=false; begin update public.solicitudes set estado='Completada' where id=sid; exception when others then denied:=true; end;
 if not denied then raise exception 'Direct update allowed'; end if;
 denied:=false; begin perform public.solicitudes_api(b.id,'responder',jsonb_build_object('id',sid,'version',1,'evento_id',eid,'estado','Rechazada','mensaje','')); exception when others then denied:=true; end;
 if not denied then raise exception 'Rejection without reason allowed'; end if;
 result:=public.solicitudes_api(b.id,'responder',jsonb_build_object('id',sid,'version',1,'evento_id',eid,'estado','Aprobada','mensaje','Aprobada para ejecución'));
 perform public.solicitudes_api(b.id,'responder',jsonb_build_object('id',sid,'version',1,'evento_id',eid,'estado','Aprobada'));
 select count(*) into n from public.solicitudes_eventos where solicitud_id=sid;
 if n<>2 or result->>'version'<>'2' then raise exception 'Response retry duplicated event'; end if;
 denied:=false; begin perform public.solicitudes_api(b.id,'responder',jsonb_build_object('id',sid,'version',1,'evento_id',gen_random_uuid(),'estado','Completada')); exception when others then denied:=true; end;
 if not denied then raise exception 'Stale write accepted'; end if;
 result:=public.solicitudes_api(b.id,'listar',jsonb_build_object('bandeja','recibidas','historial',false));
 if not result @> jsonb_build_array(jsonb_build_object('id',sid)) then raise exception 'Approved missing from active'; end if;
 perform public.solicitudes_api(b.id,'responder',jsonb_build_object('id',sid,'version',2,'evento_id',gen_random_uuid(),'estado','Completada','mensaje','Entrega confirmada'));
 result:=public.solicitudes_api(b.id,'listar',jsonb_build_object('bandeja','recibidas','historial',true));
 if not result @> jsonb_build_array(jsonb_build_object('id',sid)) then raise exception 'Completed missing from history'; end if;
 denied:=false; begin perform public.solicitudes_api(b.id,'responder',jsonb_build_object('id',sid,'version',3,'evento_id',gen_random_uuid(),'mensaje','Reopen')); exception when others then denied:=true; end;
 if not denied then raise exception 'Closed request changed'; end if;
 execute 'reset role';
 raise notice 'PASS: routing, history, idempotency, RLS, tenant isolation, participant permissions and transitions';
end $$;
rollback;
