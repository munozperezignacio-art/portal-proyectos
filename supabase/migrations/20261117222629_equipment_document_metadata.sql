begin;
alter table public.equipo_documentos_qr add column fecha_vencimiento date, add column deleted_at timestamptz;
alter table public.equipo_documentos_qr add constraint equipo_documento_deleted_private check(deleted_at is null or not publico_qr);
commit;
