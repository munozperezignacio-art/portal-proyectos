alter table public.planificacion_cronogramas
  add column if not exists presupuesto_item_id integer;

alter table public.planificacion_cronogramas
  drop constraint if exists planificacion_cronogramas_presupuesto_item_id_fkey,
  add constraint planificacion_cronogramas_presupuesto_item_id_fkey
    foreign key (presupuesto_item_id)
    references public.presupuestos_items(id)
    on delete set null;

create index if not exists idx_planificacion_cronogramas_presupuesto_item_id
  on public.planificacion_cronogramas (presupuesto_item_id);
