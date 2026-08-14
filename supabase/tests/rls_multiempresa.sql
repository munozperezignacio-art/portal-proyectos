-- Prueba transaccional de aislamiento. No conserva datos.
begin;

insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values
('00000000-0000-0000-0000-000000000000','10000000-0000-0000-0000-000000000001','authenticated','authenticated','rls-a@obraxis.test','',now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','20000000-0000-0000-0000-000000000002','authenticated','authenticated','rls-b@obraxis.test','',now(),'{}','{}',now(),now());

insert into public.usuarios (usuario,correo,empresa,rol_base,auth_user_id)
values
('rls-test-a','rls-a@obraxis.test','RLS EMPRESA A','Administrador Empresa','10000000-0000-0000-0000-000000000001'),
('rls-test-b','rls-b@obraxis.test','RLS EMPRESA B','Administrador Empresa','20000000-0000-0000-0000-000000000002');

insert into public.obras (nombre,empresa)
values ('RLS OBRA A','RLS EMPRESA A'), ('RLS OBRA B','RLS EMPRESA B');

set local role authenticated;
select set_config('request.jwt.claims','{"sub":"10000000-0000-0000-0000-000000000001","role":"authenticated"}',true);

do $$
declare own_count integer; foreign_count integer; denied boolean := false;
begin
  select count(*) into own_count from public.obras where empresa='RLS EMPRESA A';
  select count(*) into foreign_count from public.obras where empresa='RLS EMPRESA B';
  if own_count <> 1 or foreign_count <> 0 then
    raise exception 'Falla SELECT RLS: propias %, ajenas %', own_count, foreign_count;
  end if;
  begin
    insert into public.obras (nombre,empresa) values ('RLS CRUCE PROHIBIDO','RLS EMPRESA B');
  exception when insufficient_privilege then denied := true;
  end;
  if not denied then raise exception 'Falla INSERT RLS cruzado'; end if;
end $$;

reset role;
rollback;
