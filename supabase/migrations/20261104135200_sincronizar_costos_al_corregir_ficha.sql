-- Runs inside the authorized worker update, keeping the real session actor.
-- No public RPC, impersonation, new grants or manual-approval bypass.
create function private.rrhh_actualizar_costos_desde_ficha() returns trigger
language plpgsql security definer set search_path='' as $$
declare dia date;
begin
  if auth.uid() is null then return new; end if;
  for dia in
    select distinct t.fecha from public.rrhh_imputaciones_diarias t
    where t.empresa=new.empresa and t.trabajador_id=new.id
      and t.origen='Asistencia' and (t.estado='Pendiente' or t.asignacion_automatica)
      and t.fecha<=(now() at time zone 'America/Santiago')::date
      -- Closed payroll is the authoritative cost, never replace it with a provision.
      and not exists(select 1 from public.rrhh_costos_centros_aprobados c
        join public.rrhh_nomina_items i on i.id=c.nomina_item_id
        join public.rrhh_nominas_mensuales n on n.id=c.nomina_id
        where c.empresa=t.empresa and i.trabajador_id=t.trabajador_id
          and n.periodo=to_char(t.fecha,'YYYY-MM') and n.estado in ('Cerrada','Pagada'))
    order by t.fecha
  loop
    perform private.rrhh_sincronizar_cargo_dia(new.empresa,new.id,dia);
  end loop;
  return new;
end; $$;
revoke all on function private.rrhh_actualizar_costos_desde_ficha() from public,anon,authenticated;
create trigger rrhh_actualiza_costos_desde_ficha
after update of afp,tipo_contrato,fecha_inicio_contrato,fecha_vencimiento_contrato,
  sueldo_base,gratificacion,colacion,movilizacion,horas_semanales,otras_asignaciones
on public.maestro_personal for each row execute function private.rrhh_actualizar_costos_desde_ficha();
notify pgrst,'reload schema';
