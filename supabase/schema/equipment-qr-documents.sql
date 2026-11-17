-- Explicit publication only. No existing document is made public by this change.
create table public.equipo_documentos_qr (
 id uuid primary key default gen_random_uuid(),
 equipo_id integer not null references public.inventario_maquinaria(id),
 nombre text not null check(length(btrim(nombre)) between 1 and 180),
 publico_qr boolean not null default false,
 created_at timestamptz not null default now(),
 created_by uuid not null default auth.uid()
);
create index equipo_documentos_qr_equipo_idx on public.equipo_documentos_qr(equipo_id);
alter table public.equipo_documentos_qr enable row level security;
grant select,insert,update on public.equipo_documentos_qr to authenticated;
grant all on public.equipo_documentos_qr to service_role;
revoke all on public.equipo_documentos_qr from anon;
create policy equipo_docs_read on public.equipo_documentos_qr for select to authenticated using (
 exists(select 1 from public.inventario_maquinaria e where e.id=equipo_id and private.obraxis_permission(e.empresa,'maquinaria.inventario.ver'))
);
create policy equipo_docs_insert on public.equipo_documentos_qr for insert to authenticated with check (
 not publico_qr and created_by=auth.uid() and exists(select 1 from public.inventario_maquinaria e where e.id=equipo_id and private.obraxis_permission(e.empresa,'maquinaria.inventario.configurar'))
);
create policy equipo_docs_update on public.equipo_documentos_qr for update to authenticated using (
 exists(select 1 from public.inventario_maquinaria e where e.id=equipo_id and private.obraxis_permission(e.empresa,'maquinaria.inventario.configurar'))
) with check (
 exists(select 1 from public.inventario_maquinaria e where e.id=equipo_id and private.obraxis_permission(e.empresa,'maquinaria.inventario.configurar'))
);
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('equipment-qr-documents','equipment-qr-documents',false,10485760,array['application/pdf','image/jpeg','image/png']);

create function private.equipo_documento_access(p_path text,p_write boolean) returns boolean
language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and exists(
  select 1 from public.equipo_documentos_qr d join public.inventario_maquinaria e on e.id=d.equipo_id
  where d.id::text=p_path and private.obraxis_permission(e.empresa,
   case when p_write then 'maquinaria.inventario.configurar' else 'maquinaria.inventario.ver' end)
 );
$$;
revoke all on function private.equipo_documento_access(text,boolean) from public,anon;
grant execute on function private.equipo_documento_access(text,boolean) to authenticated;
create policy equipo_docs_storage_insert on storage.objects for insert to authenticated with check (
 bucket_id='equipment-qr-documents' and private.equipo_documento_access(name,true)
);
create policy equipo_docs_storage_read on storage.objects for select to authenticated using (
 bucket_id='equipment-qr-documents' and private.equipo_documento_access(name,false)
);
-- Prevent moving a file to another machine or publishing before its upload exists.
create function private.equipo_documento_guard() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if tg_op='UPDATE' and (new.id<>old.id or new.equipo_id<>old.equipo_id or new.created_by<>old.created_by or new.created_at<>old.created_at) then
  raise exception 'No se puede cambiar el equipo o autor de un documento';
 end if;
 if new.publico_qr and not exists(select 1 from storage.objects where bucket_id='equipment-qr-documents' and name=new.id::text) then
  raise exception 'Primero debes completar la carga del archivo';
 end if;
 return new;
end;$$;
revoke all on function private.equipo_documento_guard() from public,anon,authenticated;
create trigger equipo_documento_guard before insert or update on public.equipo_documentos_qr for each row execute function private.equipo_documento_guard();
