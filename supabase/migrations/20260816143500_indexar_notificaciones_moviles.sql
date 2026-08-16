create index if not exists notificaciones_lecturas_usuario_idx
  on public.notificaciones_lecturas (auth_user_id, leida_at desc);
create index if not exists notificaciones_push_entregas_dispositivo_idx
  on public.notificaciones_push_entregas (dispositivo_id, created_at desc);
