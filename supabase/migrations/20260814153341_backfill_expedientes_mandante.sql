insert into public.mandante_acreditaciones (contrato_id, empresa_mandante, categoria)
select c.id, c.empresa_mandante, x.categoria
from public.mandante_contratos c
cross join lateral (values
  ('Empresa', coalesce((c.alcance_acreditacion->>'empresa')::boolean, false)),
  ('Personal', coalesce((c.alcance_acreditacion->>'personal')::boolean, false)),
  ('Equipos', coalesce((c.alcance_acreditacion->>'equipos')::boolean, false))
) as x(categoria, habilitada)
where c.exige_acreditacion and x.habilitada
on conflict (contrato_id, categoria) do nothing;

insert into public.mandante_obligaciones
  (contrato_id, empresa_mandante, tipo, nombre, periodicidad, responsable)
select c.id, c.empresa_mandante, x.tipo, x.nombre, x.periodicidad, c.contacto_nombre
from public.mandante_contratos c
cross join lateral (values
  ('Avance', 'Informe de avance', coalesce(c.periodicidad->>'avance', 'Semanal'), coalesce((c.paquetes->>'avance')::boolean, false)),
  ('Programacion', 'Actualización de programación', 'Semanal', coalesce((c.paquetes->>'programacion')::boolean, false)),
  ('Estado de pago', 'Estado de pago', 'Mensual', coalesce((c.paquetes->>'estados_pago')::boolean, false)),
  ('Prevencion', 'Informe de prevención', coalesce(c.periodicidad->>'prevencion', 'Mensual'), coalesce((c.paquetes->>'prevencion')::boolean, false)),
  ('Calidad', 'Informe de calidad', coalesce(c.periodicidad->>'calidad', 'Por evento'), coalesce((c.paquetes->>'calidad')::boolean, false))
) as x(tipo, nombre, periodicidad, habilitada)
where x.habilitada
  and not exists (
    select 1 from public.mandante_obligaciones o
    where o.contrato_id = c.id and o.tipo = x.tipo and o.activa
  );;
