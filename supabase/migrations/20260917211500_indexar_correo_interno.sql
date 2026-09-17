create index if not exists correo_conversaciones_contacto_idx
  on public.correo_conversaciones (contacto_id)
  where contacto_id is not null;

create index if not exists correo_conversaciones_responsable_idx
  on public.correo_conversaciones (responsable_auth_user_id)
  where responsable_auth_user_id is not null;

create index if not exists correo_mensajes_actor_idx
  on public.correo_mensajes (actor_auth_user_id)
  where actor_auth_user_id is not null;
