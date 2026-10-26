begin;
do $$
declare a public.usuarios%rowtype; recipient integer; works jsonb; w1 integer; w2 integer; sid uuid:=gen_random_uuid(); result jsonb; denied boolean;
begin
 select * into a from public.usuarios where id=19 and empresa='EMINSG';
 select id into recipient from public.usuarios where empresa=a.empresa and id<>a.id and auth_user_id is not null order by id limit 1;
 perform set_config('request.jwt.claim.sub',a.auth_user_id::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a.auth_user_id,'email',a.correo,'role','authenticated')::text,true);
 execute 'set local role authenticated';
 works:=public.solicitudes_api(a.id,'opciones')->'obras';
 w1:=(works->0->>'id')::integer; w2:=(works->1->>'id')::integer;
 if w1 is null or w2 is null then raise exception 'Two authorized works required'; end if;
 result:=public.solicitudes_api(a.id,'crear',jsonb_build_object('id',sid,'obra_id',w1,'destinatario_id',recipient,'categoria','Materiales','titulo','QA obra rollback','descripcion','Prueba de integración por obra'));
 if (result->>'obra_id')::integer<>w1 or result->>'obra_nombre' is null then raise exception 'Work link missing'; end if;
 result:=public.solicitudes_api(a.id,'listar',jsonb_build_object('obra_id',w1));
 if not result @> jsonb_build_array(jsonb_build_object('id',sid)) then raise exception 'Missing in project inbox'; end if;
 result:=public.solicitudes_api(a.id,'listar',jsonb_build_object('obra_id',w2));
 if result @> jsonb_build_array(jsonb_build_object('id',sid)) then raise exception 'Request leaked to another project'; end if;
 result:=public.solicitudes_api(a.id,'listar');
 if not result @> jsonb_build_array(jsonb_build_object('id',sid)) then raise exception 'Missing from personal inbox'; end if;
 denied:=false; begin perform public.solicitudes_api(a.id,'detalle',jsonb_build_object('id',sid,'obra_id',w2)); exception when others then denied:=true; end;
 if not denied then raise exception 'Wrong project detail accepted'; end if;
 denied:=false; begin perform public.solicitudes_api(a.id,'crear',jsonb_build_object('id',gen_random_uuid(),'obra_id',-1,'destinatario_id',recipient,'categoria','Materiales','titulo','Invalid project','descripcion','Must fail')); exception when others then denied:=true; end;
 if not denied then raise exception 'Invalid project accepted'; end if;
 execute 'reset role';
end $$;
rollback;
