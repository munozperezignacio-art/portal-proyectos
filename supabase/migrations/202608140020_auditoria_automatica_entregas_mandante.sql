create or replace function public.auditar_entrega_mandante()
returns trigger language plpgsql security invoker set search_path=public as $$
declare accion_texto text;
begin
  if tg_op='INSERT' then
    accion_texto := case when new.estado='Reenviado' then 'Entrega respondida y reenviada' else 'Entrega creada' end;
    insert into public.mandante_entrega_acciones(
      entrega_id,contrato_id,empresa_mandante,accion,estado_resultante,comentario,
      actor_nombre,actor_empresa,actor_tipo
    ) values (
      new.id,new.contrato_id,new.empresa_mandante,accion_texto,new.estado,
      coalesce(new.respuesta_contratista,new.datos->>'detalle'),
      coalesce(new.respondido_por,new.enviado_por),new.empresa_origen,'Sistema Obraxis'
    );
  elsif new.estado is distinct from old.estado then
    insert into public.mandante_entrega_acciones(
      entrega_id,contrato_id,empresa_mandante,accion,estado_resultante,comentario,
      actor_nombre,actor_empresa,actor_tipo
    ) values (
      new.id,new.contrato_id,new.empresa_mandante,'Estado actualizado a '||new.estado,new.estado,
      coalesce(new.observacion_mandante,new.respuesta_contratista),
      coalesce(new.revisado_por,new.respondido_por,new.enviado_por),new.empresa_mandante,'Sistema Obraxis'
    );
  end if;
  return new;
end; $$;

drop trigger if exists trg_auditar_entrega_mandante on public.mandante_entregas;
create trigger trg_auditar_entrega_mandante
after insert or update of estado on public.mandante_entregas
for each row execute function public.auditar_entrega_mandante();

insert into public.mandante_entrega_acciones(
  entrega_id,contrato_id,empresa_mandante,accion,estado_resultante,comentario,
  actor_nombre,actor_empresa,actor_tipo,created_at
)
select e.id,e.contrato_id,e.empresa_mandante,'Entrega incorporada al historial',e.estado,
       coalesce(e.observacion_mandante,e.respuesta_contratista,e.datos->>'detalle'),
       coalesce(e.revisado_por,e.respondido_por,e.enviado_por),e.empresa_origen,
       'Migración Obraxis',e.enviado_at
from public.mandante_entregas e
where not exists(select 1 from public.mandante_entrega_acciones a where a.entrega_id=e.id);
