-- Conserva evidencia independiente de ingreso y salida del marcaje QR.
alter table public.asistencia_personal
  add column if not exists firma_salida_base64 text,
  add column if not exists latitud_salida double precision,
  add column if not exists longitud_salida double precision,
  add column if not exists distancia_salida_obra_m integer,
  add column if not exists precision_gps_ingreso_m double precision,
  add column if not exists precision_gps_salida_m double precision;

comment on column public.asistencia_personal.firma_base64 is
  'Firma manuscrita capturada al registrar el ingreso.';
comment on column public.asistencia_personal.firma_salida_base64 is
  'Firma manuscrita capturada al registrar la salida.';
