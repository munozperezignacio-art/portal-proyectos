-- Existing assignments keep their full amount; no stored amounts or costs are changed.
alter table public.rrhh_haberes_obra add column if not exists proporcional boolean not null default false;
comment on column public.rrhh_haberes_obra.proporcional is 'Prorratear en descargas por días con marcaje trabajado dentro de la vigencia referencia. False incluye el monto completo si la vigencia se solapa.';
notify pgrst,'reload schema';
