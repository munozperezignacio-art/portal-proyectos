
alter table public.presupuestos_items add column if not exists orden integer;
with ranked as (
 select id, row_number() over(partition by presupuesto_id order by id)::integer as rn
 from public.presupuestos_items
)
update public.presupuestos_items p set orden=r.rn
from ranked r where r.id=p.id and p.orden is null;
alter table public.presupuestos_items alter column orden set default 0;
;
