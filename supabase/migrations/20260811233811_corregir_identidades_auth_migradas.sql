-- MigraciÃ³n controlada de Obraxis a Supabase Auth.
create extension if not exists pgcrypto;
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

alter table public.usuarios add column if not exists auth_user_id uuid references auth.users(id) on delete set null;
alter table public.usuarios alter column contrasena drop not null;
alter table public.usuarios alter column contrasena set default null;
create index if not exists idx_usuarios_auth_user_id on public.usuarios(auth_user_id);
create index if not exists idx_usuarios_correo_lower on public.usuarios(lower(btrim(correo)));

do $$
declare profile record; linked_id uuid;
begin
  for profile in select id, correo, contrasena, empresa, nombre from public.usuarios where correo is not null and btrim(correo) <> '' loop
    select id into linked_id from auth.users where lower(email)=lower(btrim(profile.correo)) limit 1;
    if linked_id is null then
      if profile.contrasena is null or btrim(profile.contrasena)='' then raise exception 'El perfil % no tiene contraseÃ±a', profile.id; end if;
      linked_id := gen_random_uuid();
      insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,is_super_admin,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change,email_change_token_current,reauthentication_token,is_sso_user,is_anonymous)
      values ('00000000-0000-0000-0000-000000000000',linked_id,'authenticated','authenticated',lower(btrim(profile.correo)),crypt(profile.contrasena,gen_salt('bf')),now(),jsonb_build_object('provider','email','providers',array['email']),jsonb_build_object('nombre',profile.nombre),false,now(),now(),'','','','','','',false,false);
      insert into auth.identities (id,provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
      values (gen_random_uuid(),lower(btrim(profile.correo)),linked_id,jsonb_build_object('sub',linked_id::text,'email',lower(btrim(profile.correo)),'email_verified',true,'phone_verified',false),'email',now(),now(),now());
    end if;
    update public.usuarios set auth_user_id=linked_id where id=profile.id;
  end loop;
  update public.usuarios set contrasena=null;
  update auth.users set email_change='' where email_change is null;
end $$;

create or replace function private.obraxis_actor_can_access_company(target_company text) returns boolean language sql stable security definer set search_path=public,auth as $$
  select exists(select 1 from public.usuarios actor where actor.auth_user_id=auth.uid() and (actor.empresa=target_company or (actor.empresa='Obraxis' and lower(coalesce(actor.rol_base,actor.rol,'')) in ('superusuario','superadmin'))));
$$;
create or replace function private.obraxis_actor_can_manage_company(target_company text) returns boolean language sql stable security definer set search_path=public,auth as $$
  select exists(select 1 from public.usuarios actor where actor.auth_user_id=auth.uid() and ((actor.empresa='Obraxis' and lower(coalesce(actor.rol_base,actor.rol,'')) in ('superusuario','superadmin')) or (actor.empresa=target_company and (lower(coalesce(actor.rol_base,actor.rol,'')) like '%admin%' or coalesce((actor.permisos->>'admin.usuarios.configurar')::boolean,false) or coalesce((actor.permisos->>'admin.usuarios.crear')::boolean,false) or coalesce((actor.permisos->>'admin.usuarios.editar')::boolean,false)))));
$$;
revoke all on function private.obraxis_actor_can_access_company(text) from public,anon;
revoke all on function private.obraxis_actor_can_manage_company(text) from public,anon;
grant execute on function private.obraxis_actor_can_access_company(text) to authenticated;
grant execute on function private.obraxis_actor_can_manage_company(text) to authenticated;

create or replace function private.obraxis_sync_usuario_auth() returns trigger language plpgsql security definer set search_path=public,auth,extensions as $$
declare linked_id uuid; clean_email text;
begin
  clean_email:=lower(btrim(new.correo));
  if clean_email is null or clean_email='' then raise exception 'El correo es obligatorio'; end if;
  if tg_op='UPDATE' then linked_id:=coalesce(new.auth_user_id,old.auth_user_id); end if;
  if linked_id is null then select id into linked_id from auth.users where lower(email)=clean_email limit 1; end if;
  if linked_id is null then
    if new.contrasena is null or btrim(new.contrasena)='' then raise exception 'La contraseÃ±a inicial es obligatoria'; end if;
    linked_id:=gen_random_uuid();
    insert into auth.users (instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,is_super_admin,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change,email_change_token_current,reauthentication_token,is_sso_user,is_anonymous)
    values ('00000000-0000-0000-0000-000000000000',linked_id,'authenticated','authenticated',clean_email,crypt(new.contrasena,gen_salt('bf')),now(),jsonb_build_object('provider','email','providers',array['email']),jsonb_build_object('nombre',new.nombre),false,now(),now(),'','','','','','',false,false);
    insert into auth.identities (id,provider_id,user_id,identity_data,provider,last_sign_in_at,created_at,updated_at)
    values (gen_random_uuid(),clean_email,linked_id,jsonb_build_object('sub',linked_id::text,'email',clean_email,'email_verified',true,'phone_verified',false),'email',now(),now(),now());
  else
    if tg_op='UPDATE' and clean_email<>lower(btrim(old.correo)) then
      if exists(select 1 from auth.users where lower(email)=clean_email and id<>linked_id) then raise exception 'El correo ya pertenece a otra cuenta'; end if;
      update auth.users set email=clean_email,updated_at=now() where id=linked_id;
      update auth.identities set provider_id=clean_email,identity_data=identity_data||jsonb_build_object('email',clean_email),updated_at=now() where user_id=linked_id and provider='email';
    end if;
    if new.contrasena is not null and btrim(new.contrasena)<>'' then update auth.users set encrypted_password=crypt(new.contrasena,gen_salt('bf')),updated_at=now() where id=linked_id; end if;
  end if;
  new.correo:=clean_email; new.auth_user_id:=linked_id; new.contrasena:=null; return new;
end $$;

drop trigger if exists trg_usuarios_sync_auth on public.usuarios;
create trigger trg_usuarios_sync_auth before insert or update of correo,contrasena on public.usuarios for each row execute function private.obraxis_sync_usuario_auth();
revoke all on function private.obraxis_sync_usuario_auth() from public,anon,authenticated;

alter table public.usuarios enable row level security;
drop policy if exists "Allow_All_Operations_Anon_Authenticated" on public.usuarios;
drop policy if exists usuarios_select_empresa on public.usuarios;
drop policy if exists usuarios_insert_empresa on public.usuarios;
drop policy if exists usuarios_update_empresa on public.usuarios;
drop policy if exists usuarios_delete_empresa on public.usuarios;
create policy usuarios_select_empresa on public.usuarios for select to authenticated using (private.obraxis_actor_can_access_company(empresa));
create policy usuarios_insert_empresa on public.usuarios for insert to authenticated with check (private.obraxis_actor_can_manage_company(empresa));
create policy usuarios_update_empresa on public.usuarios for update to authenticated using (private.obraxis_actor_can_manage_company(empresa)) with check (private.obraxis_actor_can_manage_company(empresa));
create policy usuarios_delete_empresa on public.usuarios for delete to authenticated using (private.obraxis_actor_can_manage_company(empresa));
revoke all on public.usuarios from anon;
grant select,insert,update,delete on public.usuarios to authenticated;
grant usage,select on sequence public.usuarios_id_seq to authenticated;

comment on column public.usuarios.auth_user_id is 'Identidad segura en Supabase Auth; varios perfiles empresariales pueden compartirla.';
comment on column public.usuarios.contrasena is 'Campo heredado: el trigger consume valores nuevos transitoriamente y siempre los elimina.';

;
