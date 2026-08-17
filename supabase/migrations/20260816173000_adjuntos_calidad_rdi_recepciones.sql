alter table public.calidad_rdi
  add column if not exists adjuntos jsonb not null default '[]'::jsonb;

alter table public.calidad_recepciones_partidas
  add column if not exists adjuntos jsonb not null default '[]'::jsonb;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'calidad-adjuntos',
  'calidad-adjuntos',
  false,
  20971520,
  array[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists calidad_adjuntos_select on storage.objects;
create policy calidad_adjuntos_select on storage.objects
for select to authenticated
using (
  bucket_id = 'calidad-adjuntos'
  and (
    (split_part(name, '/', 1) = 'rdi' and exists (
      select 1 from public.calidad_rdi r
      where r.id::text = split_part(name, '/', 2)
        and (select private.obraxis_actor_can_access_company(r.empresa))
    ))
    or
    (split_part(name, '/', 1) = 'recepcion' and exists (
      select 1 from public.calidad_recepciones_partidas r
      where r.id::text = split_part(name, '/', 2)
        and (select private.obraxis_actor_can_access_company(r.empresa))
    ))
  )
);

drop policy if exists calidad_adjuntos_insert on storage.objects;
create policy calidad_adjuntos_insert on storage.objects
for insert to authenticated
with check (
  bucket_id = 'calidad-adjuntos'
  and (
    (split_part(name, '/', 1) = 'rdi' and exists (
      select 1 from public.calidad_rdi r
      where r.id::text = split_part(name, '/', 2)
        and (select private.obraxis_actor_can_access_company(r.empresa))
    ))
    or
    (split_part(name, '/', 1) = 'recepcion' and exists (
      select 1 from public.calidad_recepciones_partidas r
      where r.id::text = split_part(name, '/', 2)
        and (select private.obraxis_actor_can_access_company(r.empresa))
    ))
  )
);

drop policy if exists calidad_adjuntos_delete on storage.objects;
create policy calidad_adjuntos_delete on storage.objects
for delete to authenticated
using (
  bucket_id = 'calidad-adjuntos'
  and (
    (split_part(name, '/', 1) = 'rdi' and exists (
      select 1 from public.calidad_rdi r
      where r.id::text = split_part(name, '/', 2)
        and (select private.obraxis_actor_can_access_company(r.empresa))
    ))
    or
    (split_part(name, '/', 1) = 'recepcion' and exists (
      select 1 from public.calidad_recepciones_partidas r
      where r.id::text = split_part(name, '/', 2)
        and (select private.obraxis_actor_can_access_company(r.empresa))
    ))
  )
);
