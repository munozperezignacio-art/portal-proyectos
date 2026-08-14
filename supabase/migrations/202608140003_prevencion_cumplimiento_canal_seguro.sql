-- Los avisos de cumplimiento preventivo permanecen dentro de Obraxis.
update public.notificaciones_reglas
set canal_email = false,
    canal_plataforma = true,
    updated_at = now()
where evento_codigo = 'prevencion_cumplimiento_pendiente';

create or replace function public.asegurar_regla_cumplimiento_preventivo()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.notificar_pendiente and new.empresa is not null then
    insert into public.notificaciones_reglas (
      empresa, nombre, evento_codigo, modulo, descripcion,
      destinatarios_roles, destinatarios_usuarios, correos_adicionales,
      canal_email, canal_plataforma, frecuencia, condiciones, activa, creado_por
    ) values (
      new.empresa,
      'Cumplimiento preventivo pendiente',
      'prevencion_cumplimiento_pendiente',
      'Prevención',
      'Avisa al responsable cuando el formulario asignado no fue completado al vencimiento configurado.',
      '[]'::jsonb, '[]'::jsonb, '[]'::jsonb,
      false, true, 'Diaria',
      jsonb_build_object('alcance_tipo', 'todas', 'origen', 'cumplimiento_preventivo'),
      true, 'Sistema Obraxis'
    )
    on conflict (empresa, evento_codigo)
      where evento_codigo = 'prevencion_cumplimiento_pendiente'
    do nothing;
  end if;
  return new;
end;
$$;
